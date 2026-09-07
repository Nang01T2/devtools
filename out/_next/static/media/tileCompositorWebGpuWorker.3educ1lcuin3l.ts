/// <reference lib="webworker" />
// F02, mememaker-webgpu-app-wiring — sibling worker to
// tileCompositorGpuWorker.ts (WebGL2) and tileCompositorWorker.ts (CPU),
// speaking the EXACT SAME compositeJobV2 wire protocol
// (TileCompositeJob -> TileCompositeReply, see tileCompositorWorker.ts),
// backed by packages/render-core's WebGPUBackend (F01,
// mememaker-webgpu-app-wiring) instead of hand-rolled WebGL2 calls. This
// is what lets tileCompositorClient.ts's backend selection (F03, not this
// feature) stay a plain "which worker URL to construct" choice.
//
// F02, mememaker-webgpu-stack-run-compositing — this worker ALSO handles
// `kind:"stackRun"` messages (see `compositeStackRun` below), the
// cross-layer analogue of `tileCompositorGpuWorker.ts`'s own
// `compositeStackRunGpu`, backed by F01's `WebGPUBackend.compositeStackRun`
// primitive. NO CPU fallback exists for a stack run (`compositeJobCpu`
// reassembles a single layer only) — every guard below replies `ok:false`
// rather than routing anywhere, and the caller (`tiledStackController.ts`)
// treats that identically to "this run isn't GPU-composited this frame",
// falling back to per-layer Konva rendering.
//
// Blend mode / opacity for tile placement: this worker's job is pure
// per-layer tile REASSEMBLY, not cross-layer blending (same contract
// tileCompositorGpuWorker.ts's own header documents for its single-layer
// path — "Zero blend-mode/opacity/mask/adjustment math here"). Tiles are
// non-overlapping single-write regions (each output pixel belongs to
// exactly one tile), so compositing each one with WebGPUBackend's own
// `compositeTile(ref, tx, ty, "normal", 1)` onto a target `beginTarget`
// just cleared to transparent is mathematically identical to a direct,
// unblended overwrite — there is nothing meaningful to blend AGAINST for
// any pixel a tile ever touches. (The WebGL2 worker instead disables
// GL_BLEND outright and draws directly; WebGPUBackend's public surface
// has no such "unblended draw" primitive, only `compositeTile`, so
// "normal" opacity 1 is the equivalent call for a non-overlapping tile
// set — verified by inspecting tileCompositorGpuWorker.ts's own
// drawTileGroupsToBoundFramebuffer/compositeJobGpu before writing this.)
//
// Post-reassembly adjustment passes: F01/F02/F03 (mememaker-gpu-adjustment-
// lut-webgpu-port) added `WebGPUBackend.applyLutPass()`/
// `applyDirectAdjustmentPass()`/`applyColorLookup3dPass()`, so a job
// carrying `adjustmentLut`, `directAdjustment`, or `colorLookup3d` now runs
// entirely on the GPU (all three called from `compositeJobWebGpu`, between
// the last `compositeTile()` and `presentToSurface()` — rule C4, no CPU
// readback). `colorLookup3d` is gated on `backend.capabilities.
// colorLookup3d` (false only on an adapter whose `maxTextureDimension3D`
// is below 33 — a real hardware limit, not a code bug); every other job
// type is unaffected by that gate.
//
// Alpha convention (rule A1) — the ImageBitmap this worker replies with
// is PREMULTIPLIED-alpha storage, per `WebGPUBackend.presentToSurface`'s
// own contract (`alphaMode: "premultiplied"`, its present shader
// premultiplies once at the presentation boundary). This differs from
// both siblings: the CPU worker's `OffscreenCanvas.transferToImageBitmap()`
// and the WebGL2 worker's own canvas-based bitmap are straight-alpha.
// Both are consumed via the caller's `drawImage`, which accepts either
// storage — doubt-driven-review re-doubt finding: that does NOT make the
// difference harmless in every context. An 8-bit premultiply/un-premultiply
// round-trip is measurably lossy at low alpha (e.g. α=3/255 loses ~30
// levels of color precision on round-trip) — real, quantifiable
// divergence a naive byte-exact parity comparison between this worker's
// output and a sibling's would wrongly flag as a bug, or a *tolerant*
// comparison could wrongly wave through if the tolerance doesn't account
// for it. Any future parity test (F04's explicit job, per this plan's
// own dependency chain) MUST know this and size its tolerance
// accordingly — untested here, since this worker isn't reachable from
// the live app until F03.
import {
  compositeJob as compositeJobCpu,
  __resetCacheForTests as resetCpuCacheForTests,
  type TileCompositeJob,
  type TileCompositeReply,
} from "./tileCompositorWorker";
import {
  TILE_SIZE,
  publishTile,
  tileKey,
  type SliceRef,
} from "@gadgetforge/render-core";
import type { ExtendedBlendMode } from "../types";
import {
  WebGPUBackend,
  BackendContextLostError,
  BackendUnavailableWebGPUError,
  BackendDisposedError,
} from "@gadgetforge/render-core/backends";
// TYPE-ONLY import — erased at compile time, so no WebGL2 worker code is
// bundled into this worker; guarantees byte-identical wire shape with the
// WebGL2 worker's own stack-run protocol.
import type {
  StackRunJob,
  StackRunJobLayer,
  StackRunReply,
} from "./tileCompositorGpuWorker";
import { GPU_BLEND_MODE_ID } from "@gadgetforge/render-core/blendModes";
// F02, mememaker-gpu-adjustment-lut-webgpu-port — value import (this
// module is GLSL strings + pure JS, no WebGL2 code), reused unchanged
// from the WebGL2 worker's own dispatch so the uniform packing never
// drifts between tiers.
import {
  packDirectAdjustmentUniforms,
  directAdjustmentTypeIdOrDefault,
  type DirectAdjustmentType,
} from "./gpu/adjustmentShadersDirect";
// F03, mememaker-gpu-adjustment-lut-webgpu-port — bakeColorLookup3D's own
// module-level Map already memoizes the RGB8 bake by lookId
// (colorLookup3dLut.ts); this worker adds a SECOND cache, keyed the same
// way, for the RGBA8-EXPANDED array WebGPU actually needs (expandRgb8ToRgba8
// lives in render-core, not colorLookup3dLut.ts, per that module's own
// "bakeColorLookup3D is NOT modified — WebGL2 still needs the RGB8 layout"
// contract).
import { LUT_3D_SIZE, bakeColorLookup3D } from "./gpu/colorLookup3dLut";
import { expandRgb8ToRgba8 } from "@gadgetforge/render-core/backends";

/** ~143 KiB per look, static recipes (COLOR_LOOKUP_RECIPES never changes
 *  at runtime) ⇒ no invalidation needed — same unbounded-but-small
 *  singleton-cache convention `colorLookup3dLut.ts`'s own `cache` uses. */
