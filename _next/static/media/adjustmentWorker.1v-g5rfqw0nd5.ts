/// <reference lib="webworker" />
// Adjustment-layer re-bake worker (mememaker-photopea-rendering-rewrite F06).
// Runs the ONE filter an AdjustedRun node needs (rebuilt from serializable
// config via adjustmentFilterDispatch.ts — never a closure) plus the same
// mask-lerp step wrapFiltersWithMask applies on the main thread, off the
// main thread. The module below is imported UNCHANGED — every helper it
// calls is pure and DOM-free.
//
// Protocol (see lib/adjustmentClient.ts, the only caller):
//   in:  AdjustmentJob { id, width, height, buffer (TRANSFERRED),
//                        adjustmentType, params, fgColor, bgColor,
//                        maskAlpha (TRANSFERRED, or null) }
//   out: { id, ok: true, width, height, buffer (TRANSFERRED) }
//      | { id, ok: false, error: string }
// "legacy" adjustmentType never reaches this worker — see
// adjustmentFilterDispatch.ts's own header comment.
import {
  buildAdjustmentFilter,
  type WorkerAdjustmentType,
} from "./adjustmentFilterDispatch";
import { lerpMaskedPixels } from "./maskedAdjustmentFilter";

interface AdjustmentJob {
  id: number;
  width: number;
  height: number;
  /** Raw (unfiltered) cached-scene RGBA bytes — TRANSFERRED in. */
  buffer: ArrayBuffer;
  adjustmentType: WorkerAdjustmentType;
  /** The one config payload for this type, or undefined for "invert"
   *  (parameterless) — see adjustmentFilterDispatch.ts's own DEFAULT_*
   *  fallback per type. */
  params: unknown;
  /** "gradientMap" only — resolveGradientById needs live fg/bg swatches. */
  fgColor: string;
  bgColor: string;
  /** One byte per pixel (length === width*height), TRANSFERRED in, or
   *  null when unmasked. Produced on the main thread by
   *  resampleMaskToRect (DOM-dependent, stays there, unchanged). */
  maskAlpha: ArrayBuffer | null;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<AdjustmentJob>) => {
  const {
    id,
    width,
    height,
    buffer,
    adjustmentType,
    params,
    fgColor,
    bgColor,
    maskAlpha,
  } = e.data;
  try {
    const imageData = new ImageData(
      new Uint8ClampedArray(buffer),
      width,
      height,
    );
    const filter = buildAdjustmentFilter(
      adjustmentType,
      params,
      fgColor,
      bgColor,
    );
    const mask = maskAlpha ? new Uint8ClampedArray(maskAlpha) : null;
    if (mask && mask.length === width * height) {
      // Same sequence as wrapFiltersWithMask (maskedAdjustmentFilter.ts):
      // ONE pre-filter snapshot, apply the filter, then lerp back against
      // the mask alpha. Alpha channel (lerpMaskedPixels' own contract) is
      // never written.
      const original = imageData.data.slice();
      filter(imageData);
      lerpMaskedPixels(imageData.data, original, mask);
    } else {
      // Null mask, or a length mismatch — fail-open unmasked, matching
      // wrapFiltersWithMask's own guard.
      filter(imageData);
    }
    ctx.postMessage(
      { id, ok: true, width, height, buffer: imageData.data.buffer },
      [imageData.data.buffer],
    );
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: String(err) });
  }
};
