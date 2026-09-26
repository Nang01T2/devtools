/// <reference lib="webworker" />
// Adjustment-layer re-bake worker (mememaker-photopea-rendering-rewrite F06).
// Runs the ONE filter an AdjustedRun node needs (rebuilt from serializable
// config via adjustmentFilterDispatch.ts — never a closure) plus the same
// mask-lerp step wrapFiltersWithMask applies on the main thread, off the
// main thread. The module below is imported UNCHANGED — every helper it
// calls is pure and DOM-free.
//
// Protocol (see lib/adjustmentClient.ts, the only caller):
//   in:  AdjustmentJob { id, width, height,
//                        buffer (TRANSFERRED) | null,
//                        bitmap (TRANSFERRED ImageBitmap) | null — exactly one
//                          of buffer/bitmap is set; a bitmap is read back
//                          HERE via OffscreenCanvas.getImageData so the main
//                          thread never pays the readback (2026-09-25),
//                        adjustmentType, params, fgColor, bgColor,
//                        maskAlpha (TRANSFERRED, or null), opacity,
//                        blendMode, dissolveSeed }
//   out: { id, ok: true, width, height, buffer (TRANSFERRED) }
//      | { id, ok: false, error: string, transport?: true }
//        (`transport:true` = the bitmap readback itself failed — the client
//         latches the bitmap path off and the caller retries via ImageData)
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
  /** Raw (unfiltered) cached-scene RGBA bytes — TRANSFERRED in; null when
   *  `bitmap` carries the pixels instead. */
  buffer: ArrayBuffer | null;
  /** Raw (unfiltered) cached-scene pixels as a premultiplied ImageBitmap —
   *  TRANSFERRED in (runAdjustmentFromBitmap), or null/absent for the
   *  ImageData path. Read back here, off the main thread. */
  bitmap?: ImageBitmap | null;
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

/** Bitmap path: the ONE `getImageData` readback the bake needs, done here
 *  instead of on the main thread. `willReadFrequently` keeps the scratch
 *  canvas CPU-backed so the readback is a memcpy, not a GPU sync. Same
 *  premultiplied→straight step the ImageData path's caller performed on
 *  the cache canvas directly (A1: no extra alpha boundary). */
function readBitmap(
  bitmap: ImageBitmap,
  width: number,
  height: number,
): ImageData {
  if (typeof OffscreenCanvas === "undefined") {
    bitmap.close();
    throw new Error("OffscreenCanvas unavailable in adjustment worker");
  }
  try {
    const off = new OffscreenCanvas(width, height);
    const c = off.getContext("2d", { willReadFrequently: true });
    if (!c) throw new Error("2d context unavailable in adjustment worker");
    c.drawImage(bitmap, 0, 0);
    return c.getImageData(0, 0, width, height);
  } finally {
    // Whichever line threw (allocation at full resolution included), the
    // transferred bitmap's backing store is released here.
    bitmap.close();
  }
}

ctx.onmessage = (e: MessageEvent<AdjustmentJob>) => {
  const {
    id,
    width,
    height,
    buffer,
    bitmap,
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
    let imageData: ImageData;
    if (bitmap) {
      // Readback failures are TRANSPORT failures (OffscreenCanvas missing
      // here, 2D context allocation refused at full resolution, a
      // getImageData throw) — not filter errors. Tagged `transport:true`
      // so the client latches the bitmap path off and the caller retries
      // this same job through the ImageData path, which would succeed.
      try {
        imageData = readBitmap(bitmap, width, height);
      } catch (err) {
        ctx.postMessage({ id, ok: false, error: String(err), transport: true });
        return;
      }
    } else {
      imageData = new ImageData(new Uint8ClampedArray(buffer!), width, height);
    }
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
