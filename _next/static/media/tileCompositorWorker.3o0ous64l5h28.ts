/// <reference lib="webworker" />
import { applyLutPassReference } from "./adjustmentLut";
import {
  buildAdjustmentFilter,
  type WorkerAdjustmentType,
} from "./adjustmentFilterDispatch";
import { getColorLookupRecipe } from "./colorLookupRecipes";
import { applyColorLookup } from "./colorLookupFilter";
// F05, mememaker-rendering-rewrite-phase-3 — dedicated per-layer viewport
// compositor worker for kind:"tiled" layers. Mirrors lib/motionBlurWorker.ts's
// exact protocol shape (id-tracked request/response), adapted for a
// multi-tile reassembly job whose reply carries a transferred ImageBitmap
// instead of a plain buffer.
//
// Protocol v1 (see lib/tileCompositorClient.ts, the only caller):
//   in:  TileCompositeJob { id, tiles (COPIED, never transferred — see
//        the client's postJob() header comment for why), tileSize,
//        rectInLevelSpace, outputWidth, outputHeight }
//   out: { id, ok: true, bitmap (TRANSFERRED) } | { id, ok: false, error }
//
// Protocol v2 (F02, mememaker-rendering-rewrite-phase-4-gpu-compositor) —
// additive, opted into per-job via `protocolVersion: 2`; a v1-shaped job
// (no `protocolVersion`) still runs the exact byte-identical v1 codepath
// below, unconditionally: this worker never breaks a caller that hasn't
// adopted v2. A v2 job's `layerId`/`level` namespace this worker's own
// tile cache (module-level, LRU-evicted under a byte budget — same
// Map-insertion-order-as-recency idiom as gpuTilePool.ts's cache, for
// the same reason: avoids a second linked-list structure). Each tile
// entry either carries `buffer` (a dirty tile — cached AND used) or omits
// it and instead carries `key`+`rev` only (a clean tile — the worker must
// already hold a matching cache entry). Any referenced-but-uncached tile
// (evicted, or this is a freshly (re)started worker with an empty cache)
// makes the WHOLE job reply `{ ok:false, cacheCold:true, missing }`
// instead of compositing with a hole — the client's job on cacheCold is
// to clear its ledger and resend the SAME request with every tile as a
// full buffer (see tileCompositorClient.ts's cold-cache handling).
//
// Deliberately NO blend-mode/opacity/cross-layer compositing logic here —
// this worker produces exactly ONE ImageBitmap per LAYER; every
// cross-layer composite (blend modes, opacity, masks, z-order) stays on
// Konva's own scene graph, unchanged. That is Phase 4's job, not this one.

export interface TileCompositeTile {
  x: number;
  y: number;
  width: number;
  height: number;
  /** v1: always present. v2: present only for a DIRTY tile (one this job
   *  must (re)cache); a CLEAN tile omits it and relies on `key`+`rev`
   *  already being cached from an earlier job. */
  buffer?: ArrayBuffer;
  /** v2 only — cache identity/freshness for this tile. Required together
   *  whenever `buffer` is omitted. */
  key?: string;
  rev?: number;
}

