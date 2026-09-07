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
//                        maskAlpha (TRANSFERRED, or null), opacity,
//                        blendMode, dissolveSeed }
//   out: { id, ok: true, width, height, buffer (TRANSFERRED) }
//      | { id, ok: false, error: string }
// "legacy" adjustmentType never reaches this worker — see
// adjustmentFilterDispatch.ts's own header comment.
import {
  buildAdjustmentFilter,
  type WorkerAdjustmentType,
} from "./adjustmentFilterDispatch";
// NOTE: both come from adjustmentComposite, never from adjustmentClient.
// The client spawns THIS file as a worker entry, so importing it back here
// closes a cycle across the worker-entry boundary that deadlocks `next build`
// (Turbopack 16.3.1) — see isIdentityComposite's own comment for the detail.
import {
  applyAdjustmentComposite,
  isIdentityComposite,
} from "./adjustmentComposite";
import type { ExtendedBlendMode } from "@gadgetforge/render-core/types";

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
  /** mememaker-adjustment-layer-opacity-blendmode F02 — layer opacity in
   *  [0,1] (float, never 8-bit quantised; `node.adjustmentLayer.opacity ??
   *  1` on the main thread). */
  opacity: number;
  /** Full 27-mode union; "normal" when the layer has none. */
  blendMode: ExtendedBlendMode;
  /** uint32 djb2 hash of the layer id (F01's dissolveSeedFromLayerId),
   *  computed on the MAIN THREAD — the worker never sees a layer id. Only
   *  consumed when blendMode === "dissolve"; always sent so the wire
   *  shape is fixed. */
  dissolveSeed: number;
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
    opacity,
    blendMode,
    dissolveSeed,
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
    // Fail-open on a length mismatch, matching wrapFiltersWithMask's own
    // guard: a mismatched mask is treated as "no mask", NOT as an error.
    const validMask = mask && mask.length === width * height ? mask : null;
    // A1: straight-alpha ImageData buffer; no premultiplied boundary crossed.
    if (isIdentityComposite(opacity, blendMode, validMask !== null)) {
      // FAST PATH — byte-identical to the pre-F02 unmasked branch: no
      // snapshot, no composite.
      filter(imageData);
    } else {
      // ONE pre-filter snapshot regardless of whether a mask exists
      // (opacity and blendMode both need `original` on their own), then
      // the filter, then F01's weighted blend + alpha-preserving lerp.
      const original = imageData.data.slice();
      filter(imageData);
      applyAdjustmentComposite(imageData.data, original, width, height, {
        maskAlpha: validMask,
        opacity,
        mode: blendMode,
        dissolveSeed,
      });
    }
    ctx.postMessage(
      { id, ok: true, width, height, buffer: imageData.data.buffer },
      [imageData.data.buffer],
    );
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: String(err) });
  }
};