const rgbaLutCache = new Map<string, Uint8Array>();
function rgbaLutFor(lookId: string): Uint8Array {
  let v = rgbaLutCache.get(lookId);
  if (!v) {
    v = expandRgb8ToRgba8(bakeColorLookup3D(lookId), LUT_3D_SIZE);
    rgbaLutCache.set(lookId, v);
  }
  return v;
}
/** Test-only reset hook — mirrors colorLookup3dLut.ts's own
 *  `__resetColorLookup3DCacheForTests` convention. */
export function __resetRgbaLutCacheForTests(): void {
  rgbaLutCache.clear();
}

// ---------------------------------------------------------------------------
// Module-level singleton state — one worker, one WebGPUBackend at a time.
// Unlike the WebGL2 worker's canvas/gl (which genuinely SURVIVES a
// contextlost/contextrestored cycle), a lost GPUDevice never comes back
// (see WebGPUBackend's own class doc comment) — there is no "restore"
// event to wait for. A loss means: destroy the old instance, and the
// NEXT job re-runs `WebGPUBackend.create()` from scratch, up to the same
// two-strikes-and-pinned threshold the WebGL2 worker uses.
// ---------------------------------------------------------------------------
let wgpu: WebGPUBackend | null = null;
let wgpuInit: Promise<WebGPUBackend | null> | null = null;
/** F01, mememaker-webgpu-broken-adapter-fallback, doubt-driven-review
 *  CRITICAL finding — `__resetForTests()` cannot cancel an in-flight
 *  `wgpuInit` (e.g. the module-level eager probe's own `create()` call).
 *  Without this token, that in-flight promise settles AFTER a reset and
 *  writes `wgpu`/`gpuUnavailable` into the just-cleared module, or posts
 *  a stray `backendFallback` notice a later test never provoked.
 *  `ensureWebGpu()` captures the token at call time and every write it
 *  makes checks it's still current before touching module state. */
let initEpoch = 0;
/** F02, mememaker-webgpu-stack-run-compositing, doubt-driven-review
 *  CRITICAL finding — `mainTex` is a single module-singleton render
 *  target shared by EVERY job this worker ever handles (tile jobs and
 *  stack runs alike). `compositeStackRunWebGpu` genuinely `await`s
 *  between `beginTarget()` and `presentToSurface()` (F01's own
 *  `pushErrorScope`/`popErrorScope` drain), a real yield point a second,
 *  concurrently-arriving message's own `beginTarget()` could otherwise
 *  land inside — clearing or `destroy()`ing the first job's in-flight
 *  target mid-composite. `onmessage` below chains every message (of
 *  EITHER kind) onto this one promise so exactly one composite runs at a
 *  time for the worker's whole lifetime, regardless of how many messages
 *  arrive back-to-back. */
let messageQueue: Promise<void> = Promise.resolve();
let deviceLossCount = 0;
let gpuUnavailable = false;
let warnedOnce = false;

/** F01, mememaker-webgpu-broken-adapter-fallback — which CODE PATH pinned
 *  the worker, so the client (F02, same plan) can decide whether/how to
 *  react instead of only `console.warn`ing. This is where-in-the-worker's-
 *  lifecycle detected it, NOT a classification of the underlying error:
 *  `"init"` and `"permanent"` can both be caused by the exact same
 *  `BackendUnavailableWebGPUError`/`BackendDisposedError` class — the only
 *  difference is whether `WebGPUBackend.create()` itself failed
 *  (`"init"`) or a backend that had already initialized successfully
 *  failed mid-job (`"permanent"`). `"deviceLostTwice"`: two consecutive
 *  device losses (see `handleDeviceLoss`'s own two-strike doc comment).
 *  F02 (same plan) treats all three identically (swap to WebGL2,
 *  uniformly, no cause-specific branching) — this discriminator exists
 *  for diagnostics/telemetry, not for different reactions. */
export type BackendFallbackCause = "init" | "deviceLostTwice" | "permanent";

function warnFallbackOnce(cause: BackendFallbackCause, reason: unknown): void {
  if (warnedOnce) return;
  warnedOnce = true;
  console.warn(
    "[MemeMaker] WebGPU tile compositor unavailable/pinned — falling back to CPU compositing in this worker for the rest of the session.",
    "cause:",
    cause,
    "reason:",
    reason,
  );
  // F03, mememaker-webgpu-app-wiring, rule C6 — a protocol-additive,
  // one-time notice so the MAIN THREAD (tileCompositorClient.ts) can
  // also surface this once, since this in-worker degradation is
  // asynchronous and can't be observed by `ensureWorker()`'s synchronous
  // `navigator.gpu` check. Ignored by any client that doesn't recognize
  // it (older code, or a test driving `compositeJobV2` directly) — every
  // job this worker replies to afterward still carries a real,
  // non-blank bitmap via the CPU fallback; this is purely the
  // user-facing half of that.
  if (typeof self !== "undefined" && typeof WorkerGlobalScope !== "undefined") {
    // doubt-driven-review finding: this notice is best-effort — a throw
    // here (e.g. `postMessage` on an already-closing/terminated worker
    // port) must never propagate out of `warnFallbackOnce`, since every
    // call site is reached from inside an in-flight `compositeJobV2`
    // that still owes the client a real reply; losing that reply would
    // hang the client's pending promise forever.
    try {
      (self as unknown as DedicatedWorkerGlobalScope).postMessage({
        type: "backendFallback",
        cause,
        reason: reason instanceof Error ? reason.message : String(reason),
      });
    } catch {
      // Best-effort notice only — the job's own reply (posted by the
      // caller after this function returns) is what actually matters.
    }
  }
}

function isDeviceLostError(err: unknown): boolean {
  return err instanceof BackendContextLostError;
}

/** doubt-driven-review finding: `BackendUnavailableWebGPUError` (e.g.
 *  `presentToSurface`'s "surface.getContext('webgpu') returned null") and
 *  `BackendDisposedError` (used-after-dispose) are BOTH permanent
 *  environmental conditions, not transient per-job compute failures —
 *  they will not resolve on the next job. Left in the generic catch-all
 *  bucket, they'd silently redo the full GPU composite (and fail again)
 *  on every subsequent job forever, one unthrottled `console.warn` each
 *  time (rule C6: "the fallback reason surfaced to the user once").
 *  Checked via `instanceof` against render-core's own typed error
 *  classes — a doubt-driven-review re-doubt finding flagged an earlier
 *  version of this function that regex-matched the disposed case's
 *  message text, a cross-package string coupling that would silently
 *  break (falling into the wrong, non-pinning bucket) the moment
 *  `WebGPUBackend`'s wording changed, with no test catching it. */
function isPermanentBackendError(err: unknown): boolean {
  return (
    err instanceof BackendUnavailableWebGPUError ||
    err instanceof BackendDisposedError
  );
}

/** Destroys `backend` (best-effort — it may already be torn down) and
 *  bumps the loss count, pinning permanently once it reaches 2, matching
 *  tileCompositorGpuWorker.ts's own `contextLossCount >= 2` doctrine. */
