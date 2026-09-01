/// <reference lib="webworker" />
// F01, mememaker-rendering-rewrite-phase-4-gpu-compositor — GPU tile
// compositor worker: one worker file, two backends (WebGL2 + CPU
// fallback), same id-tracked request/reply RPC envelope as
// tileCompositorWorker.ts/motionBlurWorker.ts. Deliberately NOT wired
// into any live app path in F01 — it is instantiated only by tests (and
// by F02 later, which does the client/protocol-v2/backend-selection
// wiring). tileCompositorClient.ts continues to spawn the CPU worker
// unchanged; this file is a second, still-dormant worker script.
//
// Zero blend-mode/opacity/mask/adjustment math here — pure per-layer
// tile reassembly, the exact same contract tileCompositorWorker.ts's own
// header documents. Cross-layer compositing stays on Konva's scene
// graph until F06+.
import {
  compositeJob as compositeJobCpu,
  type TileCompositeJob,
  type TileCompositeReply,
} from "./tileCompositorWorker";
import { createGpuTilePool } from "./gpuTilePool";
import { TILE_SIZE, publishTile, tileKey } from "@gadgetforge/render-core";
import {
  DIRECT_VERTEX_SHADER,
  DIRECT_FRAGMENT_SHADER,
  directAdjustmentTypeIdOrDefault,
  packDirectAdjustmentUniforms,
  type DirectAdjustmentType,
} from "./gpu/adjustmentShadersDirect";
import { LUT_3D_SIZE, bakeColorLookup3D } from "./gpu/colorLookup3dLut";
import {
  BLEND_STACK_VERTEX_SHADER,
  BLEND_STACK_FRAGMENT_SHADER,
  GPU_BLEND_MODE_ID,
  demoteBlendMode,
} from "./gpu/gpuBlendShaders";
import type { ExtendedBlendMode } from "../types";

/**
 * One tile in a GPU composite job. `buffer` is present when the tile
 * must be (re)uploaded this job (a "dirty" tile). An ABSENT `buffer`
 * means "reuse whatever the pool already has cached for (layerId,
 * level, tileKey) if its rev still matches" (a "clean" tile) — F02,
 * mememaker-rendering-rewrite-phase-4-gpu-compositor, protocol v2: a
 * referenced-but-uncached tile (evicted, or a freshly (re)built pool
 * after context loss) makes the WHOLE job fail with a `cacheCold` reply
 * — see `compositeJobV2` below — never a silently wrong/blank draw.
 */
export interface GpuCompositeTile {
  layerId: string;
  level: number;
  tx: number;
  ty: number;
  rev: number;
  buffer?: ArrayBuffer;
}

export interface GpuCompositeJob {
  id: number;
  tileSize: number;
  rectInLevelSpace: { x: number; y: number; width: number; height: number };
  outputWidth: number;
  outputHeight: number;
  tiles: GpuCompositeTile[];
  /** F03, mememaker-rendering-rewrite-phase-4-gpu-compositor — an
   *  optional post-reassembly LUT pass (see lib/adjustmentLut.ts, the
   *  single source of truth for both the bake and the sampling
   *  semantics this worker's LUT fragment shader below must match
   *  EXACTLY — `applyLutPassReference` in that file is the same
   *  arithmetic, kept textually adjacent so drift is reviewable).
   *  Applied ONCE to the whole composited layer, never per-tile (the
   *  LUT is pointwise, so pass order vs. tile reassembly is visually
   *  equivalent — running it once here is strictly cheaper). */
  adjustmentLut?: { data: Uint8Array; mode: "perChannel" | "lumaIndexed" };
  /** F04, mememaker-rendering-rewrite-phase-4-gpu-compositor — an optional
   *  post-reassembly direct-GLSL adjustment pass, for the 7
   *  WorkerAdjustmentType members F03's 1D-LUT mechanism cannot express
   *  (see lib/gpu/adjustmentShadersDirect.ts, the single source of truth
   *  for both the uniform packing and the shader math). Carries the SAME
   *  `{type, params, fgColor, bgColor}` shape `adjustmentFilterDispatch.ts`'s
   *  `buildAdjustmentFilter` takes — deliberately NOT pre-packed into a
   *  `Float32Array` here, so this one wire shape serves BOTH backends: the
   *  GPU worker packs uniforms itself (`packDirectAdjustmentUniforms`)
   *  right before drawing; the CPU fallback (`tileCompositorWorker.ts`)
   *  calls `buildAdjustmentFilter` directly with `params` unchanged — no
   *  backend-specific pre-processing leaks into the client/AdjustedRun.tsx
   *  call site. Mutually exclusive with `adjustmentLut`/`colorLookup3d` in
   *  practice (one job composites exactly one adjustment layer's worth of
   *  bypass), but not enforced here — the dispatch order below (LUT, then
   *  direct, then colorLookup) is what would apply if more than one were
   *  ever set. */
  directAdjustment?: {
    type: string;
    params: unknown;
    fgColor: string;
    bgColor: string;
  };
  /** F04 — colorLookup's own GPU mechanism (see lib/gpu/colorLookup3dLut.ts).
   *  Carries only `lookId`/`dither` (NOT the baked lattice) — baking is
   *  cheap-and-cached by `lookId`, so each backend bakes (or, for the CPU
   *  fallback, just runs the real pipeline directly) independently rather
   *  than shipping ~107KB of baked bytes over the wire on every job. */
  colorLookup3d?: { lookId: string; dither: boolean };
}

export type GpuCompositeReply =
  | { id: number; ok: true; bitmap: ImageBitmap; backend: "gpu" | "cpu" }
  | {
      id: number;
      ok: false;
      error: string;
      /** F02 protocol-v2: true when the failure is specifically "one or
       *  more referenced clean tiles aren't in the pool's cache" — the
       *  caller's signal to clear its ledger and retry with full
       *  buffers, distinct from any other compute error. */
      cacheCold?: boolean;
      missing?: string[];
    };

/**
 * F06, mememaker-rendering-rewrite-phase-4-gpu-compositor — one member of
 * a GPU-eligible contiguous layer run (see `gpuStackEligibility.ts`).
 * `tiles` is that ONE layer's own tile set for the run's shared rect —
 * same shape/semantics as `GpuCompositeJob.tiles`, just grouped per
 * logical run-member instead of one flat list, since each member needs
 * its OWN reassembled raster before cross-layer blending can run.
 * `maskBuffer` (mememaker-gpu-mask-compositing F02) is an optional RGBA8
 * gray-replicated mask buffer at `outputWidth × outputHeight`, produced by
 * `resampleMaskToGrayRgbaRect` (`maskRunResample.ts`) — when present,
 * `compositeStackRunGpu` uploads it as a per-iteration texture bound at
 * `TEXTURE2`, activating the blend shader's `u_mask`/`u_hasMask` sampling.
 * Still unreachable from real production traffic until
 * `gpuStackEligibility.ts`'s masked-layer exclusion is relaxed
 * (mememaker-gpu-mask-compositing F03) — this feature is exercised only
 * by tests constructing a `StackRunJob` directly.
 */
export interface StackRunJobLayer {
  tiles: GpuCompositeTile[];
  blendMode: ExtendedBlendMode;
  opacity: number;
  dissolveSeed?: number;
  maskBuffer?: ArrayBuffer;
}

