/// <reference lib="webworker" />
// F08, mememaker-filter-menu-plan-c — dedicated Color Halftone worker.
// Mirrors lib/medianWorker.ts's exact protocol: id-tracked request/response,
// transferred buffers, try/catch with structured error reply.
//
// doubt-driven-review finding: the shipped F08 commit called
// colorHalftoneFilter directly through applyPhotonOp/applyPhotonOpToLayer
// with NO worker, and the commit message's "no worker needed (O(W*H) per
// channel, cache avoids recompute)" claim had zero measured numbers behind
// it — the spec's own mandatory benchmark step was never actually run.
// Measured after the fact (Node, 8192x8192, 3 channels, single pass):
// maxRadius=127 (largest cells, cheapest per-pixel) ~12.3s; maxRadius=4
// (smallest cells, most cache lookups) ~18.7s — both far past the spec's
// own "~1s" decision threshold. A worker is required.
//
// Protocol (see lib/colorHalftoneClient.ts, the only caller):
//   in:  ColorHalftoneJob { id, width, height, buffer (TRANSFERRED), params }
//   out: { id, ok: true, width, height, buffer (TRANSFERRED) }
//      | { id, ok: false, error: string }
import {
  colorHalftoneFilter,
  type ColorHalftoneParams,
} from "./filters/colorHalftone";

interface ColorHalftoneJob {
  id: number;
  width: number;
  height: number;
  buffer: ArrayBuffer;
  params: ColorHalftoneParams;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<ColorHalftoneJob>) => {
  const { id, width, height, buffer, params } = e.data;
  try {
    const data = new ImageData(new Uint8ClampedArray(buffer), width, height);
    const out = await colorHalftoneFilter(data, params);
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