export interface TileCompositeJob {
  id: number;
  tileSize: number;
  rectInLevelSpace: { x: number; y: number; width: number; height: number };
  tiles: TileCompositeTile[];
  outputWidth: number;
  outputHeight: number;
  /** Present (`=== 2`) to opt into protocol v2 dirty-tile diffing.
   *  Absent (or any other value) runs the untouched v1 codepath. */
  protocolVersion?: 2;
  /** v2 only — cache namespace for this job's tiles. */
  layerId?: string;
  level?: number;
  /** F03, mememaker-rendering-rewrite-phase-4-gpu-compositor — optional
   *  post-reassembly LUT pass, applied via `adjustmentLut.ts`'s
   *  `applyLutPassReference` (the SAME function the GPU shader's
   *  parity test uses as its reference) directly on the reassembled
   *  ImageData before bitmap readout. This is what keeps a bypassed
   *  adjustment layer correct even when this CPU worker is serving as
   *  tileCompositorGpuWorker.ts's own CPU fallback (GPU unavailable,
   *  context lost, etc.) — the LUT application itself is fully
   *  backend-agnostic (plain JS, no WebGL dependency). */
  adjustmentLut?: { data: Uint8Array; mode: "perChannel" | "lumaIndexed" };
  /** F04, mememaker-rendering-rewrite-phase-4-gpu-compositor — optional
   *  post-reassembly direct adjustment pass, for the 7 WorkerAdjustmentType
   *  members F03's 1D-LUT mechanism cannot express. Applied here via the
   *  REAL, already-tested CPU filter (`buildAdjustmentFilter` — the exact
   *  same dispatch table `adjustmentFilterDispatch.ts` already exposes to
   *  every other CPU-path caller), never a re-derived approximation — this
   *  is the one case where the CPU fallback is MORE exact than its GPU
   *  counterpart (the GPU pass is a float-math port with a documented
   *  epsilon; this runs the actual integer CPU algorithm). */
  directAdjustment?: {
    type: string;
    params: unknown;
    fgColor: string;
    bgColor: string;
  };
  /** F04 — colorLookup's own CPU-fallback path: runs the REAL
   *  `applyColorLookup` pipeline directly (with the layer's live `dither`
   *  flag), not a baked-lattice approximation — same "CPU fallback is
   *  MORE exact" posture as `directAdjustment` above. */
  colorLookup3d?: { lookId: string; dither: boolean };
}

export type TileCompositeReply =
  | { id: number; ok: true; bitmap: ImageBitmap }
  | {
      id: number;
      ok: false;
      error: string;
      /** True when the failure is specifically "the worker doesn't hold
       *  one or more referenced clean tiles" — the client's signal to
       *  clear its ledger and retry once with full buffers, distinct
       *  from any other compute error (which does not retry). */
      cacheCold?: boolean;
      missing?: string[];
    };

// ---------------------------------------------------------------------------
// v2 tile cache — module-level singleton (one per worker instance, exactly
// like tileCompositorGpuWorker.ts's texture pool). Flat map keyed by
// `${layerId}|${level}|${tileKey}` (a single flat key, not nested Maps —
// simpler LRU: Map insertion order IS recency order, same idiom as
// gpuTilePool.ts). UNCONFIRMED DEFAULT (flagged, not user-confirmed):
// 64MB byte budget — CPU RAM is cheaper than VRAM but still bounded, so a
// long session touching many tiles across many layers can't leak forever.
// ---------------------------------------------------------------------------
const CPU_CACHE_BUDGET_BYTES = 64 * 1024 * 1024;
interface CpuCacheEntry {
  rev: number;
  data: Uint8ClampedArray<ArrayBuffer>;
}
const tileCache = new Map<string, CpuCacheEntry>();
let cacheUsedBytes = 0;

function cacheKey(layerId: string, level: number, key: string): string {
  return layerId + "|" + level + "|" + key;
}

function cacheTouch(key: string, entry: CpuCacheEntry): void {
  tileCache.delete(key);
  tileCache.set(key, entry); // re-insert = most-recently-used
}

function cachePut(key: string, entry: CpuCacheEntry): void {
  const existing = tileCache.get(key);
  if (existing) cacheUsedBytes -= existing.data.byteLength;
  tileCache.delete(key);
  tileCache.set(key, entry);
  cacheUsedBytes += entry.data.byteLength;
  while (cacheUsedBytes > CPU_CACHE_BUDGET_BYTES && tileCache.size > 0) {
    const oldestKey = tileCache.keys().next().value as string;
    const oldest = tileCache.get(oldestKey)!;
    tileCache.delete(oldestKey);
    cacheUsedBytes -= oldest.data.byteLength;
  }
}