function handleDeviceLoss(backend: WebGPUBackend): void {
  deviceLossCount++;
  try {
    backend.destroy();
  } catch {
    // Already torn down by the same loss this call is reacting to — fine.
  }
  if (wgpu === backend) wgpu = null;
  if (deviceLossCount >= 2) {
    gpuUnavailable = true;
    warnFallbackOnce(
      "deviceLostTwice",
      "WebGPU device lost twice in one worker session",
    );
  }
}

/** Unlike a device loss (which gets two strikes before pinning — a
 *  transient driver hiccup can genuinely recover on a fresh device), a
 *  permanent backend error pins IMMEDIATELY: an unavailable/disposed
 *  backend has no "maybe it recovers next time" case. */
function handlePermanentBackendError(
  backend: WebGPUBackend,
  err: unknown,
): void {
  try {
    backend.destroy();
  } catch {
    // Already broken — nothing more to release.
  }
  if (wgpu === backend) wgpu = null;
  gpuUnavailable = true;
  warnFallbackOnce("permanent", err);
}

/** `OffscreenCanvas` is a real DedicatedWorkerGlobalScope global in every
 *  production environment this file runs in, but vitest's default "node"
 *  test environment has no such global — the same accommodation F01's
 *  own `WebGPUBackend.create({} as HTMLCanvasElement)` tests make by
 *  passing a plain cast object instead of a real canvas. Real WebGPU
 *  behavior (getContext, configure, transferToImageBitmap) is exercised
 *  live in the browser (see this feature's own verification step), never
 *  by this fallback. */
function makeOffscreenSurface(width: number, height: number): OffscreenCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  return { width, height } as OffscreenCanvas;
}

/** Lazy WebGPU init at first job — try-create, never UA-sniffing. Async
 *  (unlike tileCompositorGpuWorker.ts's synchronous `ensureGpu`) because
 *  `WebGPUBackend.create()` itself is async; concurrent callers within
 *  the same in-flight init share the one `wgpuInit` promise rather than
 *  racing separate `create()` calls. */
async function ensureWebGpu(): Promise<WebGPUBackend | null> {
  if (gpuUnavailable) return null;
  if (wgpu) return wgpu;
  if (wgpuInit) return wgpuInit;
  const epoch = initEpoch;
  wgpuInit = (async () => {
    try {
      // The `_surface` parameter is unused by `create()` itself (adapter/
      // device negotiation doesn't touch it) — a throwaway 1x1 surface
      // satisfies the signature without implying this canvas is ever
      // presented to.
      const backend = await WebGPUBackend.create(makeOffscreenSurface(1, 1));
      if (epoch !== initEpoch) {
        // `__resetForTests()` ran while this `create()` was in flight —
        // this backend belongs to a session that no longer exists; never
        // let it leak into the current one's `wgpu`.
        try {
          backend.destroy();
        } catch {
          // Already torn down — fine.
        }
        return null;
      }
      wgpu = backend;
      return backend;
    } catch (err) {
      if (epoch !== initEpoch) return null;
      gpuUnavailable = true;
      warnFallbackOnce("init", err);
      return null;
    } finally {
      if (epoch === initEpoch) wgpuInit = null;
    }
  })();
  return wgpuInit;
}

/** Persistent presentation surface, reused across jobs and resized as
 *  needed — `presentToSurface` itself keeps it configured at the current
 *  composite target's size (see its own doc comment: `surface.width =
 *  width; surface.height = height` is a documented side effect). */
let presentSurface: OffscreenCanvas | null = null;

async function compositeJobWebGpu(
  backend: WebGPUBackend,
  job: TileCompositeJob,
): Promise<TileCompositeReply> {
  const {
    id,
    tileSize,
    outputWidth,
    outputHeight,
    rectInLevelSpace: rect,
  } = job;
  const layerId = job.layerId!;
  const level = job.level!;

  // doubt-driven-review CRITICAL fix: the composite target `beginTarget`
  // allocates is only `outputWidth x outputHeight` (== rect.width x
  // rect.height) — it is NOT the full document/level canvas. `tx`/`ty`
  // below are ABSOLUTE tile-grid indices (needed for tile-cache identity,
  // shared across every job that ever references the same tile
  // regardless of viewport), but `WebGPUBackend.compositeTile` places a
  // tile at `(passedTx * TILE_SIZE, passedTy * TILE_SIZE)` in the CURRENT
  // target — an absolute index there would be off by the rect's own tile
  // origin for any viewport that doesn't start at tile (0,0) (a scrolled
  // or zoomed canvas). `hasUnsupportedGeometry` (checked by the caller
  // before this function ever runs) already guarantees `rect.x`/`rect.y`
  // are exact multiples of `tileSize`, so plain division here is exact —
  // never a rounded, silently-off-by-half-a-tile approximation.
  // tileCompositorGpuWorker.ts's WebGL2 sibling does the equivalent
  // subtraction in `resolveTileGroups` (`originX = t.tx * tileSize -
  // rect.x`); the CPU sibling does it via `ctx.putImageData(imageData,
  // tile.x - rect.x, tile.y - rect.y)`.
  const rectTx0 = rect.x / tileSize;
  const rectTy0 = rect.y / tileSize;

  const missing: string[] = [];
  const placements: {
    placeTx: number;
    placeTy: number;
    ref: ReturnType<WebGPUBackend["ensureTile"]>;
  }[] = [];
  // doubt-driven-review re-doubt finding: bracket EVERY ensureTile/
  // peekTile this job makes in one batch — required (see
  // WebGPUBackend.beginBatch's own doc comment) so a later tile in this
  // SAME loop pushing the backend's byte budget over the edge can never
  // evict an EARLIER tile this loop already holds a SliceRef for.
  backend.beginBatch();
  try {
    for (const t of job.tiles) {
      // Absolute tile-grid index — used ONLY for tile-cache identity
      // (ensureTile/peekTile/missing), matching
      // tileCompositorGpuWorker.ts's own compositeJobV2 exactly.
      const tx = Math.round(t.x / tileSize);
      const ty = Math.round(t.y / tileSize);
      // Rect-relative index — used ONLY for where this tile is drawn in
      // THIS job's target.
      const placeTx = tx - rectTx0;
      const placeTy = ty - rectTy0;
      if (t.buffer) {
        const data = new Uint8ClampedArray(t.buffer);
        const tile = publishTile(data, t.rev ?? 0);
        const ref = backend.ensureTile(layerId, level, tx, ty, tile);
        placements.push({ placeTx, placeTy, ref });
        continue;
      }
      // F02 protocol-v2 "clean tile" reference: no pixel data was sent,
      // only a claimed rev. A miss (never uploaded, evicted under the
      // backend's own byte budget, or a freshly re-created backend after
      // a device loss starting empty — or a stale rev) must NEVER be
      // treated as "draw nothing here"; it's collected (by its ABSOLUTE
      // key, which is what the client's own ledger is keyed by) and
      // turned into a whole-job cacheCold reply instead, same as every
      // other v2 worker.
      const ref = backend.peekTile(layerId, level, tx, ty, t.rev ?? 0);
      if (!ref) {
        missing.push(tileKey(tx, ty));
        continue;
      }
      placements.push({ placeTx, placeTy, ref });
    }
  } finally {
    backend.endBatch();
  }
  if (missing.length > 0) {
    return { id, ok: false, error: "cache-cold", cacheCold: true, missing };
  }

  backend.beginTarget({ width: outputWidth, height: outputHeight, level });
  const normal: ExtendedBlendMode = "normal";
  for (const { placeTx, placeTy, ref } of placements) {
    backend.compositeTile(ref, placeTx, placeTy, normal, 1);
  }

  // F01, mememaker-gpu-adjustment-lut-webgpu-port — post-reassembly LUT
  // pass on the GPU (rule C4: synchronous, no readback), applied ONCE to
  // the whole reassembled target — the same point tileCompositorWorker.ts's
  // CPU tier calls applyLutPassReference on its reassembled ImageData.
  // Runs BEFORE presentToSurface's premultiply, so it operates on
  // straight alpha (rule A1).
  if (job.adjustmentLut) {
    backend.applyLutPass(job.adjustmentLut);
  }
  // F02, mememaker-gpu-adjustment-lut-webgpu-port — post-reassembly
  // direct-adjustment pass, SAME order as tileCompositorGpuWorker.ts's
  // WebGL2 dispatch (LUT then direct then colorLookup3d) — if a job ever
  // carries both, LUT output is this pass's input, preserving the
  // existing cross-pass contract rather than redesigning it.
  if (job.directAdjustment) {
    const { type, params, fgColor, bgColor } = job.directAdjustment;
    backend.applyDirectAdjustmentPass(
      directAdjustmentTypeIdOrDefault(type),
      packDirectAdjustmentUniforms(
        type as DirectAdjustmentType,
        params,
        fgColor,
        bgColor,
      ),
    );
  }
  // F03, mememaker-gpu-adjustment-lut-webgpu-port — post-reassembly
  // colorLookup3d pass, SAME order as tileCompositorGpuWorker.ts's WebGL2
  // dispatch (LUT then direct then colorLookup3d) — if a job ever carries
  // more than one, each pass's output is the next's input, preserving the
  // existing cross-pass contract. Only reached when the guard above has
  // already confirmed backend.capabilities.colorLookup3d.
  if (job.colorLookup3d) {
    backend.applyColorLookup3dPass(
      rgbaLutFor(job.colorLookup3d.lookId),
      LUT_3D_SIZE,
      job.colorLookup3d.dither,
      { x: rect.x, y: rect.y }, // same rect the WebGL2 worker passes as u_coordOffset
    );
  }

  if (!presentSurface)
    presentSurface = makeOffscreenSurface(outputWidth, outputHeight);
  const bitmap = backend.presentToSurface(presentSurface);
  return { id, ok: true, bitmap };
}

