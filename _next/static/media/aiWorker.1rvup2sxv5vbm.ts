// Audio Web Worker entrypoint — not exported from the package index.
// Bundled via `new Worker(new URL('./aiWorker.ts', import.meta.url))` in aiProcessor.ts.
// onnxruntime-web and transformers.js pipelines have no public TypeScript types for
// their internal inference tensors, pipeline outputs, or progress callbacks. We use
// `any` intentionally throughout this package rather than making up phantom interfaces
// that would drift silently. All external-facing types are declared in meta.ts.
//
// This file handles AUDIO-ONLY methods. Vision methods run in visionWorker.ts so both
// can run concurrently. The Turbopack bootstrap collision (two module workers sharing
// the same URL) is resolved by the ?wk= discriminator patch in layout.tsx — see
// ai-integration.md for details.
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

import { w, normalizeOrtError } from "./worker/shared/workerUtils";
import { audioApi } from "./worker/audio/api";
import { setDebugEnabled as setCtcAlignDebugEnabled } from "./ctcAlign";
import type { AudioBridgeMethods } from "./meta";

// ctcAlign.ts keeps its own __DEV__ (see comment there — it stays free of any
// workerUtils.ts import so its plain-Node unit tests don't need a `self`
// global). Forward the same "ai-init" signal workerUtils.ts's reportDebug()
// already listens for, so desktop's forced-alignment skip/fallback warnings
// aren't silently dropped like the rest of the AI pipeline's debug logs were.
w.addEventListener("message", (ev: MessageEvent) => {
  if (ev.data?.type === "ai-init") setCtcAlignDebugEnabled(!!ev.data.isDebug);
});

// `satisfies AudioBridgeMethods` is the CONTRACT GUARD: the worker api must structurally
// implement every audio method. A reordered, renamed, wrong-typed, or wrong-return
// method is a COMPILE error here instead of a runtime "Unknown AI method" or silent
// arg shift. The reciprocal check (methodNames ≡ keyof AiBridgeMethods) lives in meta.ts.
// See ai-core-audit.md C1.
const api = audioApi satisfies AudioBridgeMethods;

// Message-based RPC — no Comlink.
// Main thread sends: { type: "ai-call", id: string, method: string, args: any[] }
//                    { type: "ai-abort", id: string }  — cooperative cancel (F8)
// Worker replies:    { type: "ai-result", id, value } | { type: "ai-error", id, message }
// Progress:         { type: "ai-progress", progress, text }  (no id, ignored by main RPC loop)

// Per-call AbortControllers — the main thread sends { type: "ai-abort", id } to signal
// cooperative cancellation. The running function receives the signal as its last argument
// and checks it at loop boundaries (transcribeAudio window loop, alignWords chunk /
// per-segment loops, translateTexts per-line loop, synthesizeDubAudio per-segment).
// The worker is NOT terminated on abort — cached models stay loaded.
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
      throw new TypeError(`Unknown AI method: ${method}`);
    }
    // Pass signal as the extra trailing argument — api functions declare it as
    // optional last param (`signal?: AbortSignal`) so they can check it at each
    // chunk / window / segment boundary without changing AiBridgeMethods.
    const value = await fn.apply(api, [...(args ?? []), ac.signal]);

    if (value && value.samples instanceof Float32Array) {
      // Transfer the Float32Array buffer (zero-copy — avoids cloning 4–40 MB for long videos)
      w.postMessage({ type: "ai-result", id, value }, [
        value.samples.buffer,
      ] as any);
    } else {
      w.postMessage({ type: "ai-result", id, value });
    }
  } catch (err: any) {
    w.postMessage({ type: "ai-error", id, message: normalizeOrtError(err) });
  } finally {
    _abortControllers.delete(id);
  }
});

export type AudioWorkerApi = typeof api;