export interface StackRunJob {
  kind: "stackRun";
  id: number;
  tileSize: number;
  rectInLevelSpace: { x: number; y: number; width: number; height: number };
  outputWidth: number;
  outputHeight: number;
  /** Bottom -> top z-order, matching `TiledRun.layerIds`'s own order. */
  layers: StackRunJobLayer[];
}

export type StackRunReply =
  | { id: number; ok: true; bitmap: ImageBitmap }
  | {
      id: number;
      ok: false;
      error: string;
      cacheCold?: boolean;
      missing?: string[];
    };

// ---------------------------------------------------------------------------
// Backend state (module-level singleton — one worker, one backend at a time).
//
// Two independent pieces of state, deliberately NOT rebuilt together:
//  - `CanvasState` (canvas + gl + its context-loss listeners): created
//    ONCE per worker lifetime (until permanently pinned to CPU). A real
//    WebGL2 context genuinely SURVIVES a contextlost/contextrestored
//    cycle — that is the entire point of the restore event — so creating
//    a brand-new OffscreenCanvas on every restore would (a) defeat that
//    semantics and (b) leave the OLD canvas's listeners still registered
//    (nothing in this file drops the only reference a browser's
//    GPU/compositor process may keep to a canvas with live context-loss
//    listeners), so a stray event on the abandoned canvas could later
//    desync `contextLossCount`/`glState` out from under a newer, live
//    canvas — a real doubt-driven-review finding, fixed by never
//    constructing a second canvas for the same worker session.
//  - `GlResources` (program/pool/buffers/uniform locations): rebuilt
//    from scratch on EVERY cold init AND every restore — GPU-side
//    objects (textures, programs, buffers) do NOT survive a context
//    loss even though the JS `WebGL2RenderingContext` object and canvas
//    do.
// ---------------------------------------------------------------------------
interface CanvasState {
  canvas: OffscreenCanvas;
  gl: WebGL2RenderingContext;
}

interface GlResources {
  pool: ReturnType<typeof createGpuTilePool>;
  program: WebGLProgram;
  quadBuffer: WebGLBuffer;
  instanceBuffer: WebGLBuffer;
  uOutputSize: WebGLUniformLocation | null;
  uTileSize: WebGLUniformLocation | null;
  uTiles: WebGLUniformLocation | null;
  /** F03 — the optional post-reassembly LUT pass's own program. Reuses
   *  `quadBuffer` above (same unit-square attribute) — no separate
   *  buffer needed. */
  lutProgram: WebGLProgram;
  uLutSource: WebGLUniformLocation | null;
  uLutTexture: WebGLUniformLocation | null;
  uLutMode: WebGLUniformLocation | null;
  /** F04 — the direct-GLSL adjustment mega-shader's own program (see
   *  lib/gpu/adjustmentShadersDirect.ts). Reuses `quadBuffer`, same as
   *  `lutProgram`. */
  directProgram: WebGLProgram;
  uDirectSource: WebGLUniformLocation | null;
  uDirectType: WebGLUniformLocation | null;
  uDirectParams: WebGLUniformLocation | null;
  /** F04 — colorLookup's own TEXTURE_3D sampling program. */
  colorLookup3dProgram: WebGLProgram;
  uCl3dSource: WebGLUniformLocation | null;
  uCl3dLut: WebGLUniformLocation | null;
  uCl3dSize: WebGLUniformLocation | null;
  uCl3dDither: WebGLUniformLocation | null;
  uCl3dOffset: WebGLUniformLocation | null;
  /** F06 — the cross-layer stack-run blend pass's own program. Reuses
   *  `quadBuffer`, same as `lutProgram`/`directProgram`. */
  blendStackProgram: WebGLProgram;
  uBlendBackdrop: WebGLUniformLocation | null;
  uBlendLayer: WebGLUniformLocation | null;
  uBlendMask: WebGLUniformLocation | null;
  uBlendHasMask: WebGLUniformLocation | null;
  uBlendOpacity: WebGLUniformLocation | null;
  uBlendMode: WebGLUniformLocation | null;
  uBlendDissolveSeed: WebGLUniformLocation | null;
}

interface GlState extends GlResources {
  gl: WebGL2RenderingContext;
  canvas: OffscreenCanvas;
}

let canvasState: CanvasState | null = null;
let glState: GlState | null = null;
let gpuUnavailable = false;
/** True between a `webglcontextlost` event and its matching
 *  `webglcontextrestored` (or permanently, once pinned) — subsequent jobs
 *  route to CPU while true, distinct from `gpuUnavailable`'s PERMANENT
 *  pin after the two-strike threshold. */
let contextLost = false;
let contextLossCount = 0;
let warnedOnce = false;

function warnFallbackOnce(reason: unknown): void {
  if (warnedOnce) return;
  warnedOnce = true;
  console.warn(
    "[MemeMaker] GPU tile compositor unavailable/pinned — falling back to CPU compositing in this worker for the rest of the session.",
    reason,
  );
}

const VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec2 a_tileOrigin;
layout(location = 2) in float a_slice;
uniform vec2 u_outputSize;
uniform float u_tileSize;
flat out float v_slice;
out vec2 v_uv;
void main() {
  vec2 pos = a_tileOrigin + a_corner * u_tileSize;
  vec2 clip = (pos / u_outputSize) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_uv = a_corner;
  v_slice = a_slice;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2DArray;
flat in float v_slice;
in vec2 v_uv;
uniform sampler2DArray u_tiles;
out vec4 outColor;
void main() {
  outColor = texture(u_tiles, vec3(v_uv, v_slice));
}`;

// F03, mememaker-rendering-rewrite-phase-4-gpu-compositor — LUT pass
// shaders. Full-screen quad reusing the SAME unit-square [0,1]x[0,1]
// vertex buffer as the tile-reassembly pass (location 0, a_corner) —
// only the vertex transform is shared; this pass needs no per-instance
// attributes. `gl_FragCoord.xy` (not an interpolated UV) drives BOTH
// texelFetch calls below — always exact, no half-texel alignment risk
// for a 1:1 source/destination blit, unlike `texture()`'s bilinear
// sampling which could interpolate across texel boundaries for a UV not
// landing EXACTLY on a texel center.
const LUT_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 a_corner;
void main() {
  vec2 clip = a_corner * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

// Semantics MUST match lib/adjustmentLut.ts's applyLutPassReference
// exactly — that function is the reviewable TS mirror of this shader,
// kept in the same repo for drift detection. u_lut is a 256x1 texture,
// NEAREST-filtered but sampled via texelFetch (bypasses filtering
// entirely by construction — arithmetic-free integer indexing, exactly
// why applyLutPassReference can stand in for this shader in tests that
// can't run real WebGL2). u_mode: 0 = perChannel (each channel
// independently indexes the LUT with its OWN byte value), 1 =
// lumaIndexed (Rec.601 luma indexes ONE lut entry, whose .a is a
// compositing WEIGHT against the source pixel's own color — never the
// pixel's real alpha, which passes through untouched in both modes,
// matching every source CPU filter's own alpha discipline).
const LUT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_source;
uniform sampler2D u_lut;
uniform int u_mode;
out vec4 outColor;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 src = texelFetch(u_source, p, 0);
  if (u_mode == 0) {
    int ri = int(src.r * 255.0 + 0.5);
    int gi = int(src.g * 255.0 + 0.5);
    int bi = int(src.b * 255.0 + 0.5);
    float r = texelFetch(u_lut, ivec2(ri, 0), 0).r;
    float g = texelFetch(u_lut, ivec2(gi, 0), 0).g;
    float b = texelFetch(u_lut, ivec2(bi, 0), 0).b;
    outColor = vec4(r, g, b, src.a);
  } else {
    float luma = 0.299 * src.r + 0.587 * src.g + 0.114 * src.b;
    int idx = int(clamp(luma * 255.0 + 0.5, 0.0, 255.0));
    vec4 lutv = texelFetch(u_lut, ivec2(idx, 0), 0);
    outColor = vec4(mix(src.rgb, lutv.rgb, lutv.a), src.a);
  }
}`;

// F04, mememaker-rendering-rewrite-phase-4-gpu-compositor — colorLookup's
// own TEXTURE_3D sampling pass. `u_lut3d` is the pre-baked N^3 identity-
// lattice bake (lib/gpu/colorLookup3dLut.ts) — LINEAR-filtered so the
// hardware trilinearly interpolates between the 33^3 grid points, at
// half-texel-inset coordinates (the standard 3D-LUT sampling formula:
// index i in [0,N-1] maps to texel CENTER (i+0.5)/N, so `rgb*(N-1)+0.5)/N`
// lands exactly on grid points for values that ARE grid-aligned and
// interpolates correctly in between). Dither ports
// `gradientMapFilter.ts`'s `bayerDitherOffset` (the ONE ordered-dither
// primitive in this codebase) directly into GLSL, applied AFTER the 3D
// sample — exactly where `colorLookupFilter.ts`'s own
// `applyColorLookupDither` runs it, post-pipeline. `u_coordOffset` carries
// this job's `rectInLevelSpace.x/y` so the dither's (x,y) phase matches
// what the CPU path would compute for the SAME pixel in full-image space
// — an accepted, documented approximation (not exact for a GPU-tiled crop
// vs. a CPU monolithic cache raster at a DIFFERENT mip level; the parity
// harness's own ±3 LSB colorLookup budget already accounts for
// interpolation error, and a dither-phase mismatch is bounded by the same
// +/-4-level Bayer strength either way).
const COLOR_LOOKUP_3D_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler2D u_source;
uniform sampler3D u_lut3d;
uniform float u_size;
uniform int u_dither;
uniform vec2 u_coordOffset;
out vec4 outColor;
const int BAYER4[16] = int[16](0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5);
float bayerDitherOffset(int x, int y, float strength) {
  int idx = (y & 3) * 4 + (x & 3);
  return ((float(BAYER4[idx]) + 0.5) / 16.0 - 0.5) * strength;
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 src = texelFetch(u_source, p, 0);
  vec3 uvw = (src.rgb * (u_size - 1.0) + 0.5) / u_size;
  vec3 sampled = texture(u_lut3d, uvw).rgb;
  if (u_dither != 0) {
    int gx = p.x + int(u_coordOffset.x);
    int gy = p.y + int(u_coordOffset.y);
    float offset = bayerDitherOffset(gx, gy, 8.0) / 255.0;
    sampled = clamp(sampled + vec3(offset), 0.0, 1.0);
  }
  outColor = vec4(sampled, src.a);
}`;

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("[tileCompositorGpuWorker] createShader failed");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`[tileCompositorGpuWorker] shader compile failed: ${log}`);
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string = VERTEX_SHADER,
  fragmentSource: string = FRAGMENT_SHADER,
): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program)
    throw new Error("[tileCompositorGpuWorker] createProgram failed");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`[tileCompositorGpuWorker] program link failed: ${log}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
}

/** Called ONCE per worker session (never on restore — see file header).
 *  Creates the canvas + WebGL2 context and registers its context-loss
 *  listeners for the lifetime of this worker. */
function createCanvasState(): CanvasState | null {
  if (typeof OffscreenCanvas === "undefined") return null;
  const canvas = new OffscreenCanvas(1, 1);
  let gl: WebGL2RenderingContext | null = null;
  try {
    // premultipliedAlpha:false is REQUIRED for CPU parity, not cosmetic:
    // the default (true) tells the browser the drawing buffer holds
    // premultiplied color, so transferToImageBitmap()'s readback
    // un-premultiplies (divides RGB by alpha) on every partially-
    // transparent pixel. Tile data is uploaded straight-alpha (raw
    // Tile.data, matching the CPU path's ImageData/putImageData bytes
    // exactly) and the fragment shader never premultiplies it — with the
    // default true, readback would silently diverge from the CPU path's
    // byte-for-byte parity bar for any tile with alpha < 255.
    gl = canvas.getContext("webgl2", {
      premultipliedAlpha: false,
    }) as WebGL2RenderingContext | null;
  } catch {
    gl = null;
  }
  if (!gl) return null;

  canvas.addEventListener("webglcontextlost", (e: Event) => {
    e.preventDefault(); // required to permit restoration
    contextLossCount++;
    contextLost = true;
    // GPU-side objects (program/pool/textures/buffers) do not survive a
    // loss even though the canvas/gl themselves do — drop only those.
    glState = null;
    if (contextLossCount >= 2) {
      gpuUnavailable = true; // permanent pin — future restores are ignored
      warnFallbackOnce("context lost twice in one worker session");
      canvasState = null; // release the canvas/gl too — GPU is done for this session
    }
  });
  canvas.addEventListener("webglcontextrestored", () => {
    if (gpuUnavailable) return; // pinned to CPU after >=2 losses — stay pinned
    contextLost = false;
    // Same canvas, same gl — only GPU-side resources need rebuilding.
    try {
      glState = { gl, canvas, ...buildGlResources(gl) };
    } catch (err) {
      gpuUnavailable = true;
      warnFallbackOnce(err);
    }
  });

  return { canvas, gl };
}

/** Rebuilds every GPU-side resource (program, tile pool, buffers) —
 *  called on cold init AND after every restore, since none of these
 *  survive a context loss. */