/** Every real caller has a layer identity and a mip level — a v2 job
 *  missing either is a protocol violation, not a degenerate-but-valid
 *  case (matches both sibling workers' own v2 guard). */
function missingLayerIdOrLevel(job: TileCompositeJob): boolean {
  return job.layerId === undefined || job.level === undefined;
}

/** WebGPUBackend.compositeTile hardcodes render-core's own `TILE_SIZE`
 *  constant for its internal tile-sized texture math (dx/dy, upload
 *  extents) — unlike the WebGL2 worker's shader, which is parameterized
 *  by a `u_tileSize` uniform taken from the wire job itself. `job.tileSize`
 *  happens to always equal `TILE_SIZE` in production today (every real
 *  caller sources it from the same render-core constant — see
 *  tiledLayerBitmapController.ts's `grid.tileSize`), but the wire type
 *  doesn't enforce that. Routing a mismatched job to CPU instead of
 *  mis-placing every tile is the honest choice here, not a guess. */
/** F02, mememaker-webgpu-stack-run-compositing — fields common to a
 *  single-layer `TileCompositeJob` and a cross-layer `StackRunJob` — every
 *  geometry guard below is written against this shape so BOTH message
 *  kinds go through the SAME checks (a WebGPU validation error on an
 *  out-of-bounds `writeTexture`/`copyTextureToTexture` is async and
 *  silent, so an unguarded job of either kind would reply `ok:true` with
 *  corrupt pixels). */
interface JobGeometry {
  tileSize: number;
  outputWidth: number;
  outputHeight: number;
  rectInLevelSpace: { x: number; y: number; width: number; height: number };
}

function tileSizeMismatch(job: JobGeometry): boolean {
  return job.tileSize !== TILE_SIZE;
}

/** doubt-driven-review CRITICAL finding: `WebGPUBackend.compositeTile`
 *  writes an UNCLIPPED, full `TILE_SIZE x TILE_SIZE` region via
 *  `copyTextureToTexture` — it never clips to the target's own
 *  dimensions the way the CPU sibling's `putImageData` or the WebGL2
 *  sibling's viewport/scissor implicitly do. If `outputWidth`/
 *  `outputHeight` were ever NOT exact multiples of `tileSize`, an
 *  edge-row/column tile would write partly out of `mainTex`'s bounds —
 *  a WebGPU validation error reported asynchronously (no
 *  `pushErrorScope`/`onuncapturederror` is installed anywhere in this
 *  package), meaning nothing throws, this worker's own catch block never
 *  runs, and it would reply `ok:true` with a corrupted or partial
 *  bitmap. Every real caller today builds both `rectInLevelSpace` AND
 *  `outputWidth`/`outputHeight` as exact tile-size multiples (see
 *  tiledLayerBitmapController.ts), so this is currently unreachable in
 *  production — but exactly as with `tileSizeMismatch` above, an
 *  unenforced load-bearing invariant is a latent bug, not a safe
 *  assumption. Also covers `rectInLevelSpace.x/y`: `compositeJobWebGpu`
 *  divides these by `tileSize` to get the rect's own tile origin, and
 *  that division must be exact (see its own comment) or every tile
 *  silently mis-places by a fraction of a tile. */
function hasUnsupportedGeometry(job: JobGeometry): boolean {
  const { tileSize, outputWidth, outputHeight, rectInLevelSpace: rect } = job;
  return (
    outputWidth % tileSize !== 0 ||
    outputHeight % tileSize !== 0 ||
    rect.x % tileSize !== 0 ||
    rect.y % tileSize !== 0
  );
}

