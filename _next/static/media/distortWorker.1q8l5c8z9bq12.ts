/// <reference lib="webworker" />
// F01, mememaker-filter-menu-plan-d-distort — dedicated worker for the
// Distort filter family. Written with an `op` discriminator from the start
// (even though only 3 ops are used initially) because sibling features will
// extend this SAME file with new ops rather than creating a separate worker
// file — shared-infrastructure discipline (cellScatterWorker.ts precedent):
// ZigZag (F02), Ripple (F03), Wave (F04 — worker mandatory per locked
// decision), Polar (F05), Shear (F06), Displace (F07) all land here.
//
// Protocol (see distortClient.ts):
//   in:  { id, op, width, height, buffer, params }
//   out: { id, ok: true, width, height, buffer } | { id, ok: false, error }
import { pinchFilter, type PinchParams } from "./pinch";
import { spherizeFilter, type SpherizeParams } from "./spherize";
import { twirlFilter, type TwirlParams } from "./twirl";
import { zigzagFilter, type ZigzagParams } from "./zigzag";
import { rippleFilter, type RippleParams } from "./ripple";
import { waveFilter, type WaveParams } from "./wave";
import {
  polarCoordinatesFilter,
  type PolarCoordinatesParams,
} from "./polarCoordinates";
import { shearFilter, type ShearParams } from "./shear";
import { displaceFilter, type DisplaceParams } from "./displace";
import {
  lensCorrectionFilter,
  type LensCorrectionParams,
} from "./lensCorrection";
import { liquifyFilter, type LiquifyGrid, type LiquifyParams } from "./liquify";

export type DistortOp =
  | "pinch"
  | "spherize"
  | "twirl"
  | "zigzag"
  | "ripple"
  | "wave"
  | "polar"
  | "shear"
  | "displace"
  | "lensCorrection"
  | "liquify";
export type DistortParams =
  | PinchParams
  | SpherizeParams
  | TwirlParams
  | ZigzagParams
  | RippleParams
  | WaveParams
  | PolarCoordinatesParams
  | ShearParams
  | DisplaceParams
  | LensCorrectionParams
  | LiquifyParams;

interface DistortJob {
  id: number;
  op: DistortOp;
  width: number;
  height: number;
  buffer: ArrayBuffer;
  params: DistortParams;
  // F07, mememaker-filter-menu-plan-d-distort — Displace only: the
  // displacement-map dimensions + its own transferred buffer.
  mapWidth?: number;
  mapHeight?: number;
  mapBuffer?: ArrayBuffer;
  // F02, filter.liquify — Liquify only: committed displacement grid,
  // transferred alongside the image buffer (Displace map-field precedent).
  gridWidth?: number;
  gridHeight?: number;
  gridBuffer?: ArrayBuffer; // Float32Array backing store
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<DistortJob>) => {
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
    gridWidth,
    gridHeight,
    gridBuffer,
  } = e.data;
  try {
    const data = new ImageData(new Uint8ClampedArray(buffer), width, height);
    let result: ImageData;
    if (op === "pinch") {
      result = await pinchFilter(data, params as PinchParams);
    } else if (op === "spherize") {
      result = await spherizeFilter(data, params as SpherizeParams);
    } else if (op === "twirl") {
      result = await twirlFilter(data, params as TwirlParams);
    } else if (op === "zigzag") {
      result = await zigzagFilter(data, params as ZigzagParams);
    } else if (op === "ripple") {
      result = await rippleFilter(data, params as RippleParams);
    } else if (op === "wave") {
      result = await waveFilter(data, params as WaveParams);
    } else if (op === "polar") {
      // polarCoordinatesFilter is synchronous (returns ImageData, not a
      // Promise) — `await` on a non-thenable value just resolves
      // immediately, so this composes fine with the shared async handler.
      result = polarCoordinatesFilter(data, params as PolarCoordinatesParams);
    } else if (op === "shear") {
      result = await shearFilter(data, params as ShearParams);
    } else if (op === "displace") {
      if (mapWidth == null || mapHeight == null || mapBuffer == null) {
        throw new Error("distortWorker: displace op missing map fields");
      }
      const map = new ImageData(
        new Uint8ClampedArray(mapBuffer),
        mapWidth,
        mapHeight,
      );
      result = displaceFilter(data, map, params as DisplaceParams);
    } else if (op === "lensCorrection") {
      result = await lensCorrectionFilter(data, params as LensCorrectionParams);
    } else if (op === "liquify") {
      if (gridWidth == null || gridHeight == null || gridBuffer == null) {
        throw new Error("distortWorker: liquify op missing grid fields");
      }
      const grid: LiquifyGrid = {
        offsets: new Float32Array(gridBuffer),
        gridWidth,
        gridHeight,
        step: (params as LiquifyParams).step,
      };
      result = await liquifyFilter(data, grid);
    } else {
      throw new Error(`distortWorker: unknown op "${String(op)}"`);
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