function buildGlResources(gl: WebGL2RenderingContext): GlResources {
  const maxTextureSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0);
  if (maxTextureSize > 0 && TILE_SIZE > maxTextureSize) {
    // Defensive only — TILE_SIZE (256) is far below any WebGL2-guaranteed
    // minimum (1024); this can never trip on a real conformant driver.
    throw new Error(
      `[tileCompositorGpuWorker] TILE_SIZE (${TILE_SIZE}) exceeds this device's MAX_TEXTURE_SIZE (${maxTextureSize})`,
    );
  }

  const program = createProgram(gl);
  const pool = createGpuTilePool(gl);

  const quadBuffer = gl.createBuffer();
  if (!quadBuffer)
    throw new Error("[tileCompositorGpuWorker] createBuffer (quad) failed");
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  // Two triangles covering the unit square [0,1]x[0,1].
  // prettier-ignore
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
    gl.STATIC_DRAW,
  );

  const instanceBuffer = gl.createBuffer();
  if (!instanceBuffer)
    throw new Error("[tileCompositorGpuWorker] createBuffer (instance) failed");

  const lutProgram = createProgram(gl, LUT_VERTEX_SHADER, LUT_FRAGMENT_SHADER);
  const directProgram = createProgram(
    gl,
    DIRECT_VERTEX_SHADER,
    DIRECT_FRAGMENT_SHADER,
  );
  const colorLookup3dProgram = createProgram(
    gl,
    DIRECT_VERTEX_SHADER, // same trivial full-screen-quad vertex shader
    COLOR_LOOKUP_3D_FRAGMENT_SHADER,
  );
  const blendStackProgram = createProgram(
    gl,
    BLEND_STACK_VERTEX_SHADER,
    BLEND_STACK_FRAGMENT_SHADER,
  );

  return {
    pool,
    program,
    quadBuffer,
    instanceBuffer,
    uOutputSize: gl.getUniformLocation(program, "u_outputSize"),
    uTileSize: gl.getUniformLocation(program, "u_tileSize"),
    uTiles: gl.getUniformLocation(program, "u_tiles"),
    lutProgram,
    uLutSource: gl.getUniformLocation(lutProgram, "u_source"),
    uLutTexture: gl.getUniformLocation(lutProgram, "u_lut"),
    uLutMode: gl.getUniformLocation(lutProgram, "u_mode"),
    directProgram,
    uDirectSource: gl.getUniformLocation(directProgram, "u_source"),
    uDirectType: gl.getUniformLocation(directProgram, "u_type"),
    uDirectParams: gl.getUniformLocation(directProgram, "u_p"),
    colorLookup3dProgram,
    uCl3dSource: gl.getUniformLocation(colorLookup3dProgram, "u_source"),
    uCl3dLut: gl.getUniformLocation(colorLookup3dProgram, "u_lut3d"),
    uCl3dSize: gl.getUniformLocation(colorLookup3dProgram, "u_size"),
    uCl3dDither: gl.getUniformLocation(colorLookup3dProgram, "u_dither"),
    uCl3dOffset: gl.getUniformLocation(colorLookup3dProgram, "u_coordOffset"),
    blendStackProgram,
    uBlendBackdrop: gl.getUniformLocation(blendStackProgram, "u_backdrop"),
    uBlendLayer: gl.getUniformLocation(blendStackProgram, "u_layer"),
    uBlendMask: gl.getUniformLocation(blendStackProgram, "u_mask"),
    uBlendHasMask: gl.getUniformLocation(blendStackProgram, "u_hasMask"),
    uBlendOpacity: gl.getUniformLocation(blendStackProgram, "u_opacity"),
    uBlendMode: gl.getUniformLocation(blendStackProgram, "u_mode"),
    uBlendDissolveSeed: gl.getUniformLocation(
      blendStackProgram,
      "u_dissolveSeed",
    ),
  };
}

/** Lazy GPU init at first job — try-create, never UA-sniffing. */
function ensureGpu(): GlState | null {
  if (gpuUnavailable) return null;
  if (contextLost) return null; // lost, not yet restored — route to CPU until restore fires
  if (glState) return glState;
  if (!canvasState) {
    canvasState = createCanvasState();
    if (!canvasState) {
      gpuUnavailable = true;
      warnFallbackOnce("WebGL2 context creation failed");
      return null;
    }
  }
  try {
    glState = {
      gl: canvasState.gl,
      canvas: canvasState.canvas,
      ...buildGlResources(canvasState.gl),
    };
  } catch (err) {
    gpuUnavailable = true;
    warnFallbackOnce(err);
    return null;
  }
  return glState;
}

interface TileGroups {
  groups: Map<number, { originX: number; originY: number; slice: number }[]>;
  missing: string[];
}

/**
 * F06 refactor (extracted from `compositeJobGpu`, byte-for-byte the same
 * logic, now reused by `compositeStackRunGpu` for EACH run member's own
 * tile set) — resolves one layer's tile list against the pool, grouped by
 * GPU texture array. `beginBatch()`/`endBatch()` remain the CALLER's
 * responsibility so a caller resolving MULTIPLE layers' tiles for one job
 * (the stack-run case) can bracket all of them in a SINGLE batch — see
 * `compositeStackRunGpu`'s own comment for why that matters exactly the
 * same way the original single-layer job's intra-job eviction-safety
 * rationale did.
 */
function resolveTileGroups(
  state: GlState,
  tiles: GpuCompositeTile[],
  tileSize: number,
  rect: { x: number; y: number },
): TileGroups {
  const groups = new Map<
    number,
    { originX: number; originY: number; slice: number }[]
  >();
  const missing: string[] = [];
  for (const t of tiles) {
    let ref;
    if (t.buffer) {
      const data = new Uint8ClampedArray(t.buffer);
      const tile = publishTile(data, t.rev);
      ref = state.pool.ensureTile(t.layerId, t.level, t.tx, t.ty, tile);
    } else {
      // F02 protocol-v2 "clean tile" reference: no pixel data was
      // sent, only a claimed rev. peekTile is read-only — a miss
      // (absent, or rev mismatch) must NEVER be treated as "draw
      // nothing here" (a silently wrong composite); it's collected
      // and turned into a whole-job cacheCold reply instead.
      ref = state.pool.peekTile(t.layerId, t.level, t.tx, t.ty, t.rev);
      if (!ref) {
        missing.push(tileKey(t.tx, t.ty));
        continue;
      }
    }
    const originX = t.tx * tileSize - rect.x;
    const originY = t.ty * tileSize - rect.y;
    const list = groups.get(ref.arrayIndex) ?? [];
    list.push({ originX, originY, slice: ref.slice });
    groups.set(ref.arrayIndex, list);
  }
  return { groups, missing };
}

/**
 * F06 refactor — draws already-resolved tile groups (from
 * `resolveTileGroups`) into WHATEVER framebuffer is currently bound
 * (the default framebuffer for the original single-layer job; an
 * off-screen render-target FBO for a stack-run member's own raster
 * reassembly pass). Caller owns `gl.viewport`/clear/`gl.disable(BLEND)`
 * — this function only binds `state.program` and issues the instanced
 * draw calls, exactly the loop `compositeJobGpu` used to run directly.
 */
