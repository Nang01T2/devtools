/// <reference lib="webworker" />
// F05, mememaker-filter-menu-parity — dedicated Motion Blur worker
// (code-reviewer finding, fixed pre-commit): motionBlurFilter is
// O(width*height*distance) with a 4-tap bilinear inner loop — a legal
// full-resolution apply (e.g. 4000x3000 @ distance=100) measured at ~20s
// of BLOCKING main-thread execution, freezing the tab with no way to even
// paint a spinner. Unlike lib/filters/average.ts's O(n) single-pass
// "documented main-thread exception" (genuinely cheap), this filter's
// cost class warrants its own worker — it's pure TS with no WASM/Photon
// dependency, so it doesn't need photonWorker.ts's op-name registry, just
// a dedicated single-purpose RPC channel mirroring that same protocol
// shape (id-tracked request/response, transferred buffers).
//
// Protocol (see lib/motionBlurClient.ts, the only caller):
//   in:  MotionBlurJob { id, width, height, buffer (TRANSFERRED), params }
//   out: { id, ok: true, width, height, buffer (TRANSFERRED) }
//      | { id, ok: false, error: string }
import { motionBlurFilter } from "./filters/motionBlur";

interface MotionBlurJob {
  id: number;
  width: number;
  height: number;
  /** The source ImageData's RGBA bytes — transferred in, owned by the worker. */
  buffer: ArrayBuffer;
  params: { angle: number; distance: number };
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<MotionBlurJob>) => {
  const { id, width, height, buffer, params } = e.data;
  try {
    const data = new ImageData(new Uint8ClampedArray(buffer), width, height);
    const out = await motionBlurFilter(data, params);
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