/** doubt-driven-review re-doubt finding: `hasUnsupportedGeometry` only
 *  guarantees tile-size ALIGNMENT, not CONTAINMENT — a job whose
 *  `tiles[]` includes one outside `rectInLevelSpace`'s own tile-grid
 *  bounds would still convert to a rect-relative index outside
 *  `[0, cols) x [0, rows)`, and `WebGPUBackend.compositeTile`'s
 *  unclipped `copyTextureToTexture` (see `hasUnsupportedGeometry`'s own
 *  comment on why that's dangerous) has no bounds check of its own.
 *  Called only after `hasUnsupportedGeometry` has already confirmed
 *  `tileSize`/`rect.x`/`rect.y`/`outputWidth`/`outputHeight` are exact
 *  multiples, so every division here is exact. Unreachable today
 *  (`tiledLayerBitmapController.ts` only ever builds a job's `tiles`
 *  from the SAME `[tx0..tx1] x [ty0..ty1]` range it derives
 *  `rectInLevelSpace` from) — same "unenforced invariant, not a safe
 *  assumption" posture as every other geometry guard in this file. */
/** Shared containment core over ABSOLUTE tile indices. Only valid after
 *  `hasUnsupportedGeometry` returned false (every division here is
 *  exact). */
function hasOutOfBoundsTileIndex(
  job: JobGeometry,
  tiles: readonly { tx: number; ty: number }[],
): boolean {
  const { tileSize, outputWidth, outputHeight, rectInLevelSpace: rect } = job;
  const cols = outputWidth / tileSize;
  const rows = outputHeight / tileSize;
  const rectTx0 = rect.x / tileSize;
  const rectTy0 = rect.y / tileSize;
  for (const t of tiles) {
    const placeTx = t.tx - rectTx0;
    const placeTy = t.ty - rectTy0;
    if (placeTx < 0 || placeTy < 0 || placeTx >= cols || placeTy >= rows) {
      return true;
    }
  }
  return false;
}

/** Single-layer wrapper — byte-for-byte the same result as before the
 *  shared core was extracted (pixel offset -> Math.round(x / tileSize),
 *  as tileCompositorGpuWorker.ts's own compositeJobV2 does). */
function hasOutOfBoundsTile(job: TileCompositeJob): boolean {
  return hasOutOfBoundsTileIndex(
    job,
    job.tiles.map((t) => ({
      tx: Math.round(t.x / job.tileSize),
      ty: Math.round(t.y / job.tileSize),
    })),
  );
}

/** Mirrors `tileCompositorGpuWorker.ts`'s own `expectedBytes` mask-size
 *  check, but BEFORE any backend call — a wrong-sized mask `writeTexture`
 *  is exactly the silent-async-validation-error class every other guard
 *  in this file exists to pre-empt. */
function memberMaskSizeMismatch(
  job: JobGeometry,
  member: StackRunJobLayer,
): boolean {
  if (!member.maskBuffer) return false;
  return (
    member.maskBuffer.byteLength !== job.outputWidth * job.outputHeight * 4
  );
}

/**
 * F02, mememaker-webgpu-stack-run-compositing — cross-layer stack-run
 * composite on WebGPU, the sibling of tileCompositorGpuWorker.ts's own
 * `compositeStackRunGpu`: resolve EVERY member's tiles inside ONE
 * beginBatch/endBatch bracket (same intra-job eviction-safety rationale as
 * `compositeJobWebGpu`), hand the resolved SliceRefs plus
 * blend/opacity/dissolve/mask to F01's `WebGPUBackend.compositeStackRun`,
 * then present.
 *
 * `originX`/`originY` are always 0: every tile's `tx`/`ty` has already
 * been converted to RECT-RELATIVE placement below (mirroring
 * `compositeJobWebGpu`'s own `placeTx`/`placeTy` split), so the run's
 * output rect always starts at (0,0) in `compositeStackRun`'s own
 * coordinate space — the WHOLE point of pre-shifting tiles here rather
 * than passing F01 the rect's absolute origin.
 *
 * Alpha convention (rule A1): the backend's accumulators are STRAIGHT
 * alpha (the WGSL blend math divides by outA, same as WebGL2's); the
 * bitmap this function returns is PREMULTIPLIED storage via
 * `presentToSurface`'s present-shader premultiply — identical to
 * `compositeJobWebGpu`'s reply and DIFFERENT from the WebGL2 worker's own
 * straight-alpha `transferToImageBitmap()`. Both are consumed via
 * `drawImage`, which accepts either; a future parity test must compare in
 * premultiplied space with tolerance, never byte-exact.
 *
 * Y orientation: `maskBuffer` is produced top-down by
 * `resampleMaskToGrayRgbaRect` (row 0 = the rect's own top row). WebGPU
 * `writeTexture`, render targets and `fragCoord` are ALL top-down, so it
 * is passed through with NO flip — the WebGL2 worker's
 * `UNPACK_FLIP_Y_WEBGL=true` mask upload has no analogue here.
 * LIVE-VERIFIED 2026-09-03: `tools/gpu-parity/main.ts`'s
 * `runStackRunOrientationCheck()`, driven via Chrome DevTools MCP against
 * a real Chrome instance with a real `GPUAdapter`, ran the REAL
 * `WebGPUBackend.compositeStackRun` with a 2-member run (opaque backdrop
 * + a top-half-white/bottom-half-black mask) and confirmed the top
 * sample shows the masked-IN layer and the bottom sample shows the
 * masked-OUT backdrop — no flip. Evidence:
 * `tools/gpu-parity/evidence/2026-09-03/stack-run-orientation-*.{png,json}`.
 * Do not remove this note without re-verifying if this method's mask
 * handling ever changes.
 *
 * Concurrency (doubt-driven-review CRITICAL finding, corrected): unlike
 * `compositeJobWebGpu`'s critical section, `backend.compositeStackRun(...)`
 * itself genuinely `await`s (F01's own `pushErrorScope`/`popErrorScope`
 * drain) — a real yield point sits between `beginTarget()` above and
 * `presentToSurface(...)` below. `mainTex` is a single module-singleton
 * render target shared by EVERY job this worker ever handles (tile jobs
 * and stack runs alike), so this function must NEVER run concurrently
 * with another `compositeJobWebGpu`/`compositeStackRunWebGpu` call on the
 * same backend — a second job's own `beginTarget()` would clear or
 * outright `destroy()` the first job's in-flight target mid-composite.
 * Serialization is NOT this function's own job: `onmessage` below queues
 * every message (of either kind) onto one chained promise so exactly one
 * composite runs at a time for this worker's whole lifetime — never call
 * this function directly from anywhere else without going through that
 * same queue.
 */
