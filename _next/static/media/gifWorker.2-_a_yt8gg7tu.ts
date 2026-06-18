/// <reference lib="webworker" />
// Animated-GIF export worker: decode the base GIF (gifuct-js) → coalesce frames
// (applying disposal, F01) → composite each frame UNDER the rendered overlay on an
// OffscreenCanvas → encode to an animated GIF (gifenc). Runs entirely off the main
// thread; no CDN/network. Heavy LZW decode + quantize live here on purpose.
import { parseGIF, decompressFrames } from "gifuct-js";
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { coalesceFrames, sampleFrameIndices } from "./gifFrames";
import {
  applyAdjustments,
  hasAdjustments,
  type Adjustments,
} from "./imageAdjust";
import { scaleCrop, type CropRect } from "./crop";
import {
  deriveFrameSequence,
  frameDelayMs,
  type FrameEdits,
} from "./frameEdits";

interface GifJob {
  /** Original GIF file bytes (structured-cloned — NOT transferred, so the caller's copy survives repeat exports). */
  gifBytes: ArrayBuffer;
  /**
   * Overlay layers rendered at (exportW, exportH) with a transparent background
   * (transferred). Each carries the inclusive frame range it shows on (start/end
   * are 0-based frame indices; a full-range overlay uses end = MAX_SAFE_INTEGER).
   */
  overlays: { bitmap: ImageBitmap; start: number; end: number }[];
  exportW: number;
  exportH: number;
  maxFrames: number;
  /** Base-image adjustments to bake into every frame (same as the preview). */
  adjustments: Adjustments;
  /** Playback-rate multiplier on frame delays (1 = original; 2 = 2× faster). */
  speed: number;
  /** Loop forever (repeat 0) vs play once (repeat -1). */
  loop: boolean;
  /** Crop region in BASE coords (null = full frame); mapped to GIF-frame coords. */
  crop: CropRect | null;
  baseWidth: number;
  baseHeight: number;
  /** Frame management (FT-3): trim/delete/reverse/boomerang + per-frame delays. */
  frameEdits: FrameEdits;
  /**
   * Pre-captured animated text overlay snapshots (transferred). When present, the
   * worker picks the snapshot whose animation phase best matches the cumulative
   * display time of each output frame, instead of using `overlays`.
   */
  animFrames?: ImageBitmap[];
  /** Animation period in ms — used with animFrames to pick the right snapshot. */
  animPeriodMs?: number;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<GifJob>) => {
  const {
    gifBytes,
    overlays,
    exportW,
    exportH,
    maxFrames,
    adjustments,
    speed,
    loop,
    crop,
    baseWidth,
    baseHeight,
    frameEdits,
    animFrames,
    animPeriodMs,
  } = e.data;
  try {
    const parsed = parseGIF(gifBytes);
    const raw = decompressFrames(parsed, true); // ParsedFrame[] (patch/dims/delay/disposalType)
    const gifW = parsed.lsd.width;
    const gifH = parsed.lsd.height;

    // Decide which frames to keep, then coalesce ALL frames (so the disposal/
    // delta chain composites correctly) while materializing only the kept ones —
    // dropped frames' delays fold into the next kept frame to preserve timing.
    const indices = sampleFrameIndices(raw.length, maxFrames);
    const sampledOut = indices.length < raw.length;
    const frames = coalesceFrames(raw, gifW, gifH, new Set(indices));

    // Crop region in GIF-frame coords (full frame when no crop). Frames are drawn
    // from this source rect, scaled to the export size.
    const src: CropRect = crop
      ? scaleCrop(crop, gifW / baseWidth, gifH / baseHeight)
      : { x: 0, y: 0, width: gifW, height: gifH };
    // Independent rounding in scaleCrop can push x+width 1px past the frame edge;
    // clamp so the drawImage source rect stays in bounds (no silent edge clip).
    src.width = Math.min(src.width, gifW - src.x);
    src.height = Math.min(src.height, gifH - src.y);

    // composite = scaled output frame; frameCanvas holds the raw frame at GIF size.
    const composite = new OffscreenCanvas(exportW, exportH);
    const cctx = composite.getContext("2d", { willReadFrequently: true })!;
    const frameCanvas = new OffscreenCanvas(gifW, gifH);
    const fctx = frameCanvas.getContext("2d")!;

    const applyAdj = hasAdjustments(adjustments);
    // Bake base-image adjustments into each SOURCE frame ONCE, up front — not per
    // emitted frame: reverse/boomerang re-emit the same source frame, and
    // applyAdjustments mutates rgba in place (a second pass would double-apply).
    if (applyAdj)
      for (const fr of frames)
        applyAdjustments(fr.rgba, gifW, gifH, adjustments);

    // Output order of source indices after trim/delete/reverse/boomerang.
    const seq = deriveFrameSequence(frameEdits, frames.length);
    if (seq.length === 0) throw new Error("No frames left to export");

    // `repeat` is read only from the first frame (0 = loop forever, -1 = play once).
    const repeatOpt = { repeat: loop ? 0 : -1 };
    const enc = GIFEncoder();
    // Cumulative display time (ms) used to pick the right animation snapshot per frame.
    let cumulativeMs = 0;
    const period = animPeriodMs ?? 2000;
    for (let pos = 0; pos < seq.length; pos++) {
      const si = seq[pos]; // source frame index (may repeat under boomerang)
      const fr = frames[si];
      fctx.putImageData(new ImageData(fr.rgba, gifW, gifH), 0, 0);
      cctx.clearRect(0, 0, exportW, exportH);
      // draw the (cropped) source region of the frame, scaled to the export size
      cctx.drawImage(
        frameCanvas,
        src.x,
        src.y,
        src.width,
        src.height,
        0,
        0,
        exportW,
        exportH,
      );
      if (animFrames && animFrames.length > 0) {
        // Pick the animation snapshot whose phase best matches this frame's display time.
        const t = cumulativeMs % period;
        const idx =
          Math.floor((t / period) * animFrames.length) % animFrames.length;
        cctx.drawImage(animFrames[idx], 0, 0);
      } else {
        // Draw each overlay that shows on this SOURCE frame (already cropped + at
        // export dims), in z-order. Full-range overlays have end = MAX_SAFE_INTEGER.
        for (const ov of overlays) {
          if (si >= ov.start && si <= ov.end) cctx.drawImage(ov.bitmap, 0, 0);
        }
      }
      const { data } = cctx.getImageData(0, 0, exportW, exportH);
      const palette = quantize(data, 256);
      const index = applyPalette(data, palette);
      // Per-frame delay override (FT-3), else the frame's own delay; speed > 1 →
      // shorter (faster); clamp to a 20 ms floor like browsers.
      const baseDelay = frameDelayMs(frameEdits, si, fr.delayMs);
      const delay = Math.max(20, Math.round(baseDelay / (speed || 1)));
      enc.writeFrame(index, exportW, exportH, {
        palette,
        delay,
        ...(pos === 0 ? repeatOpt : {}),
      });
      // Accumulate display time using the adjusted delay (tracks real playback speed).
      cumulativeMs += delay;
      ctx.postMessage({
        type: "gif-progress",
        progress: (pos + 1) / seq.length,
      });
    }
    enc.finish();
    const bytes = enc.bytes();
    for (const ov of overlays) ov.bitmap.close();
    if (animFrames) for (const b of animFrames) b.close();
    ctx.postMessage(
      { type: "gif-done", bytes, frameCount: seq.length, sampledOut },
      [bytes.buffer],
    );
  } catch (err) {
    for (const ov of overlays) ov.bitmap.close();
    if (animFrames) for (const b of animFrames) b.close();
    ctx.postMessage({ type: "gif-error", message: String(err) });
  }
};