function drawTileGroupsToBoundFramebuffer(
  state: GlState,
  groups: TileGroups["groups"],
  outputWidth: number,
  outputHeight: number,
  tileSize: number,
): void {
  const { gl } = state;
  gl.useProgram(state.program);
  gl.uniform2f(state.uOutputSize, outputWidth, outputHeight);
  gl.uniform1f(state.uTileSize, tileSize);
  gl.uniform1i(state.uTiles, 0);
  gl.activeTexture(gl.TEXTURE0);

  gl.bindBuffer(gl.ARRAY_BUFFER, state.quadBuffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(0, 0);

  for (const [arrayIndex, tiles] of groups) {
    const instanceData = new Float32Array(tiles.length * 3);
    tiles.forEach((t, i) => {
      instanceData[i * 3] = t.originX;
      instanceData[i * 3 + 1] = t.originY;
      instanceData[i * 3 + 2] = t.slice;
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, state.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, instanceData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 12, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 12, 8);
    gl.vertexAttribDivisor(2, 1);

    state.pool.bindArrayForDraw(arrayIndex);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, tiles.length);
  }
}

async function compositeJobGpu(
  state: GlState,
  job: GpuCompositeJob,
): Promise<GpuCompositeReply> {
  const { gl } = state;
  if (gl.isContextLost()) {
    // Currently unreachable in practice: `compositeJob`'s `ensureGpu()`
    // check and this function run in the same synchronous stretch (zero
    // `await` between them, and none inside this function's own body),
    // so no event-loop turn exists for a `webglcontextlost` event to
    // land in between. Kept anyway as a cheap, correct guard against any
    // future refactor that introduces an `await` in that path — asking
    // the context itself is strictly more trustworthy than the
    // `contextLost` flag it would otherwise silently stop tracking.
    throw new Error("[tileCompositorGpuWorker] WebGL2 context is lost");
  }
  const { id, outputWidth, outputHeight, rectInLevelSpace: rect } = job;

  // beginBatch()/endBatch() bracket every ensureTile()/peekTile() call
  // THIS job makes — required (see GpuTilePool.beginBatch's doc
  // comment): without it, a job whose own distinct-tile count exceeds
  // the pool's slice budget could have a later ensureTile() in this SAME
  // loop evict an earlier tile this loop already resolved a SliceRef for
  // into `groups`, silently repointing that earlier entry at a slice
  // that now holds a DIFFERENT tile's pixels — a real doubt-driven-
  // review finding (intra-job eviction corruption), not just a slower
  // cross-job cache miss. try/finally so any mid-loop throw still
  // releases the batch.
  state.pool.beginBatch();
  let groups: TileGroups["groups"];
  let missing: string[];
  try {
    ({ groups, missing } = resolveTileGroups(
      state,
      job.tiles,
      job.tileSize,
      rect,
    ));
  } finally {
    state.pool.endBatch();
  }
  if (missing.length > 0) {
    // Whole-job failure, matching tileCompositorWorker.ts's v2
    // semantics exactly: never partially composite with a hole where a
    // stale/evicted clean-tile reference should have been.
    return { id, ok: false, error: "cache-cold", cacheCold: true, missing };
  }

  state.canvas.width = outputWidth;
  state.canvas.height = outputHeight;
  gl.viewport(0, 0, outputWidth, outputHeight);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  // Blending deliberately DISABLED: tiles are non-overlapping single-write
  // regions (each output pixel belongs to exactly one tile), so the exact
  // parity bar this file's header documents — byte-comparable to the CPU
  // path's `putImageData` reassembly — means a direct overwrite of the
  // sampled (straight-alpha, unpremultiplied) texel, not an "over" blend.
  // `putImageData` itself bypasses canvas compositing entirely; blending
  // here (even a premultiplied-correct blendFunc) would still diverge
  // from that for any tile with alpha < 255, since there is nothing
  // meaningful to blend AGAINST (the destination is always the clear
  // color for every pixel a tile ever touches).
  gl.disable(gl.BLEND);
  drawTileGroupsToBoundFramebuffer(
    state,
    groups,
    outputWidth,
    outputHeight,
    job.tileSize,
  );

  if (job.adjustmentLut) {
    applyLutPassGpu(state, job.adjustmentLut, outputWidth, outputHeight);
  }
  if (job.directAdjustment) {
    const { type, params, fgColor, bgColor } = job.directAdjustment;
    const uniforms = packDirectAdjustmentUniforms(
      type as DirectAdjustmentType,
      params,
      fgColor,
      bgColor,
    );
    applyDirectAdjustmentPassGpu(
      state,
      { type, params: uniforms },
      outputWidth,
      outputHeight,
    );
  }
  if (job.colorLookup3d) {
    const data = bakeColorLookup3D(job.colorLookup3d.lookId);
    applyColorLookup3dPassGpu(
      state,
      { data, size: LUT_3D_SIZE, dither: job.colorLookup3d.dither },
      rect,
      outputWidth,
      outputHeight,
    );
  }

  const bitmap = state.canvas.transferToImageBitmap();
  return { id, ok: true, bitmap, backend: "gpu" };
}

/**
 * F03, mememaker-rendering-rewrite-phase-4-gpu-compositor — the optional
 * post-reassembly LUT pass. Runs ONCE per job (not per tile), over the
 * canvas the tile-reassembly draw above just finished writing.
 *
 * Approach: `copyTexImage2D` reads the JUST-DRAWN canvas (still bound as
 * the default framebuffer / read target) into a fresh 2D texture — this
 * sidesteps restructuring the tile-reassembly draw loop into an
 * FBO-parameterized function; it still draws straight to the canvas as
 * before, and this pass simply copies that result out, transforms it,
 * and draws the transformed result BACK onto the same canvas (the
 * default framebuffer stays the render target for both passes — no
 * intermediate FBO/attachment bookkeeping needed beyond the one temp
 * source texture). Both temp GL objects (source texture + LUT texture)
 * are per-job — the LUT's own bytes vary by job, so there is nothing
 * cacheable to keep across jobs; deleted at the end of this function
 * regardless of success, via try/finally.
 */
function applyLutPassGpu(
  state: GlState,
  lut: { data: Uint8Array; mode: "perChannel" | "lumaIndexed" },
  outputWidth: number,
  outputHeight: number,
): void {
  const { gl } = state;
  const sourceTex = gl.createTexture();
  const lutTex = gl.createTexture();
  if (!sourceTex || !lutTex) {
    if (sourceTex) gl.deleteTexture(sourceTex);
    if (lutTex) gl.deleteTexture(lutTex);
    throw new Error(
      "[tileCompositorGpuWorker] applyLutPassGpu: createTexture failed",
    );
  }
  try {
    // Copy the just-drawn canvas content out into a real texture so the
    // LUT fragment shader can texelFetch it while ALSO writing to the
    // same canvas (a texture can never be simultaneously bound as its
    // own render target — copyTexImage2D is the standard way around
    // that without a second FBO).
    gl.bindTexture(gl.TEXTURE_2D, sourceTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.copyTexImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      0,
      0,
      outputWidth,
      outputHeight,
      0,
    );

    gl.bindTexture(gl.TEXTURE_2D, lutTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      256,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      lut.data,
    );

    gl.viewport(0, 0, outputWidth, outputHeight);
    gl.disable(gl.BLEND); // direct replace — same parity rationale as the tile pass above
    gl.useProgram(state.lutProgram);
    gl.uniform1i(state.uLutSource, 0);
    gl.uniform1i(state.uLutTexture, 1);
    gl.uniform1i(state.uLutMode, lut.mode === "perChannel" ? 0 : 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sourceTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, lutTex);

    // Reuses the SAME unit-square buffer as the tile pass — only
    // location 0 (a_corner) is read; the per-instance attributes (1, 2)
    // from the tile pass stay bound to their old buffer/divisor state,
    // but this program's vertex shader never declares those locations,
    // so they're simply unused, not a correctness hazard.
    gl.bindBuffer(gl.ARRAY_BUFFER, state.quadBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  } finally {
    gl.deleteTexture(sourceTex);
    gl.deleteTexture(lutTex);
  }
}

/** Shared by every post-reassembly pass (LUT above, direct-GLSL and
 *  colorLookup3d below): copies the just-drawn canvas into a fresh 2D
 *  texture so a fragment shader can sample it while ALSO writing to the
 *  same canvas — see `applyLutPassGpu`'s own header comment for why
 *  `copyTexImage2D` (not a second FBO) is this file's established
 *  technique. Caller owns the returned texture's lifetime (delete it). */
function copySourceCanvasToTexture(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) {
    throw new Error(
      "[tileCompositorGpuWorker] copySourceCanvasToTexture: createTexture failed",
    );
  }
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 0, 0, width, height, 0);
  return tex;
}

/** F04, mememaker-rendering-rewrite-phase-4-gpu-compositor — the direct-
 *  GLSL adjustment mega-shader pass (see lib/gpu/adjustmentShadersDirect.ts).
 *  Same post-reassembly-pass shape as `applyLutPassGpu`. */
