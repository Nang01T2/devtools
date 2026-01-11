// processors/aiWorker.ts
import * as Comlink from "comlink";
import { FilesetResolver, FaceDetector } from "@mediapipe/tasks-vision";
import { pipeline } from "@huggingface/transformers";

let faceDetector: FaceDetector | null = null;
let backgroundRemover: any = null;

async function initFaceDetector() {
  if (faceDetector) return;
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );
  faceDetector = await FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
      delegate: "GPU",
    },
    runningMode: "IMAGE",
  });
}

async function initBackgroundRemover() {
  if (backgroundRemover) return;
  backgroundRemover = await pipeline("background-removal", "briaai/RMBG-1.4");
}

const api = {
  async detectFaces(image: ImageBitmap | HTMLImageElement | HTMLCanvasElement) {
    await initFaceDetector();
    if (!faceDetector) throw new Error("Face detector not initialized");
    return faceDetector.detect(image);
  },

  async removeBackground(
    input: ImageBitmap | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas
  ): Promise<ImageBitmap> {
    await initBackgroundRemover();
    if (!backgroundRemover)
      throw new Error("Background remover not initialized");

    // Convert any input to OffscreenCanvas (supported by pipeline)
    let canvas: OffscreenCanvas;

    if (input instanceof ImageBitmap) {
      canvas = new OffscreenCanvas(input.width, input.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to get 2D context for ImageBitmap");
      ctx.drawImage(input, 0, 0);
    } else if (input instanceof OffscreenCanvas) {
      canvas = input;
    } else if (input instanceof HTMLCanvasElement) {
      canvas = new OffscreenCanvas(input.width, input.height);
      const ctx = canvas.getContext("2d");
      if (!ctx)
        throw new Error("Failed to get 2D context for HTMLCanvasElement");
      ctx.drawImage(input, 0, 0);
    } else if (input instanceof HTMLImageElement) {
      canvas = new OffscreenCanvas(
        input.naturalWidth || input.width,
        input.naturalHeight || input.height
      );
      const ctx = canvas.getContext("2d");
      if (!ctx)
        throw new Error("Failed to get 2D context for HTMLImageElement");
      ctx.drawImage(input, 0, 0);
    } else {
      throw new Error("Unsupported input type for background removal");
    }

    // Run inference with OffscreenCanvas (explicitly supported)
    const output = await backgroundRemover(canvas);

    // Handle output (usually array with RawImage or object with .image)
    const rawImage = Array.isArray(output)
      ? output[0]
      : (output as any).image || output;

    if (!rawImage || !rawImage.data || !rawImage.width || !rawImage.height) {
      throw new Error("Invalid output from background removal model");
    }

    // Create result canvas and draw transparent result
    const resultCanvas = new OffscreenCanvas(rawImage.width, rawImage.height);
    const resultCtx = resultCanvas.getContext("2d");
    if (!resultCtx) throw new Error("Failed to get result canvas context");

    const imageData = new ImageData(
      new Uint8ClampedArray(rawImage.data),
      rawImage.width,
      rawImage.height
    );
    resultCtx.putImageData(imageData, 0, 0);

    const bitmap = resultCanvas.transferToImageBitmap();
    return Comlink.transfer(bitmap, [bitmap]);
  },
};

Comlink.expose(api);

export type AiWorkerApi = typeof api;