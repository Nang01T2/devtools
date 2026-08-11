/// <reference lib="webworker" />
// F02, mememaker-filter-menu-plan-c — dedicated Median worker.
// Mirrors lib/motionBlurWorker.ts's exact protocol: id-tracked
// request/response, transferred buffers, try/catch with structured
// error reply. Proactive per this plan's hard-learned performance
// discipline: rank filters over large radii are exactly the
// main-thread-blocking risk class that Surface Blur/Lens Blur hit.
//
// Protocol (see lib/medianClient.ts, the only caller):
//   in:  MedianJob { id, width, height, buffer (TRANSFERRED), params }
//   out: { id, ok: true, width, height, buffer (TRANSFERRED) }
//      | { id, ok: false, error: string }
import { medianFilter } from "./filters/medianCore";

interface MedianJob {
  id: number;
  width: number;
  height: number;
  buffer: ArrayBuffer;
  params: { radius: number; threshold: number };
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<MedianJob>) => {
  const { id, width, height, buffer, params } = e.data;
  try {
    const data = new ImageData(new Uint8ClampedArray(buffer), width, height);
    const out = await medianFilter(data, params.radius, params.threshold);
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