function applyDirectAdjustmentPassGpu(
  state: GlState,
  direct: { type: string; params: Float32Array },
  outputWidth: number,
  outputHeight: number,
): void {
  const { gl } = state;
  const sourceTex = copySourceCanvasToTexture(gl, outputWidth, outputHeight);
  try {
    gl.viewport(0, 0, outputWidth, outputHeight);
    gl.disable(gl.BLEND);
    gl.useProgram(state.directProgram);
    gl.uniform1i(state.uDirectSource, 0);
    const typeId = directAdjustmentTypeIdOrDefault(direct.type);
    gl.uniform1i(state.uDirectType, typeId);
    gl.uniform4fv(state.uDirectParams, direct.params);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sourceTex);

    gl.bindBuffer(gl.ARRAY_BUFFER, state.quadBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  } finally {
    gl.deleteTexture(sourceTex);
  }
}

/** F04 — colorLookup's own TEXTURE_3D sampling pass (see
 *  lib/gpu/colorLookup3dLut.ts). `u_coordOffset` carries this job's
 *  `rectInLevelSpace.x/y` so the in-shader dither's (x,y) phase is derived
 *  from the SAME rect the caller already threads through every other
 *  per-job crop calculation — see the shader's own header comment for the
 *  accepted-approximation rationale. */
function applyColorLookup3dPassGpu(
  state: GlState,
  cl3d: { data: Uint8Array; size: number; dither: boolean },
  rect: { x: number; y: number },
  outputWidth: number,
  outputHeight: number,
): void {
  const { gl } = state;
  const sourceTex = copySourceCanvasToTexture(gl, outputWidth, outputHeight);
  const lutTex = gl.createTexture();
  if (!lutTex) {
    gl.deleteTexture(sourceTex);
    throw new Error(
      "[tileCompositorGpuWorker] applyColorLookup3dPassGpu: createTexture failed",
    );
  }
  try {
    gl.bindTexture(gl.TEXTURE_3D, lutTex);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    // RGB8 is 3 bytes/texel — the default UNPACK_ALIGNMENT (4) would
    // misread every row whose byte length isn't a multiple of 4 (33*3=99
    // for this bake's own LUT_3D_SIZE); 1 is always correct regardless of
    // row size, restored after upload so it never leaks into any other
    // texture upload this worker does.
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage3D(
      gl.TEXTURE_3D,
      0,
      gl.RGB8,
      cl3d.size,
      cl3d.size,
      cl3d.size,
      0,
      gl.RGB,
      gl.UNSIGNED_BYTE,
      cl3d.data,
    );
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);

    gl.viewport(0, 0, outputWidth, outputHeight);
    gl.disable(gl.BLEND);
    gl.useProgram(state.colorLookup3dProgram);
    gl.uniform1i(state.uCl3dSource, 0);
    gl.uniform1i(state.uCl3dLut, 1);
    gl.uniform1f(state.uCl3dSize, cl3d.size);
    gl.uniform1i(state.uCl3dDither, cl3d.dither ? 1 : 0);
    gl.uniform2f(state.uCl3dOffset, rect.x, rect.y);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sourceTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_3D, lutTex);

    gl.bindBuffer(gl.ARRAY_BUFFER, state.quadBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  } finally {
    gl.deleteTexture(sourceTex);
    gl.deleteTexture(lutTex);
  }
}

/** Adapts tileCompositorWorker.ts's CPU compositeJob (which takes
 *  TileCompositeTile[] with x/y/width/height/key/rev/buffer?) to this
 *  worker's GpuCompositeTile[] shape. F02, mememaker-rendering-rewrite-
 *  phase-4-gpu-compositor: forwards the ORIGINAL v2 shape (including
 *  buffer-omitted "clean tile" references) rather than forcing a full
 *  resend — the CPU worker has its OWN, entirely separate tile cache, so
 *  a clean-tile reference this GPU worker doesn't have cached might
 *  still be a cache HIT on the CPU worker's side (e.g. flag toggled mid-
 *  investigation across a reload, or a prior CPU-fallback job already
 *  warmed it); when it isn't, the CPU worker's own compositeJob reports
 *  cacheCold exactly like any other v2 caller, and the CLIENT's existing
 *  retry-with-full-buffers path (tileCompositorClient.ts) handles it —
 *  no special-casing needed here. `layerId`/`level` are derived from the
 *  first tile (every tile in one job shares them; a job's own tiles are
 *  homogeneous by construction — see tiledLayerBitmapController.ts). */
async function compositeJobCpuAdapted(
  job: GpuCompositeJob,
): Promise<GpuCompositeReply> {
  // No tiles at all is a degenerate-but-valid case (an empty viewport
  // crop, e.g.) — "" / 0 are inert placeholders since there's nothing to
  // cache under them either way.
  const first = job.tiles[0];
  const cpuJob: TileCompositeJob = {
    id: job.id,
    protocolVersion: 2,
    layerId: first?.layerId ?? "",
    level: first?.level ?? 0,
    tileSize: job.tileSize,
    rectInLevelSpace: job.rectInLevelSpace,
    outputWidth: job.outputWidth,
    outputHeight: job.outputHeight,
    tiles: job.tiles.map((t) => ({
      x: t.tx * job.tileSize,
      y: t.ty * job.tileSize,
      width: job.tileSize,
      height: job.tileSize,
      key: tileKey(t.tx, t.ty),
      rev: t.rev,
      buffer: t.buffer,
    })),
    adjustmentLut: job.adjustmentLut,
    directAdjustment: job.directAdjustment,
    colorLookup3d: job.colorLookup3d,
  };
  const reply = await compositeJobCpu(cpuJob);
  if (!reply.ok) return reply;
  return { id: reply.id, ok: true, bitmap: reply.bitmap, backend: "cpu" };
}

/** Exported (mirrors tileCompositorWorker.ts's own convention) so this
 *  core logic is unit-testable without a real Worker/
 *  DedicatedWorkerGlobalScope — the onmessage wiring below is a thin
 *  wrapper around it. */
export async function compositeJob(
  job: GpuCompositeJob,
): Promise<GpuCompositeReply> {
  const state = ensureGpu();
  if (!state) return compositeJobCpuAdapted(job);
  try {
    return await compositeJobGpu(state, job);
  } catch (err) {
    // A compute-level GPU failure (not a context-loss event, which is
    // handled by the listener above) — never crash the job; fall back to
    // CPU for THIS job only. Does not by itself pin the session to CPU.
    console.warn(
      "[MemeMaker] GPU composite failed, falling back to CPU for this job",
      err,
    );
    return compositeJobCpuAdapted(job);
  }
}

/**
 * F02, mememaker-rendering-rewrite-phase-4-gpu-compositor — canonical
 * wire-protocol adapter: converts the SAME `TileCompositeJob` shape
 * tileCompositorClient.ts sends to tileCompositorWorker.ts (CPU) into
 * this worker's internal `GpuCompositeJob` shape and back. This is what
 * lets tileCompositorClient.ts's backend-selection be a plain "which
 * worker URL to construct" choice — both worker scripts speak the exact
 * same message shape, so the client's ledger/diffing/retry logic never
 * needs to know which backend it's talking to.
 */