/** Test-only reset hook — clears the module-level v2 cache between test
 *  cases (this worker's cache is otherwise a session-long singleton). */
export function __resetCacheForTests(): void {
  tileCache.clear();
  cacheUsedBytes = 0;
}

async function compositeFromResolvedTiles(
  id: number,
  tileSize: number,
  rect: { x: number; y: number; width: number; height: number },
  outputWidth: number,
  outputHeight: number,
  resolved: {
    x: number;
    y: number;
    width: number;
    height: number;
    data: Uint8ClampedArray<ArrayBuffer>;
  }[],
  adjustmentLut?: { data: Uint8Array; mode: "perChannel" | "lumaIndexed" },
  directAdjustment?: {
    type: string;
    params: unknown;
    fgColor: string;
    bgColor: string;
  },
  colorLookup3d?: { lookId: string; dither: boolean },
): Promise<TileCompositeReply> {
  try {
    if (typeof OffscreenCanvas === "undefined") {
      return {
        id,
        ok: false,
        error: "OffscreenCanvas unavailable in this worker",
      };
    }
    const canvas = new OffscreenCanvas(outputWidth, outputHeight);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return {
        id,
        ok: false,
        error: "2d context unavailable on OffscreenCanvas",
      };
    }
    for (const tile of resolved) {
      const imageData = new ImageData(tile.data, tile.width, tile.height);
      ctx.putImageData(imageData, tile.x - rect.x, tile.y - rect.y);
    }
    if (adjustmentLut) {
      const reassembled = ctx.getImageData(0, 0, outputWidth, outputHeight);
      applyLutPassReference(
        reassembled.data,
        adjustmentLut.data,
        adjustmentLut.mode,
      );
      ctx.putImageData(reassembled, 0, 0);
    }
    if (directAdjustment) {
      const reassembled = ctx.getImageData(0, 0, outputWidth, outputHeight);
      const filter = buildAdjustmentFilter(
        directAdjustment.type as WorkerAdjustmentType,
        directAdjustment.params,
        directAdjustment.fgColor,
        directAdjustment.bgColor,
      );
      filter(reassembled);
      ctx.putImageData(reassembled, 0, 0);
    }
    if (colorLookup3d) {
      const reassembled = ctx.getImageData(0, 0, outputWidth, outputHeight);
      const recipe = getColorLookupRecipe(colorLookup3d.lookId);
      applyColorLookup(reassembled, recipe, colorLookup3d.dither);
      ctx.putImageData(reassembled, 0, 0);
    }
    const bitmap = canvas.transferToImageBitmap();
    return { id, ok: true, bitmap };
  } catch (err) {
    return { id, ok: false, error: String(err) };
  }
}

/** Protocol v1 — byte-identical to the pre-F02 implementation. Every
 *  tile MUST carry `buffer` (v1 callers always send full payloads). */
async function compositeJobV1(
  job: TileCompositeJob,
): Promise<TileCompositeReply> {
  const resolved = job.tiles.map((tile) => ({
    x: tile.x,
    y: tile.y,
    width: tile.width,
    height: tile.height,
    data: new Uint8ClampedArray(tile.buffer!),
  }));
  return compositeFromResolvedTiles(
    job.id,
    job.tileSize,
    job.rectInLevelSpace,
    job.outputWidth,
    job.outputHeight,
    resolved,
    job.adjustmentLut,
    job.directAdjustment,
    job.colorLookup3d,
  );
}

/** Protocol v2 — dirty-tile diffing against this worker's own tile
 *  cache. A dirty tile (`buffer` present) is decoded, cached, and used.
 *  A clean tile (`buffer` absent) must already be cached with a
 *  matching rev; if not, the WHOLE job fails with `cacheCold: true` and
 *  never partially composites (a hole would be a silently wrong image,
 *  worse than a client-side retry). */
