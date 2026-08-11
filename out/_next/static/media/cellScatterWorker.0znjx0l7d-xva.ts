/// <reference lib="webworker" />
// F05, mememaker-filter-menu-plan-c — dedicated worker for cellScatter-
// based filters. Written with an `op` discriminator from the start
// because F06 (Pointillize) extends this with a "pointillize" op rather
// than creating a separate worker.
//
// Protocol (see cellScatterClient.ts):
//   in:  { id, op, width, height, buffer, params }
//   out: { id, ok: true, width, height, buffer } | { id, ok: false, error }
import { crystallizeFilter } from "./crystallize";
import { pointillizeFilter, type PointillizeParams } from "./pointillize";
import type { CellScatterParams } from "./cellScatter";

interface CellScatterJob {
  id: number;
  op: "crystallize" | "pointillize";
  width: number;
  height: number;
  buffer: ArrayBuffer;
  params: CellScatterParams | PointillizeParams;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<CellScatterJob>) => {
  const { id, op, width, height, buffer, params } = e.data;
  try {
    const data = new ImageData(new Uint8ClampedArray(buffer), width, height);
    let result: ImageData;
    if (op === "crystallize") {
      result = await crystallizeFilter(data, params as CellScatterParams);
    } else if (op === "pointillize") {
      result = await pointillizeFilter(data, params as PointillizeParams);
    } else {
      throw new Error(`cellScatterWorker: unknown op "${op}"`);
    }
    ctx.postMessage(
      { id, ok: true, width: result.width, height: result.height, buffer: result.data.buffer },
      [result.data.buffer],
    );
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: String(err) });
  }
};