async function compositeStackRunWebGpu(
  backend: WebGPUBackend,
  job: StackRunJob,
): Promise<StackRunReply> {
  const {
    id,
    tileSize,
    outputWidth,
    outputHeight,
    rectInLevelSpace: rect,
  } = job;
  // Exact — `hasUnsupportedGeometry` already ran (see compositeStackRun).
  const rectTx0 = rect.x / tileSize;
  const rectTy0 = rect.y / tileSize;

  type MemberTile = { ref: SliceRef; tx: number; ty: number };
  type Member = {
    tiles: MemberTile[];
    blendMode: ExtendedBlendMode;
    opacity: number;
    dissolveSeed: number | undefined;
    mask: Uint8ClampedArray | undefined;
  };

  const missing: string[] = [];
  const members: Member[] = [];
  backend.beginBatch();
  try {
    for (const member of job.layers) {
      const tiles: MemberTile[] = [];
      for (const t of member.tiles) {
        // `t.tx`/`t.ty` are ABSOLUTE tile indices (GpuCompositeTile) —
        // cache identity; `placeTx`/`placeTy` are rect-relative — where
        // this tile lands in THIS run's target (same split as
        // compositeJobWebGpu's tx/placeTx).
        const placeTx = t.tx - rectTx0;
        const placeTy = t.ty - rectTy0;
        if (t.buffer) {
          const tile = publishTile(new Uint8ClampedArray(t.buffer), t.rev);
          const ref = backend.ensureTile(t.layerId, t.level, t.tx, t.ty, tile);
          tiles.push({ ref, tx: placeTx, ty: placeTy });
          continue;
        }
        // The client's v1 stack-run protocol ALWAYS sends full buffers, so
        // this branch is unreachable from today's client — kept for
        // wire-shape symmetry with the WebGL2 worker's own
        // `resolveTileGroups`: a clean-ref miss is a whole-run cacheCold,
        // never "draw nothing here".
        const ref = backend.peekTile(t.layerId, t.level, t.tx, t.ty, t.rev);
        if (!ref) {
          missing.push(tileKey(t.tx, t.ty));
          continue;
        }
        tiles.push({ ref, tx: placeTx, ty: placeTy });
      }
      members.push({
        tiles,
        blendMode: member.blendMode,
        opacity: member.opacity,
        dissolveSeed: member.dissolveSeed,
        // NO flip — see the Y-orientation paragraph above.
        mask: member.maskBuffer
          ? new Uint8ClampedArray(member.maskBuffer)
          : undefined,
      });
    }
  } finally {
    backend.endBatch();
  }
  if (missing.length > 0) {
    return { id, ok: false, error: "cache-cold", cacheCold: true, missing };
  }

  // doubt-driven-review CRITICAL finding: `WebGPUBackend.compositeStackRun`
  // hard-rejects unless `beginTarget()` was already called with the SAME
  // width/height (it is the sole allocation site for `mainTex`) — every
  // real run must call it here, exactly as `compositeJobWebGpu` does for
  // its own target. `StackRunJob` carries no top-level `level`; every
  // member's tiles do (`GpuCompositeTile.level`), and `beginTarget` only
  // uses `level` informationally today (ignored for allocation sizing),
  // so `0` is a safe default when a run somehow has zero tiles.
  const level = job.layers[0]?.tiles[0]?.level ?? 0;
  backend.beginTarget({ width: outputWidth, height: outputHeight, level });

  // Zero-tile member: an all-transparent scratch — the blend shader's
  // `sa <= 0 -> return backdrop` path makes it a no-op, matching WebGL2.
  // No special-casing needed.
  await backend.compositeStackRun({
    originX: 0,
    originY: 0,
    width: outputWidth,
    height: outputHeight,
    members,
  });

  if (!presentSurface)
    presentSurface = makeOffscreenSurface(outputWidth, outputHeight);
  // Rule C4: present via the zero-readback path only — no synchronous
  // GPU readback API is ever called on this path.
  const bitmap = backend.presentToSurface(presentSurface);
  return { id, ok: true, bitmap };
}

function stackRunFailure(id: number, detail: string): StackRunReply {
  return { id, ok: false, error: `[tileCompositorWebGpuWorker] ${detail}` };
}

/**
 * Canonical wire-protocol entry point for `kind:"stackRun"` — same name
 * and shape as tileCompositorGpuWorker.ts's own exported
 * `compositeStackRun`, exported so it is unit-testable without a real
 * DedicatedWorkerGlobalScope.
 *
 * NO CPU FALLBACK, BY DESIGN: `compositeJobCpu` reassembles ONE layer's
 * tiles and has no cross-layer semantics (the same doctrine the WebGL2
 * worker states for itself). Every guard here therefore replies
 * `ok:false` — the client rejects, `tiledStackController.ts` counts a
 * `fallback` and MemeStage renders the run per-layer via Konva, which is
 * exactly what "this run isn't GPU-composited this frame" already looks
 * like. Contrast `compositeJobV2`, where every guard routes to
 * `compositeJobCpu`.
 */
