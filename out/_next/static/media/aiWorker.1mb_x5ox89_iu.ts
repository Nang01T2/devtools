// processors/aiWorker.ts
import { FilesetResolver, FaceDetector } from "@mediapipe/tasks-vision";
import { pipeline } from "@huggingface/transformers";

let faceDetector: FaceDetector | null = null;
const backgroundRemovers = new Map<string, any>();

const w = self as unknown as Worker;

function reportProgress(progress: number, text: string) {
  w.postMessage({ type: "ai-progress", progress, text });
}

async function initFaceDetector() {
  if (faceDetector) return;
  const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
  const modelAssetPath = "/mediapipe/models/blaze_face_short_range.tflite";
  const makeDetector = (delegate: "GPU" | "CPU") =>
    FaceDetector.createFromOptions(vision, {
      baseOptions: { modelAssetPath, delegate },
      runningMode: "IMAGE",
    });
  faceDetector = await makeDetector("GPU").catch((err) => {
    console.warn(
      "MediaPipe GPU delegate failed in worker, retrying with CPU:",
      err,
    );
    return makeDetector("CPU");
  });
}

async function getBackgroundRemover(modelId: string) {
  if (backgroundRemovers.has(modelId)) return backgroundRemovers.get(modelId);

  const supportedModels = ["briaai/RMBG-1.4", "Xenova/modnet"];
  if (!supportedModels.includes(modelId)) {
    throw new Error(`Unsupported model: ${modelId}`);
  }

  const remover = await pipeline("background-removal", modelId, {
    progress_callback: (data: any) => {
      if (data.status === "progress" && data.total > 0) {
        const percent = Math.round((data.loaded / data.total) * 100);
        reportProgress(percent, "Loading model...");
      } else if (data.status === "done") {
        reportProgress(100, "Model loaded!");
      }
    },
  });

  backgroundRemovers.set(modelId, remover);
  return remover;
}

const api = {
  async preloadBackgroundRemover(
    modelId: string = "briaai/RMBG-1.4",
  ): Promise<void> {
    await getBackgroundRemover(modelId);
  },

  async detectFaces(image: ImageBitmap | HTMLImageElement | HTMLCanvasElement) {
    await initFaceDetector();
    if (!faceDetector) throw new Error("Face detector not initialized");
    return faceDetector.detect(image);
  },

  async removeBackground(
    modelId: string = "briaai/RMBG-1.4",
    input: ImageBitmap | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas,
  ): Promise<ImageBitmap> {
    if (typeof OffscreenCanvas === "undefined") {
      if (input instanceof ImageBitmap) input.close();
      throw new Error(
        "Background removal requires a modern browser (Safari 16.4+, Chrome 69+)",
      );
    }
    // After transfer the worker is sole owner of the bitmap. If getBackgroundRemover
    // throws before the draw-path finally block, we must release it here.
    const ownedBitmap = input instanceof ImageBitmap ? input : null;
    let backgroundRemover: any;
    try {
      backgroundRemover = await getBackgroundRemover(modelId);
    } catch (err) {
      ownedBitmap?.close();
      throw err;
    }

    reportProgress(10, "Removing background...");

    let canvas: OffscreenCanvas;

    if (input instanceof ImageBitmap) {
      canvas = new OffscreenCanvas(input.width, input.height);
      try {
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Failed to get 2D context");
        ctx.drawImage(input, 0, 0);
      } finally {
        input.close();
      }
    } else if (input instanceof OffscreenCanvas) {
      canvas = input;
    } else if (input instanceof HTMLCanvasElement) {
      // Unreachable in a Worker context (HTMLCanvasElement is a main-thread DOM
      // type) — kept so the public signature remains usable if this function is
      // ever called outside a Worker.
      canvas = new OffscreenCanvas(input.width, input.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to get 2D context");
      ctx.drawImage(input, 0, 0);
    } else if (input instanceof HTMLImageElement) {
      // Same as above — unreachable via postMessage / structured clone.
      canvas = new OffscreenCanvas(
        input.naturalWidth || input.width,
        input.naturalHeight || input.height,
      );
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to get 2D context");
      ctx.drawImage(input, 0, 0);
    } else {
      throw new Error("Unsupported input type");
    }

    // Fake per-step progress (model doesn't expose internal progress)
    let fakePercent = 30;
    const progressInterval = setInterval(() => {
      fakePercent = Math.min(90, fakePercent + (Math.random() * 8 + 5));
      reportProgress(fakePercent, "Removing background...");
    }, 800);

    try {
      const output = await backgroundRemover(canvas);
      clearInterval(progressInterval);
      reportProgress(95, "Finalizing output...");

      const rawImage = Array.isArray(output)
        ? output[0]
        : (output as any).image || output;

      if (!rawImage?.data || !rawImage.width || !rawImage.height) {
        throw new Error("Invalid model output");
      }

      const resultCanvas = new OffscreenCanvas(rawImage.width, rawImage.height);
      const resultCtx = resultCanvas.getContext("2d");
      if (!resultCtx) throw new Error("Failed to get result context");

      resultCtx.putImageData(
        new ImageData(
          new Uint8ClampedArray(rawImage.data),
          rawImage.width,
          rawImage.height,
        ),
        0,
        0,
      );

      const bitmap = resultCanvas.transferToImageBitmap();
      reportProgress(100, "Done!");
      return bitmap;
    } catch (err) {
      clearInterval(progressInterval);
      throw err;
    }
  },
};

// Message-based RPC — no Comlink.
// Main thread sends: { type: "ai-call", id: string, method: string, args: any[] }
// Worker replies:    { type: "ai-result", id, value } | { type: "ai-error", id, message }
// Progress:         { type: "ai-progress", progress, text }  (no id, ignored by main RPC loop)
w.addEventListener("message", async (ev: MessageEvent) => {
  const { type, id, method, args } = ev.data ?? {};
  if (type !== "ai-call" || !id) return;

  try {
    const fn = (api as any)[method];
    if (typeof fn !== "function") {
      throw new TypeError(`Unknown AI method: ${method}`);
    }
    const value = await fn.apply(api, args ?? []);

    if (value instanceof ImageBitmap) {
      // Transfer the bitmap so the main thread receives it without a copy
      w.postMessage({ type: "ai-result", id, value }, [value] as any);
    } else {
      w.postMessage({ type: "ai-result", id, value });
    }
  } catch (err: any) {
    w.postMessage({
      type: "ai-error",
      id,
      message: err?.message ?? String(err),
    });
  }
});

export type AiWorkerApi = typeof api;
