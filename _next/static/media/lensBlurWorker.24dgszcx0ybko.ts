/// <reference lib="webworker" />
// F08, mememaker-filter-menu-parity — dedicated Lens Blur worker.
// applyDepthBlur is the plan's single most expensive filter: even with
// the 8-bucket blur-pyramid approximation and the 30px hard radius cap,
// a worst-case depth map (spanning the full 0-255 range, so all 8
// buckets are used) benchmarked at ~108s on a legal 4000x3000 image and
// ~10 minutes at the max canvas size (8192x8192) — worse than F05 Motion
// Blur (~20s) and F06 Radial Blur (~38s), in the same "needs a dedicated
// worker" class those two required. Unlike F07 Surface Blur, a worker
// alone is a sufficient fix here (no need to also tighten the radius cap
// below the spec's own 30px) since the bucketed approximation already
// keeps the worst case bounded to roughly F05/F06's order of magnitude,
// not F07's originally-unbounded minutes-to-tens-of-minutes range. Pure
// TS, no WASM dependency, so no need for photonWorker.ts's op-name
// registry — a dedicated single-purpose RPC channel mirroring
// motionBlurWorker.ts/radialBlurWorker.ts/surfaceBlurWorker.ts's exact
// protocol shape, extended with a second transferred buffer for the
// depth map (a plain Float32Array, computed cheaply on the main thread
// by computeDepthMap — only the O(W*H*r) applyDepthBlur pass runs here).
//
// Protocol (see lib/lensBlurClient.ts, the only caller):
//   in:  LensBlurJob { id, width, height, buffer (TRANSFERRED),
//                       depthBuffer (TRANSFERRED), params }
//   out: { id, ok: true, width, height, buffer (TRANSFERRED) }
//      | { id, ok: false, error: string }
import { applyDepthBlur, type LensAperture } from "./filters/lensBlurCore";

interface LensBlurJob {
  id: number;
  width: number;
  height: number;
  /** The source ImageData's RGBA bytes — transferred in, owned by the worker. */
  buffer: ArrayBuffer;
  /** The depth map's Float32Array bytes — transferred in, owned by the worker. */
  depthBuffer: ArrayBuffer;
  params: {
    focalDistance: number;
    maxRadius: number;
    /** F09 — Iris aperture; omitted preserves F08's exact circle. */
    aperture?: LensAperture;
  };
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<LensBlurJob>) => {
  const { id, width, height, buffer, depthBuffer, params } = e.data;
  try {
    const data = new ImageData(new Uint8ClampedArray(buffer), width, height);
    const depthMap = new Float32Array(depthBuffer);
    const out = await applyDepthBlur(data, depthMap, params);
    ctx.postMessage(
      {
        id,
        ok: true,
        width: out.width,
        height: out.height,
        buffer: out.data.buffer,
      },
      [out.data.buffer],
    );
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: String(err) });
  }
};