export async function compositeStackRun(
  job: StackRunJob,
): Promise<StackRunReply> {
  const { id } = job;
  if (job.layers.length === 0) {
    return stackRunFailure(id, "stack run has zero layers");
  }
  if (tileSizeMismatch(job)) {
    return stackRunFailure(
      id,
      `stack run tileSize ${job.tileSize} !== TILE_SIZE ${TILE_SIZE}`,
    );
  }
  if (hasUnsupportedGeometry(job)) {
    return stackRunFailure(id, "stack run geometry is not tile-aligned");
  }
  // doubt-driven-review finding: `hasUnsupportedGeometry` only checks
  // tile-size alignment, never that the run's OUTPUT size actually
  // matches its own RECT size — `compositeStackRunWebGpu` passes
  // `outputWidth`/`outputHeight` to the backend as the target size while
  // `memberMaskSizeMismatch` validates each mask against that SAME size,
  // but a mask is produced per-rect by `resampleMaskToGrayRgbaRect`
  // (`maskRunResample.ts`). Consistent only under the unenforced
  // `output* === rect.*` invariant every real caller happens to build —
  // same "unenforced invariant, not a safe assumption" posture as every
  // other geometry guard in this file.
  if (
    job.outputWidth !== job.rectInLevelSpace.width ||
    job.outputHeight !== job.rectInLevelSpace.height
  ) {
    return stackRunFailure(
      id,
      `stack run outputWidth/outputHeight (${job.outputWidth}x${job.outputHeight}) must equal rectInLevelSpace's own width/height (${job.rectInLevelSpace.width}x${job.rectInLevelSpace.height})`,
    );
  }
  // doubt-driven-review finding: `compositeStackRunWebGpu`'s `beginTarget`
  // call picks its `level` from `job.layers[0]?.tiles[0]?.level ?? 0` —
  // harmless today since `beginTarget` only uses `level` informationally,
  // but a mismatched `level` across tiles is exactly the "unenforced
  // load-bearing invariant" class every other geometry guard here exists
  // to pre-empt (and WOULD matter if `beginTarget` ever started using
  // `level` for anything, e.g. mip-aware allocation sizing).
  let expectedLevel: number | undefined;
  for (const member of job.layers) {
    for (const t of member.tiles) {
      if (expectedLevel === undefined) {
        expectedLevel = t.level;
      } else if (t.level !== expectedLevel) {
        return stackRunFailure(
          id,
          `stack run tiles disagree on level (expected ${expectedLevel}, got ${t.level})`,
        );
      }
    }
  }
  // Generalised over EVERY member: a run has N independent tile sets, any
  // one of which could be malformed.
  for (let i = 0; i < job.layers.length; i++) {
    const member = job.layers[i];
    // Defensive stale-client check mirroring the WebGL2 worker's own.
    // Unreachable on WebGPU in practice — all 27 modes compile in one
    // uber-shader or `create()` fails wholesale — so there is NO
    // `demoteBlendMode` call here.
    if (GPU_BLEND_MODE_ID[member.blendMode] === undefined) {
      return stackRunFailure(
        id,
        `unimplemented blend mode in stack run: ${member.blendMode}`,
      );
    }
    // doubt-driven-review finding: the backend's own `compositeStackRun`
    // validates `Number.isInteger` on every tile placement's derived
    // origin — a fractional `tx`/`ty` here would otherwise reach it as a
    // raw, untyped throw (routed to the generic catch-all `console.warn`
    // below) instead of this file's own clear, typed rejection, exactly
    // the "unenforced invariant" class every other guard here pre-empts.
    for (const t of member.tiles) {
      if (!Number.isInteger(t.tx) || !Number.isInteger(t.ty)) {
        return stackRunFailure(
          id,
          `stack run member ${i} has a non-integer tile index (${t.tx},${t.ty})`,
        );
      }
    }
    if (hasOutOfBoundsTileIndex(job, member.tiles)) {
      return stackRunFailure(
        id,
        `stack run member ${i} references a tile outside rectInLevelSpace`,
      );
    }
    if (memberMaskSizeMismatch(job, member)) {
      return stackRunFailure(
        id,
        `stack run member ${i} maskBuffer size mismatch (expected ${job.outputWidth * job.outputHeight * 4} bytes, got ${member.maskBuffer!.byteLength})`,
      );
    }
  }
  const backend = await ensureWebGpu();
  if (!backend) {
    // Pinned (two device losses, a permanent backend error, or create()
    // failed) — the WebGL2 worker's own reply for this state.
    // `warnFallbackOnce` already posted the ONE-TIME
    // {type:"backendFallback"} notice the main thread surfaces via
    // `warnWebGpuUnavailableOnce` — no new console.warn here.
    return stackRunFailure(id, "WebGPU unavailable for stack-run compositing");
  }
  // Rule C6: same pre-flight as compositeJobV2 — an oversized target must
  // never reach the backend's untyped throw.
  if (
    job.outputWidth > backend.capabilities.maxTextureSize ||
    job.outputHeight > backend.capabilities.maxTextureSize
  ) {
    return stackRunFailure(
      id,
      `stack run ${job.outputWidth}x${job.outputHeight} exceeds maxTextureSize ${backend.capabilities.maxTextureSize}`,
    );
  }
  try {
    return await compositeStackRunWebGpu(backend, job);
  } catch (err) {
    // Rule C2: identical classification to compositeJobV2's catch. First
    // loss -> destroy, next stack-run re-runs WebGPUBackend.create();
    // second loss -> `gpuUnavailable` pin + backendFallback notice. Either
    // way THIS run replies ok:false — never a blank/partial bitmap
    // presented as success.
    if (isDeviceLostError(err)) {
      handleDeviceLoss(backend);
    } else if (isPermanentBackendError(err)) {
      handlePermanentBackendError(backend, err);
    } else {
      console.warn(
        "[MemeMaker] WebGPU stack-run composite failed, this run falls back to per-layer rendering",
        err,
      );
    }
    return {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * F02, mememaker-webgpu-app-wiring — canonical wire-protocol entry point,
 * same shape/contract as tileCompositorWorker.ts's own `compositeJob` and
 * tileCompositorGpuWorker.ts's own `compositeJobV2`. Exported (unlike a
 * fully-inline handler) so this core logic is unit-testable without a
 * real Worker/DedicatedWorkerGlobalScope — the `onmessage` wiring below
 * is a thin wrapper around it.
 */
export async function compositeJobV2(
  job: TileCompositeJob,
): Promise<TileCompositeReply> {
  if (missingLayerIdOrLevel(job)) {
    return {
      id: job.id,
      ok: false,
      error: "[tileCompositorWebGpuWorker] job missing layerId/level",
    };
  }
  if (tileSizeMismatch(job)) {
    return compositeJobCpu(job);
  }
  if (hasUnsupportedGeometry(job)) {
    return compositeJobCpu(job);
  }
  if (hasOutOfBoundsTile(job)) {
    return compositeJobCpu(job);
  }
  const backend = await ensureWebGpu();
  if (!backend) return compositeJobCpu(job);
  // Rule C6: an oversized target would make `beginTarget` throw a plain
  // `Error` (not a typed one `isDeviceLostError`/`isPermanentBackendError`
  // would recognize) on EVERY such job forever, one unthrottled
  // `console.warn` each time — check `capabilities.maxTextureSize`
  // BEFORE ever calling into the backend, exactly the one-line guard
  // F02's own spec requires.
  if (
    job.outputWidth > backend.capabilities.maxTextureSize ||
    job.outputHeight > backend.capabilities.maxTextureSize
  ) {
    return compositeJobCpu(job);
  }
  // F01/F02/F03, mememaker-gpu-adjustment-lut-webgpu-port: adjustmentLut,
  // directAdjustment, and colorLookup3d are all GPU-native now
  // (backend.applyLutPass / backend.applyDirectAdjustmentPass /
  // backend.applyColorLookup3dPass, called inside compositeJobWebGpu).
  // colorLookup3d additionally needs capabilities.colorLookup3d — a real
  // hardware limit (adapter.limits.maxTextureDimension3D < 33), not a code
  // bug, so ONLY colorLookup3d jobs degrade to CPU on such an adapter,
  // never the whole backend. Checked AFTER the backend/limit gates so a
  // doc with no backend (or an oversized target) reports "no backend"/
  // "oversized" as its fallback reason, not "adjustment".
  if (job.colorLookup3d && !backend.capabilities.colorLookup3d) {
    return compositeJobCpu(job);
  }
  try {
    return await compositeJobWebGpu(backend, job);
  } catch (err) {
    if (isDeviceLostError(err)) {
      handleDeviceLoss(backend);
    } else if (isPermanentBackendError(err)) {
      handlePermanentBackendError(backend, err);
    } else {
      // A genuinely transient compute-level failure — never crash the
      // job; fall back to CPU for THIS job only. Does not by itself pin
      // the session to CPU, matching tileCompositorGpuWorker.ts's own
      // per-job-failure-doesn't-pin convention.
      console.warn(
        "[MemeMaker] WebGPU composite failed, falling back to CPU for this job",
        err,
      );
    }
    return compositeJobCpu(job);
  }
}

/** Test-only reset hook — mirrors both sibling workers' own convention.
 *  Also resets the CPU delegate's own module-level v2 tile cache
 *  (doubt-driven-review finding): every real code path routes through
 *  `compositeJobCpu` on any fallback, so a test exercising the real
 *  (unmocked) CPU delegate across multiple cases would otherwise leak
 *  cache state between them, exactly the hazard
 *  `tileCompositorWorker.ts`'s own `__resetCacheForTests` exists to
 *  close for its own test file. */
export function __resetForTests(): void {
  wgpu = null;
  wgpuInit = null;
  initEpoch++;
  deviceLossCount = 0;
  gpuUnavailable = false;
  warnedOnce = false;
  presentSurface = null;
  messageQueue = Promise.resolve();
  resetCpuCacheForTests();
}

/**
 * F02, mememaker-webgpu-stack-run-compositing, doubt-driven-review
 * CRITICAL finding — chains `data`'s dispatch onto `messageQueue` rather
 * than handling each message independently: `compositeStackRun`'s real
 * internal `await` (unlike `compositeJobV2`'s synchronous critical
 * section) means a second message arriving before the first finishes
 * would otherwise interleave onto the SAME shared `mainTex`. Exported so
 * a test can drive the queuing behavior directly without a real
 * `DedicatedWorkerGlobalScope`; `onmessage` below is a thin wrapper that
 * also posts the result.
 */
export function __enqueueWorkerMessage(
  data: TileCompositeJob | StackRunJob,
): Promise<TileCompositeReply | StackRunReply> {
  const result = messageQueue.then(() =>
    "kind" in data && data.kind === "stackRun"
      ? compositeStackRun(data)
      : compositeJobV2(data as TileCompositeJob),
  );
  // The queue's own chain must keep advancing even if this particular
  // job's promise rejects — both `compositeStackRun` and `compositeJobV2`
  // already catch every real failure internally and resolve with an
  // `ok:false` reply, so a rejection here would be a genuinely unexpected
  // bug; it must never poison every future job on this queue.
  messageQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

// F01, mememaker-webgpu-broken-adapter-fallback — eager probe. Fires
// `ensureWebGpu()` at module load instead of waiting for the first real
// job. doubt-driven-review cycle-2 finding: an EARLIER version of this
// comment overclaimed "usually discovered before any tile job is even
// processed" — in the real production call pattern, `ensureWorker()`
// (`tileCompositorClient.ts`) is only ever constructed FROM INSIDE the
// request path (`requestTileComposite`/`requestStackRunComposite`), with
// the first job posted microtasks later — so that first job routinely
// lands inside this probe's own pending window and simply `await`s the
// SAME `wgpuInit` promise via `ensureWebGpu()`'s pre-existing dedup
// (below), rather than genuinely arriving "after" discovery. The real,
// narrower benefits this buys: (1) a small head start — the worker
// thread's own startup/script-eval time (real wall-clock, not a
// microtask) overlaps with `create()`'s negotiation instead of starting
// only once a job's own early guards (`tileSizeMismatch` etc.) finish
// running; (2) critically, a session whose EVERY job takes one of those
// early CPU-route guards and never reaches `ensureWebGpu()` at all would,
// without this probe, never discover or report a broken adapter for the
// whole session — the probe guarantees discovery happens regardless of
// whether any job ever needs the GPU path.
//
// doubt-driven-review cycle-2 CRITICAL finding, accepted as a documented
// trade-off (not fixed in F01 — see docs/knowledge/wiki/mememaker-gpu-backlog.md
// for the follow-up note): `ensureWebGpu()`'s `create()`-failure catch
// pins `gpuUnavailable = true` with ZERO retry strikes (unlike
// `handleDeviceLoss`'s deliberate two-strike leniency for a "transient
// driver hiccup"). Running that same zero-strike path earlier — at the
// coldest possible moment (worker-thread spin-up, concurrent with page
// load, before the GPU process may be warm) instead of at first real-job
// time — increases the odds a genuinely transient early-boot
// `requestAdapter()` failure permanently pins a session to CPU that would
// have succeeded moments later. Not fixed here: giving `"init"` the same
// two-strike leniency as device loss would change F01's already-approved
// notice contract (the `@happy`/`@eager-probe-failure` tests assert an
// IMMEDIATE `cause:"init"` notice on the first failure) and is a retry-
// policy redesign broader than this feature's scope.
//
// Idempotent with every later call: `ensureWebGpu()` dedups on its own
// `wgpuInit`/`wgpu`/`gpuUnavailable` state, so a job arriving while this
// probe is still pending shares the SAME `create()` call rather than
// racing a second one. This DOES mean a WebGPU-tier worker now always
// acquires a real adapter/device at startup, even for a session whose
// every job resolves via an early CPU-route guard (`tileSizeMismatch`,
// `hasUnsupportedGeometry`, `hasOutOfBoundsTile`) and never actually
// reaches the WebGPU path — accepted, since the whole point is
// discovering a broken adapter without depending on a job reaching that
// path first, and the backend is retained for reuse by any later job
// that does need it. Trade-off: if every job routes via those early
// guards for a long stretch, the probe-acquired device can sit idle long
// enough to be lost by the time a job finally needs it — nothing
// subscribes to `device.lost` at rest, so that loss is only detected (and
// costs one of `handleDeviceLoss`'s two strikes) once a job actually
// tries to use it; accepted as the pre-existing device-loss-handling
// contract already covers this case, just later than it otherwise would.
//
// Every real failure inside `ensureWebGpu()`'s own `create()` is already
// caught internally and turned into a `cause:"init"` notice, but the
// guard checks BEFORE that (`gpuUnavailable`/`wgpu`/`wgpuInit`) run
// outside that try — same defensive `.catch()` this file's other
// fire-and-forget calls use (`__enqueueWorkerMessage`'s own queue chain,
// `ctx.onmessage`'s handler) so a bug there can never become an
// unhandled rejection.
void ensureWebGpu().catch(() => {
  // Genuinely unreachable in normal operation — `ensureWebGpu()`'s own
  // `try/catch` already turns every real failure into a resolved `null`
  // plus a `cause:"init"` notice. This exists only so a bug in the
  // guard checks that run before that `try` can never surface as an
  // unhandled promise rejection in the worker.
});

if (typeof self !== "undefined" && typeof WorkerGlobalScope !== "undefined") {
  const ctx = self as unknown as DedicatedWorkerGlobalScope;
  ctx.onmessage = (e: MessageEvent<TileCompositeJob | StackRunJob>) => {
    __enqueueWorkerMessage(e.data)
      .then((reply) => {
        if (!reply.ok) {
          ctx.postMessage(reply);
          return;
        }
        // doubt-driven-review finding: a transferring `postMessage` can
        // throw (a detached/untransferable bitmap, a closing port) — an
        // uncaught throw here would leave the client's pending promise
        // unsettled FOREVER, exactly the hazard `warnFallbackOnce` above
        // already guards its own `postMessage` call against. Fall back
        // to a non-transferring `ok:false` reply so the client always
        // settles, even when the happy-path send itself fails.
        try {
          ctx.postMessage(reply, [reply.bitmap]);
        } catch (err) {
          ctx.postMessage({
            id: reply.id,
            ok: false,
            error: `[tileCompositorWebGpuWorker] postMessage failed: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      })
      .catch((err) => {
        console.error(
          "[tileCompositorWebGpuWorker] unexpected onmessage failure",
          err,
        );
      });
  };
}