export async function compositeJobV2(
  job: TileCompositeJob,
): Promise<TileCompositeReply> {
  if (job.layerId === undefined || job.level === undefined) {
    return {
      id: job.id,
      ok: false,
      error: "[tileCompositorGpuWorker] job missing layerId/level",
    };
  }
  const gpuJob: GpuCompositeJob = {
    id: job.id,
    tileSize: job.tileSize,
    rectInLevelSpace: job.rectInLevelSpace,
    outputWidth: job.outputWidth,
    outputHeight: job.outputHeight,
    tiles: job.tiles.map((t) => ({
      layerId: job.layerId!,
      level: job.level!,
      tx: Math.round(t.x / job.tileSize),
      ty: Math.round(t.y / job.tileSize),
      rev: t.rev ?? 0,
      buffer: t.buffer,
    })),
    adjustmentLut: job.adjustmentLut,
    directAdjustment: job.directAdjustment,
    colorLookup3d: job.colorLookup3d,
  };
  const reply = await compositeJob(gpuJob);
  return reply;
}

// ---------------------------------------------------------------------------
// F06, mememaker-rendering-rewrite-phase-4-gpu-compositor — cross-layer
// stack-run compositing. Every OTHER pass in this file (LUT, direct-GLSL,
// colorLookup3d) writes back onto the canvas/default-framebuffer via
// `copyTexImage2D`, because each is a SINGLE-source post-process over
// whatever the tile-reassembly draw just produced. This pass is
// different: it needs TWO independent inputs per step (the running
// accumulator AND the next layer's own raster) and WebGL2 forbids
// sampling a texture that's simultaneously bound as the current draw
// target (a feedback loop) — hence real off-screen render-target FBOs
// and ping-pong, not the `copyTexImage2D` trick the simpler passes use.
// ---------------------------------------------------------------------------

interface RenderTarget {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
}

/** RGBA8, NEAREST/CLAMP (matches this file's other texelFetch-only
 *  textures — filtering/wrap state is irrelevant to `texelFetch`, kept
 *  for consistency, not correctness). Caller deletes via
 *  `deleteRenderTarget` regardless of success. */
function createRenderTarget(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
): RenderTarget {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error(
      "[tileCompositorGpuWorker] createRenderTarget: createTexture failed",
    );
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA8,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );
  const framebuffer = gl.createFramebuffer();
  if (!framebuffer) {
    gl.deleteTexture(texture);
    throw new Error(
      "[tileCompositorGpuWorker] createRenderTarget: createFramebuffer failed",
    );
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0,
  );
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    gl.deleteFramebuffer(framebuffer);
    gl.deleteTexture(texture);
    throw new Error(
      `[tileCompositorGpuWorker] createRenderTarget: framebuffer incomplete (status ${status})`,
    );
  }
  return { texture, framebuffer };
}

function deleteRenderTarget(
  gl: WebGL2RenderingContext,
  rt: RenderTarget,
): void {
  gl.deleteFramebuffer(rt.framebuffer);
  gl.deleteTexture(rt.texture);
}

/**
 * Composites one GPU-eligible contiguous layer run (see
 * `gpuStackEligibility.ts`) into a SINGLE `ImageBitmap`. Structure:
 * 1. One shared `scratch` render target, reused sequentially: for each
 *    run member, its own tiles are reassembled into `scratch` (the exact
 *    same `resolveTileGroups`/`drawTileGroupsToBoundFramebuffer` this
 *    file's single-layer job path uses, just targeting an FBO instead of
 *    the canvas).
 * 2. Two ping-pong accumulator render targets (`accumA`/`accumB`).
 *    `accumA` starts cleared to transparent. Each member is blended via
 *    `blendStackProgram` (backdrop = current accumulator, layer =
 *    `scratch`) into the OTHER accumulator — except the FINAL member,
 *    which blends straight into the canvas's default framebuffer,
 *    saving one redundant copy.
 * 3. `transferToImageBitmap()` on the canvas, same as every other job
 *    type in this file.
 *
 * All tiles across ALL run members are resolved inside ONE
 * `beginBatch()`/`endBatch()` bracket — the same intra-job eviction-
 * safety rationale `compositeJobGpu` documents applies equally here: a
 * later member's `ensureTile()` must never evict a SliceRef an earlier
 * member already captured mid-resolution.
 */
