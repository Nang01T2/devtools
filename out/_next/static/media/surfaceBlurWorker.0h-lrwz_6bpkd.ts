/// <reference lib="webworker" />
// F07, mememaker-filter-menu-parity — dedicated Surface Blur worker
// (user-confirmed remediation, mirroring F05/F06's precedent): the
// range-kernel bilateral kernel is O(width*height*radius^2) and NOT
// separable — even after lowering SURFACE_BLUR_MAX_RADIUS from the
// spec's original 50 down to 20 (see that constant's own doc comment
// for the benchmark numbers), a legal 4000x3000/radius=20 apply still
// takes ~70s of compute. A worker doesn't make that faster, but it DOES
// keep it from freezing the tab (the surrounding UI stays responsive,
// unlike a synchronous main-thread block). Pure TS, no WASM dependency,
// so no need for photonWorker.ts's op-name registry — a dedicated
// single-purpose RPC channel mirroring motionBlurWorker.ts/
// radialBlurWorker.ts's exact protocol shape.
//
// Protocol (see lib/surfaceBlurClient.ts, the only caller):
//   in:  SurfaceBlurJob { id, width, height, buffer (TRANSFERRED), params }
//   out: { id, ok: true, width, height, buffer (TRANSFERRED) }
//      | { id, ok: false, error: string }
import {
  surfaceBlurFilter,
  type SurfaceBlurParams,
} from "./filters/surfaceBlur";

interface SurfaceBlurJob {
  id: number;
  width: number;
  height: number;
  /** The source ImageData's RGBA bytes — transferred in, owned by the worker. */
  buffer: ArrayBuffer;
  params: SurfaceBlurParams;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<SurfaceBlurJob>) => {
  const { id, width, height, buffer, params } = e.data;
  try {
    const data = new ImageData(new Uint8ClampedArray(buffer), width, height);
    const out = await surfaceBlurFilter(data, params);
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
