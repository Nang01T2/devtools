// Internal Web Worker entrypoint — not exported from the package index.
// Bundled via `new Worker(new URL('./aiWorker.ts', import.meta.url))` in aiProcessor.ts.
// onnxruntime-web and transformers.js pipelines have no public TypeScript types for
// their internal inference tensors, pipeline outputs, or progress callbacks. We use
// `any` intentionally throughout this package rather than making up phantom interfaces
// that would drift silently. All external-facing types are declared in meta.ts.
//
// This file is a THIN SHELL: the desktop ORT env setup, the composed `api` object,
// and the postMessage RPC handler. The actual model loaders + method bodies live in
// worker/audio/* and worker/vision/*, composed below into ONE runtime worker (the
// single-worker constraint is load-bearing — see the Turbopack bootstrap collision
// note in ai-integration.md; two distinct module-worker URLs would collide).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { env } from "@huggingface/transformers";

// Desktop (Electron) offline mode — gated on the app:// origin so the WEB build
// is byte-for-byte unaffected (web runs under http(s): → this block is skipped).
// Models + the ORT runtime wasm are vendored into the app's resources and served
// over app://, so transformers.js never touches the network. See the
// meme-maker-desktop-electron plan (F03).
if (
  typeof self !== "undefined" &&
  (self as unknown as { location?: Location }).location?.protocol === "app:"
) {
  // Use the REMOTE code path (which treats an optional-file 404 as "absent →
  // skip", exactly like the online web build) but point it at the vendored
  // local files over app://. The strict LOCAL path instead throws on a 404 for
  // optional files that don't exist upstream (e.g. mms-tts has no
  // preprocessor_config.json), so it can't be used. allowLocalModels=false
  // forces the remote path; nothing ever leaves the machine (app:// is local).
  env.allowRemoteModels = true;
  env.allowLocalModels = false;
  env.remoteHost = "app://local/models"; // base; joined with the template below
  env.remotePathTemplate = "{model}/"; // → app://local/models/<org>/<name>/<file>
  env.useBrowserCache = false; // app:// is already local; no Cache API needed
  // Vendored ONNX Runtime wasm (ort-wasm-simd-threaded[.jsep].wasm).
  (env.backends as any).onnx.wasm.wasmPaths = "app://local/ort/";
  // Limit WASM CPU threads. Without this, ORT uses navigator.hardwareConcurrency
  // (e.g. 10 on M-series) and hammers all cores during wav2vec2 alignment
  // while Whisper is simultaneously loading the GPU → machine runs hot.
  // Cap at 4 on high-core machines; gracefully halve on low-core hardware.
  (env.backends as any).onnx.wasm.numThreads = Math.min(
    4,
    Math.max(1, Math.floor(navigator.hardwareConcurrency / 2)),
  );
}

import { w } from "./worker/shared/workerUtils";
import { audioApi } from "./worker/audio/api";
import { visionApi } from "./worker/vision/api";
import type { AiBridgeMethods } from "./meta";

// One worker, two domain namespaces. The RPC handler dispatches by method name,
// so the spread order is irrelevant (there are no name collisions across domains).
//
// `satisfies AiBridgeMethods` is the CONTRACT GUARD: the worker api must structurally
// implement every method of the bridge contract. The proxy-injected trailing
// `onProgress` is OPTIONAL in the contract, so an impl that omits it still satisfies;
// but a reordered, renamed, wrong-typed, or wrong-return method becomes a COMPILE
// error here instead of a runtime "Unknown AI method" or silent arg shift. The
// reciprocal check (methodNames ≡ keyof AiBridgeMethods) lives in meta.ts. See
// ai-core-audit.md C1.
const api = { ...audioApi, ...visionApi } satisfies AiBridgeMethods;

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
    } else if (value && value.samples instanceof Float32Array) {
      // Transfer the Float32Array buffer (zero-copy — avoids cloning 4–40 MB for long videos)
      w.postMessage({ type: "ai-result", id, value }, [
        value.samples.buffer,
      ] as any);
    } else {
      w.postMessage({ type: "ai-result", id, value });
    }
  } catch (err: any) {
    let message: string = err?.message ?? String(err);
    // ORT WASM aborts surface as a plain integer (the C++ exception pointer) when a
    // model fails to load or run (OOM, unsupported op, missing ONNX file). Replace
    // the bare number with a readable hint, keeping any [load]/[infer:backend] step
    // prefix and the raw code (useful for diagnosis). `\d{6,}` (no `$` anchor) targets
    // the large abort-pointer integers (observed 9–10 digits) even when ORT appends
    // context after them, while leaving small ORT error codes ("128 : shape mismatch")
    // and text-first messages ("Can't create a session …") readable.
    const m = message.match(/^(\[(?:load|infer)[^\]]{0,40}\]\s*)?(\d{6,})/);
    if (typeof err === "number" || m) {
      const step = m?.[1] ?? "";
      const code = m?.[2] ?? String(err);
      message =
        `${step}AI model error (ORT internal error ${code}): the model could not be ` +
        "loaded or run. It may be too large for this device, or WebGPU is unavailable — " +
        "try the Base model.";
    }
    w.postMessage({ type: "ai-error", id, message });
  }
});

export type AiWorkerApi = typeof api;
