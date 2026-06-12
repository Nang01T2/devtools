// processors/aiWorker.ts
import * as Comlink from "comlink";
import { FilesetResolver, FaceDetector } from "@mediapipe/tasks-vision";
import { pipeline } from "@huggingface/transformers";

let faceDetector: FaceDetector | null = null;
const backgroundRemovers = new Map<string, any>();

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

async function getBackgroundRemover(
  modelId: string,
  onProgress?: (progress: number, text: string) => void
) {
  if (backgroundRemovers.has(modelId)) {
    return backgroundRemovers.get(modelId);
  }

  // Supported models (add more as needed)
  const supportedModels = [
    "briaai/RMBG-1.4", // High quality general-purpose
    "Xenova/modnet", // Lighter, good for portraits
    // Add others like "Xenova/isnet-general-use" if desired
  ];

  if (!supportedModels.includes(modelId)) {
    throw new Error(`Unsupported model: ${modelId}`);
  }

  // Progress callback for model loading
  const remover = await pipeline("background-removal", modelId, {
    progress_callback: (data: any) => {
      if (data.status === "progress") {
        const percent = Math.round((data.loaded / data.total) * 100);
        onProgress?.(percent, `Loading model...`);
      } else if (data.status === "done") {
        onProgress?.(100, "Model loaded!");
      }
    },
  });

  backgroundRemovers.set(modelId, remover);
  return remover;
}

const api = {
  async detectFaces(image: ImageBitmap | HTMLImageElement | HTMLCanvasElement) {
    await initFaceDetector();
    if (!faceDetector) throw new Error("Face detector not initialized");
    return faceDetector.detect(image);
  },

  async removeBackground(
    modelId: string = "briaai/RMBG-1.4",
    input: ImageBitmap | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas,
    onProgress?: (progress: number, text: string) => void
  ): Promise<ImageBitmap> {
    const backgroundRemover = await getBackgroundRemover(modelId, onProgress);

    onProgress?.(10, "Removing background ...");

    let canvas: OffscreenCanvas;

    if (input instanceof ImageBitmap) {
      canvas = new OffscreenCanvas(input.width, input.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to get 2D context");
      ctx.drawImage(input, 0, 0);
    } else if (input instanceof OffscreenCanvas) {
      canvas = input;
    } else if (input instanceof HTMLCanvasElement) {
      canvas = new OffscreenCanvas(input.width, input.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to get 2D context");
      ctx.drawImage(input, 0, 0);
    } else if (input instanceof HTMLImageElement) {
      canvas = new OffscreenCanvas(
        input.naturalWidth || input.width,
        input.naturalHeight || input.height
      );
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to get 2D context");
      ctx.drawImage(input, 0, 0);
    } else {
      throw new Error("Unsupported input type");
    }

    // Fake inference progress (since pipeline doesn't provide real inference progress)
    let fakePercent = 30;
    const progressInterval = setInterval(() => {
      fakePercent = Math.min(90, fakePercent + (Math.random() * 8 + 5));
      onProgress?.(fakePercent, "Removing background...");
    }, 800);

    try {
      const output = await backgroundRemover(canvas);
      clearInterval(progressInterval);
      onProgress?.(95, "Finalizing output...");

      const rawImage = Array.isArray(output)
        ? output[0]
        : (output as any).image || output;

      if (!rawImage?.data || !rawImage.width || !rawImage.height) {
        throw new Error("Invalid model output");
      }

      const resultCanvas = new OffscreenCanvas(rawImage.width, rawImage.height);
      const resultCtx = resultCanvas.getContext("2d");
      if (!resultCtx) throw new Error("Failed to get result context");

      const imageData = new ImageData(
        new Uint8ClampedArray(rawImage.data),
        rawImage.width,
        rawImage.height
      );
      resultCtx.putImageData(imageData, 0, 0);

      const bitmap = resultCanvas.transferToImageBitmap();
      onProgress?.(100, "Done!");

      return Comlink.transfer(bitmap, [bitmap]);
    } catch (err) {
      clearInterval(progressInterval);
      throw err;
    }
  },
};

Comlink.expose(api);

export type AiWorkerApi = typeof api;