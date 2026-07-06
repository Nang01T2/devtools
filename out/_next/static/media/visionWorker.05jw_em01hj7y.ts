// Vision Web Worker entrypoint — not exported from the package index.
// Bundled via `new Worker(new URL('./visionWorker.ts', import.meta.url))` in aiProcessor.ts.
// Handles only the three vision methods (detectFaces, removeBackground,
// preloadBackgroundRemover) so it can run concurrently with the audio worker.
//
// Background removal uses @huggingface/transformers (same as the audio worker), so the
// desktop offline env setup below is required here too.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { env } from "@huggingface/transformers";
import {
  w,
  normalizeOrtError,
  capWasmThreads,
} from "./worker/shared/workerUtils";

if (
  typeof self !== "undefined" &&
  (self as unknown as { location?: Location }).location?.protocol === "app:"
) {
  env.allowRemoteModels = true;
  env.allowLocalModels = false;
  env.remoteHost = "app://local/models";
  env.remotePathTemplate = "{model}/";
  env.useBrowserCache = false;
  (env.backends as any).onnx.wasm.wasmPaths = "app://local/ort/";
  capWasmThreads(env);
} else if (typeof self !== "undefined" && self.crossOriginIsolated) {
  // Web: same crossOriginIsolated-gated cap as aiWorker.ts — see that file's
  // comment for the full reasoning.
  capWasmThreads(env);
}

import { visionApi } from "./worker/vision/api";
import type { VisionBridgeMethods } from "./meta";

const api = visionApi satisfies VisionBridgeMethods;

// Per-call AbortControllers — mirrors the audio worker (F8). Vision methods are
// single-inference (no loops to check), but the controller is still wired so
// a future method that adds loops inherits cancel support automatically.
const _abortControllers = new Map<string, AbortController>();

w.addEventListener("message", async (ev: MessageEvent) => {
  const { type, id, method, args } = ev.data ?? {};

  if (type === "ai-abort") {
    _abortControllers.get(id)?.abort();
    return;
  }

  if (type !== "ai-call" || !id) return;

  const ac = new AbortController();
  _abortControllers.set(id, ac);

  try {
    const fn = (api as any)[method];
    if (typeof fn !== "function") {
      throw new TypeError(`Unknown vision method: ${method}`);
    }
    const value = await fn.apply(api, [...(args ?? []), ac.signal]);

    if (value instanceof ImageBitmap) {
      w.postMessage({ type: "ai-result", id, value }, [value] as any);
    } else {
      w.postMessage({ type: "ai-result", id, value });
    }
  } catch (err: any) {
    w.postMessage({ type: "ai-error", id, message: normalizeOrtError(err) });
  } finally {
    _abortControllers.delete(id);
  }
});

export type VisionWorkerApi = typeof api;
