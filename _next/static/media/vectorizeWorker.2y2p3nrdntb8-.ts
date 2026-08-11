/// <reference lib="webworker" />
import ImageTracer from "imagetracerjs";
import type { ImageTracerOptions } from "imagetracerjs";

const SUGGESTED_PRESETS: Record<string, Partial<ImageTracerOptions>> = {
  detailed: {
    ltres: 1,
    qtres: 1,
    pathomit: 0,
    rightangleenhance: true,
  },
  simplified: {
    ltres: 4,
    qtres: 4,
    pathomit: 12,
    rightangleenhance: false,
  },
};

export interface VectorizeJob {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  numberOfColors: number;
  preset: string;
}

export interface VectorizeResult {
  type: "vectorize-done";
  svg: string;
  downscaled: boolean;
}

export interface VectorizeError {
  type: "vectorize-error";
  message: string;
}

export type VectorizeWorkerMsg = VectorizeResult | VectorizeError;

const MAX_MP = 1_500_000;

const ctx = self as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<VectorizeJob>) => {
  const { pixels, width, height, numberOfColors, preset } = e.data;
  try {
    let w = width;
    let h = height;
    let data = pixels;
    let downscaled = false;

    if (w * h > MAX_MP) {
      const scale = Math.sqrt(MAX_MP / (w * h));
      const newW = Math.max(1, Math.round(w * scale));
      const newH = Math.max(1, Math.round(h * scale));
      data = downscaleBilinear(pixels, w, h, newW, newH);
      w = newW;
      h = newH;
      downscaled = true;
    }

    const presetOpts = SUGGESTED_PRESETS[preset] ?? SUGGESTED_PRESETS.detailed;

    const svg = ImageTracer.imagedataToSVG(
      { data, width: w, height: h },
      {
        numberofcolors: numberOfColors,
        ...presetOpts,
      },
    );

    ctx.postMessage({ type: "vectorize-done", svg, downscaled });
  } catch (err) {
    ctx.postMessage({
      type: "vectorize-error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

function downscaleBilinear(
  src: Uint8ClampedArray,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(dw * dh * 4);
  const xRatio = sw / dw;
  const yRatio = sh / dh;
  for (let dy = 0; dy < dh; dy++) {
    const sy = dy * yRatio;
    const sy0 = Math.floor(sy);
    const sy1 = Math.min(sy0 + 1, sh - 1);
    const ty = sy - sy0;
    for (let dx = 0; dx < dw; dx++) {
      const sx = dx * xRatio;
      const sx0 = Math.floor(sx);
      const sx1 = Math.min(sx0 + 1, sw - 1);
      const tx = sx - sx0;
      const di = (dy * dw + dx) * 4;
      const a = (sy0 * sw + sx0) * 4;
      const b = (sy0 * sw + sx1) * 4;
      const c = (sy1 * sw + sx0) * 4;
      const d = (sy1 * sw + sx1) * 4;
      for (let k = 0; k < 4; k++) {
        const top = src[a + k] * (1 - tx) + src[b + k] * tx;
        const bot = src[c + k] * (1 - tx) + src[d + k] * tx;
        dst[di + k] = top * (1 - ty) + bot * ty;
      }
    }
  }
  return dst;
}
