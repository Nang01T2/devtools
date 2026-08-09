/// <reference lib="webworker" />
// F06, mememaker-filter-menu-parity — dedicated Radial Blur worker
// (code-reviewer finding, fixed pre-commit): radialBlurFilter is
// O(width*height*K) with a 4-tap bilinear inner loop — a legal
// full-resolution apply at the max canvas size (8192x8192) with
// quality="best" (K=16) measured at ~38s of BLOCKING main-thread
// execution, worse than F05 Motion Blur's ~20s crisis case. Same
// remediation: pure TS with no WASM/Photon dependency, so it doesn't
// need photonWorker.ts's op-name registry, just a dedicated
// single-purpose RPC channel mirroring that same protocol shape
// (id-tracked request/response, transferred buffers).
//
// Protocol (see lib/radialBlurClient.ts, the only caller):
//   in:  RadialBlurJob { id, width, height, buffer (TRANSFERRED), params }
//   out: { id, ok: true, width, height, buffer (TRANSFERRED) }
//      | { id, ok: false, error: string }
import { radialBlurFilter, type RadialBlurParams } from "./filters/radialBlur";

interface RadialBlurJob {
  id: number;
  width: number;
  height: number;
  /** The source ImageData's RGBA bytes — transferred in, owned by the worker. */
  buffer: ArrayBuffer;
  params: RadialBlurParams;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<RadialBlurJob>) => {
  const { id, width, height, buffer, params } = e.data;
  try {
    const data = new ImageData(new Uint8ClampedArray(buffer), width, height);
    const out = await radialBlurFilter(data, params);
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