async function compositeJobV2(
  job: TileCompositeJob,
): Promise<TileCompositeReply> {
  const { layerId, level } = job;
  if (layerId === undefined || level === undefined) {
    return {
      id: job.id,
      ok: false,
      error: "protocol v2 job missing layerId/level",
    };
  }
  const missing: string[] = [];
  const resolved: {
    x: number;
    y: number;
    width: number;
    height: number;
    data: Uint8ClampedArray<ArrayBuffer>;
  }[] = [];
  for (const t of job.tiles) {
    if (t.buffer) {
      const data = new Uint8ClampedArray(t.buffer);
      if (t.key !== undefined && t.rev !== undefined) {
        cachePut(cacheKey(layerId, level, t.key), { rev: t.rev, data });
      }
      resolved.push({ x: t.x, y: t.y, width: t.width, height: t.height, data });
      continue;
    }
    if (t.key === undefined || t.rev === undefined) {
      return {
        id: job.id,
        ok: false,
        error: "protocol v2 tile missing both buffer and key/rev",
      };
    }
    const ck = cacheKey(layerId, level, t.key);
    const cached = tileCache.get(ck);
    if (!cached || cached.rev !== t.rev) {
      missing.push(t.key);
      continue;
    }
    cacheTouch(ck, cached);
    resolved.push({
      x: t.x,
      y: t.y,
      width: t.width,
      height: t.height,
      data: cached.data,
    });
  }
  if (missing.length > 0) {
    return {
      id: job.id,
      ok: false,
      error: "cache-cold",
      cacheCold: true,
      missing,
    };
  }
  return compositeFromResolvedTiles(
    job.id,
    job.tileSize,
    job.rectInLevelSpace,
    job.outputWidth,
    job.outputHeight,
    resolved,
    job.adjustmentLut,
    job.directAdjustment,
    job.colorLookup3d,
  );
}

/** Reassembles `job.tiles` into an OffscreenCanvas-backed ImageBitmap sized
 *  `outputWidth x outputHeight`. Exported (unlike motionBlurWorker.ts's
 *  fully-inline handler) so this core logic is unit-testable without a
 *  real Worker/DedicatedWorkerGlobalScope — the `onmessage` wiring below is
 *  a thin wrapper around it. Dispatches to the v1 or v2 codepath based on
 *  `job.protocolVersion` — see the file header for why v1 stays exactly
 *  as it was. */
export async function compositeJob(
  job: TileCompositeJob,
): Promise<TileCompositeReply> {
  // Catch-all around BOTH codepaths (doubt-driven-review Critical,
  // F02): the pre-F02 implementation guarded its entire body in one
  // try/catch; splitting into compositeJobV1/V2 narrowed that to only
  // compositeFromResolvedTiles's own try, leaving each tile's
  // `new Uint8ClampedArray(buffer)` decode step (a detached/invalid
  // ArrayBuffer throws) UNGUARDED. With no catch here and none in the
  // onmessage wiring below, that exception became an unhandled
  // rejection inside the worker — postMessage never fires, so the
  // client's pending promise for this job hangs forever instead of
  // settling with an error reply. Restores the original "any exception
  // in this job becomes {ok:false, error}" guarantee at the one
  // chokepoint both codepaths and both callers (this worker's own
  // onmessage, and tileCompositorGpuWorker.ts's CPU-fallback delegate)
  // share.
  try {
    if (job.protocolVersion === 2) return await compositeJobV2(job);
    return await compositeJobV1(job);
  } catch (err) {
    return { id: job.id, ok: false, error: String(err) };
  }
}

if (typeof self !== "undefined" && typeof WorkerGlobalScope !== "undefined") {
  const ctx = self as unknown as DedicatedWorkerGlobalScope;
  ctx.onmessage = async (e: MessageEvent<TileCompositeJob>) => {
    const reply = await compositeJob(e.data);
    if (reply.ok) {
      ctx.postMessage(reply, [reply.bitmap]);
    } else {
      ctx.postMessage(reply);
    }
  };
}