async function compositeStackRunGpu(
  state: GlState,
  job: StackRunJob,
): Promise<StackRunReply> {
  const { gl } = state;
  if (gl.isContextLost()) {
    throw new Error("[tileCompositorGpuWorker] WebGL2 context is lost");
  }
  const {
    id,
    outputWidth,
    outputHeight,
    rectInLevelSpace: rect,
    tileSize,
  } = job;
  if (job.layers.length === 0) {
    return { id, ok: false, error: "stack run has zero layers" };
  }

  const perMemberGroups: TileGroups["groups"][] = [];
  const missing: string[] = [];
  state.pool.beginBatch();
  try {
    for (const member of job.layers) {
      const resolved = resolveTileGroups(state, member.tiles, tileSize, rect);
      perMemberGroups.push(resolved.groups);
      missing.push(...resolved.missing);
    }
  } finally {
    state.pool.endBatch();
  }
  if (missing.length > 0) {
    return { id, ok: false, error: "cache-cold", cacheCold: true, missing };
  }

  state.canvas.width = outputWidth;
  state.canvas.height = outputHeight;

  // doubt-driven-review CRITICAL fix: all three targets are created INSIDE
  // this try (not before it) — creating them before the try meant a
  // throwing 2nd/3rd `createRenderTarget()` call (framebuffer-incomplete,
  // alloc failure under memory pressure) skipped the finally entirely for
  // whichever target(s) already succeeded, leaking their GL texture/
  // framebuffer objects. `compositeStackRun`'s outer catch swallows the
  // error, so this leak was also completely silent — and compounding: a
  // GPU already under memory pressure is more likely to fail here, and
  // each failure leaks more, making the next call more likely to fail too.
  let scratch: RenderTarget | null = null;
  let accumA: RenderTarget | null = null;
  let accumB: RenderTarget | null = null;
  try {
    scratch = createRenderTarget(gl, outputWidth, outputHeight);
    accumA = createRenderTarget(gl, outputWidth, outputHeight);
    accumB = createRenderTarget(gl, outputWidth, outputHeight);

    gl.bindFramebuffer(gl.FRAMEBUFFER, accumA.framebuffer);
    gl.viewport(0, 0, outputWidth, outputHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    let curAccum = accumA;
    let nextAccum = accumB;

    for (let i = 0; i < job.layers.length; i++) {
      const member = job.layers[i];
      const modeId = GPU_BLEND_MODE_ID[member.blendMode];
      if (modeId === undefined) {
        // Defensive re-check — the CLIENT already gates on
        // `isGpuBlendImplemented` before ever building a StackRunJob, so
        // this should be unreachable, but never silently mis-render if
        // it somehow is (e.g. a stale client build).
        return {
          id,
          ok: false,
          error: `[tileCompositorGpuWorker] unimplemented blend mode in stack run: ${member.blendMode}`,
        };
      }

      // Reassemble this member's own tiles into the shared scratch target.
      gl.bindFramebuffer(gl.FRAMEBUFFER, scratch.framebuffer);
      gl.viewport(0, 0, outputWidth, outputHeight);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.BLEND);
      drawTileGroupsToBoundFramebuffer(
        state,
        perMemberGroups[i],
        outputWidth,
        outputHeight,
        tileSize,
      );

      const isLast = i === job.layers.length - 1;
      gl.bindFramebuffer(gl.FRAMEBUFFER, isLast ? null : nextAccum.framebuffer);
      gl.viewport(0, 0, outputWidth, outputHeight);
      gl.disable(gl.BLEND);
      gl.useProgram(state.blendStackProgram);
      gl.uniform1i(state.uBlendBackdrop, 0);
      gl.uniform1i(state.uBlendLayer, 1);
      gl.uniform1i(state.uBlendMask, 2);
      gl.uniform1i(state.uBlendHasMask, member.maskBuffer ? 1 : 0);
      gl.uniform1f(state.uBlendOpacity, member.opacity);
      gl.uniform1i(state.uBlendMode, modeId);
      gl.uniform1i(state.uBlendDissolveSeed, (member.dissolveSeed ?? 0) | 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, curAccum.texture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, scratch.texture);

      // mememaker-gpu-mask-compositing F02 — per-iteration mask texture,
      // NOT per-job state: a mask lives exactly one member iteration, so
      // it is created inside this try and deleted in this SAME
      // iteration's finally, never deferred to the outer job-level
      // finally that owns scratch/accumA/accumB (deferring N per-member
      // textures to job end would both hold N*W*H*4 bytes of GPU memory
      // for the whole job AND repeat this file's own F06 leak bug class
      // if a single hoisted variable were overwritten each iteration).
      let maskTexture: WebGLTexture | null = null;
      try {
        if (member.maskBuffer) {
          maskTexture = gl.createTexture();
          if (!maskTexture) {
            throw new Error(
              "[tileCompositorGpuWorker] compositeStackRunGpu: mask texture allocation failed",
            );
          }
          const expectedBytes = outputWidth * outputHeight * 4;
          if (member.maskBuffer.byteLength !== expectedBytes) {
            // Defensive cross-module boundary check: `maskBuffer` is built
            // by a different, already-shipped feature
            // (maskRunResample.ts's resampleMaskToGrayRgbaRect) — a
            // mismatched size would otherwise upload silently-corrupted
            // texture data (or throw an opaque WebGL error) rather than a
            // clear, diagnosable failure. The outer compositeStackRun
            // catch turns this into a safe per-layer CPU fallback, never
            // a crash.
            throw new Error(
              `[tileCompositorGpuWorker] compositeStackRunGpu: maskBuffer size mismatch (expected ${expectedBytes} bytes, got ${member.maskBuffer.byteLength})`,
            );
          }
          gl.activeTexture(gl.TEXTURE2);
          gl.bindTexture(gl.TEXTURE_2D, maskTexture);
          // Y-orientation: LIVE-VERIFIED (real WebGL2 context, Chrome
          // DevTools MCP) — a directly-uploaded top-down RGBA8 buffer
          // (row 0 = document row 0, matching resampleMaskToGrayRgbaRect's
          // own convention) sampled via texelFetch(gl_FragCoord), exactly
          // like this shader's u_backdrop/u_layer reads, does NOT align
          // with this file's tile-draw convention unless flipped: the
          // tile-draw VERTEX_SHADER negates clip.y after computing it from
          // raw top-down document position, so document row 0 lands at
          // the LARGEST gl_FragCoord.y — the OPPOSITE of a plain
          // (unflipped) texImage2D upload's row-0-at-texel-0 mapping. A
          // minimal 2-pass isolated test reproducing both this file's
          // real VERTEX_SHADER (UV-interpolated tile draw) and
          // BLEND_STACK_VERTEX_SHADER (texelFetch-addressed, matching
          // u_mask exactly) confirmed: the tile-draw path is
          // self-consistently correct un-flipped (UV interpolation shares
          // the same vertex transform as the position), but the
          // texelFetch-addressed path requires UNPACK_FLIP_Y_WEBGL=true to
          // recover the same document-row alignment. Scoped tightly to
          // ONLY this upload — every other texImage2D call in this file
          // assumes the flag stays false.
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            outputWidth,
            outputHeight,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            new Uint8Array(member.maskBuffer),
          );
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }
        // u_hasMask is 0 whenever member.maskBuffer is absent — texture
        // unit 2 is left unbound in that case; the shader never samples
        // it unless u_hasMask != 0, so no stale binding can leak in.

        gl.bindBuffer(gl.ARRAY_BUFFER, state.quadBuffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      } finally {
        if (maskTexture) gl.deleteTexture(maskTexture);
      }

      if (!isLast) {
        const tmp = curAccum;
        curAccum = nextAccum;
        nextAccum = tmp;
      }
    }
  } finally {
    // Each target is deleted ONLY if its own creation succeeded — a throw
    // partway through the three `createRenderTarget()` calls above still
    // cleans up whichever ones DID succeed, closing the leak this fix
    // addresses (see this function's own comment above the `try`).
    if (scratch) deleteRenderTarget(gl, scratch);
    if (accumA) deleteRenderTarget(gl, accumA);
    if (accumB) deleteRenderTarget(gl, accumB);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  const bitmap = state.canvas.transferToImageBitmap();
  return { id, ok: true, bitmap };
}

/** Exported (mirrors `compositeJob`'s own convention) — the CPU has no
 *  stack-run counterpart in this feature (an ineligible/errored run
 *  falls back to the EXISTING per-layer path in `MemeStage.tsx`, never a
 *  CPU stack composite), so a GPU failure here rejects the whole run
 *  rather than silently degrading to a different rendering strategy the
 *  caller didn't ask for — `tiledStackController.ts` treats ANY
 *  rejection as "this run isn't GPU-composited this frame", which is
 *  exactly what a per-layer-path fallback already looks like from
 *  MemeStage's perspective. */
export async function compositeStackRun(
  job: StackRunJob,
): Promise<StackRunReply> {
  const state = ensureGpu();
  if (!state) {
    return {
      id: job.id,
      ok: false,
      error:
        "[tileCompositorGpuWorker] GPU unavailable for stack-run compositing",
    };
  }
  try {
    return await compositeStackRunGpu(state, job);
  } catch (err) {
    // A shader compile/link failure specifically demotes the offending
    // mode(s) for the rest of the session (never crashes the job) — any
    // OTHER compute failure just fails this one run.
    if (
      err instanceof Error &&
      /shader compile failed|program link failed/.test(err.message)
    ) {
      for (const member of job.layers) demoteBlendMode(member.blendMode);
    }
    console.warn(
      "[MemeMaker] GPU stack-run composite failed, this run falls back to per-layer rendering",
      err,
    );
    return {
      id: job.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Test-only reset hook. */
export function __resetForTests(): void {
  canvasState = null;
  glState = null;
  gpuUnavailable = false;
  contextLost = false;
  contextLossCount = 0;
  warnedOnce = false;
}

if (typeof self !== "undefined" && typeof WorkerGlobalScope !== "undefined") {
  const ctx = self as unknown as DedicatedWorkerGlobalScope;
  ctx.onmessage = async (e: MessageEvent<TileCompositeJob | StackRunJob>) => {
    // F06 — a `kind: "stackRun"` message routes to the cross-layer
    // compositor; every other message (the original, `kind`-less shape)
    // is the per-layer job `compositeJobV2` has always handled. Only the
    // GPU worker script speaks `stackRun` at all — `tileCompositorWorker.ts`
    // (CPU) never receives one, since `tiledStackController.ts` only ever
    // sends this while `isGpuCompositorEnabled()` selected THIS worker.
    const reply =
      "kind" in e.data && e.data.kind === "stackRun"
        ? await compositeStackRun(e.data)
        : await compositeJobV2(e.data as TileCompositeJob);
    if (reply.ok) {
      ctx.postMessage(reply, [reply.bitmap]);
    } else {
      ctx.postMessage(reply);
    }
  };
}
