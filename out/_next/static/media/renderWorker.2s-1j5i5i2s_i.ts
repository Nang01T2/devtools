/// <reference lib="webworker" />
// F08, mememaker-filter-menu-render — dedicated worker for the Render
// filter family (mirrors distortWorker.ts's op-discriminator shape; this
// is the FIRST Render-category worker filter, kept separate from
// distortWorker.ts so Lighting Effects' shading math doesn't get pulled
// into every Distort filter's worker bundle — room for future Render
// filters, e.g. Clouds/Fibers, to land here too if ever worker-dispatched
// from a shared registry instead of the current one-off pattern).
//
// Protocol (see renderClient.ts):
//   in:  { id, op: "lighting-effects", width, height, buffer,
//          mapWidth, mapHeight, mapBuffer, params }
//   out: { id, ok: true, width, height, buffer } | { id, ok: false, error }
import {
  lightingEffectsFilter,
  type LightingEffectsParams,
} from "./lightingEffects";

export type RenderOp = "lighting-effects";

interface RenderJob {
  id: number;
  op: RenderOp;
  width: number;
  height: number;
  buffer: ArrayBuffer;
  params: LightingEffectsParams;
  mapWidth: number;
  mapHeight: number;
  mapBuffer: ArrayBuffer;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<RenderJob>) => {
  const {
    id,
    op,
    width,
    height,
    buffer,
    params,
    mapWidth,
    mapHeight,
    mapBuffer,
  } = e.data;
  try {
    const data = new ImageData(new Uint8ClampedArray(buffer), width, height);
    let result: ImageData;
    if (op === "lighting-effects") {
      const bumpMap = new ImageData(
        new Uint8ClampedArray(mapBuffer),
        mapWidth,
        mapHeight,
      );
      result = await lightingEffectsFilter(data, bumpMap, params);
    } else {
      throw new Error(`renderWorker: unknown op "${String(op)}"`);
    }
    ctx.postMessage(
      {
        id,
        ok: true,
        width: result.width,
        height: result.height,
        buffer: result.data.buffer,
      },
      [result.data.buffer],
    );
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: String(err) });
  }
};
