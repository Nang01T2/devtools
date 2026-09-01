/// <reference lib="webworker" />
// F07, mememaker-filter-menu-parity — dedicated Surface Blur worker
// (user-confirmed remediation, mirroring F05/F06's precedent): the
// range-kernel bilateral kernel is O(width*height*radius^2) and NOT
// separable — even after lowering SURFACE_BLUR_MAX_RADIUS from the
// spec's original 50 down to 20 (see that constant's own doc comment
// for the benchmark numbers), a legal 4000x3000/radius=20 apply still
// takes ~70s of compute on the JS fallback path. A worker doesn't make
// that faster by itself, but it DOES keep it from freezing the tab.
//
// F02, mememaker-wasm-simd-pixel-pipeline-c3 — the filter body now goes
// through runSurfaceBlurJob (Wasm SIMD when available, the original
// pure-TS bilateral kernel in filters/surfaceBlur.ts otherwise — that JS
// path is kept UNCHANGED as the permanent fallback). Pure dispatch shell,
// no photonWorker.ts-style op-name registry needed — a dedicated
// single-purpose RPC channel mirroring motionBlurWorker.ts/
// radialBlurWorker.ts's exact protocol shape.
//
// Protocol (see lib/surfaceBlurClient.ts, the only caller) — UNCHANGED:
//   in:  SurfaceBlurJob { id, width, height, buffer (TRANSFERRED), params }
//   out: { id, ok: true, width, height, buffer (TRANSFERRED), usedWasm? }
//      | { id, ok: false, error: string }
// `usedWasm` is a debug-only ADDITION — the client's SurfaceBlurReplyOk
// never reads it (verified: it only destructures id/ok/width/height/buffer),
// so the contract the client depends on is byte-for-byte identical.
import type { SurfaceBlurParams } from "./filters/surfaceBlur";
import { runSurfaceBlurJob } from "./surfaceBlurJob";

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
    const { out, usedWasm } = await runSurfaceBlurJob(data, params);
    ctx.postMessage(
      {
        id,
        ok: true,
        width: out.width,
        height: out.height,
        buffer: out.data.buffer,
        usedWasm,
      },
      [out.data.buffer],
    );
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: String(err) });
  }
};
