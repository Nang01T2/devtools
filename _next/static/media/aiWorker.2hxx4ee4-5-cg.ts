// processors/aiWorker.ts
// onnxruntime-web and transformers.js pipelines have no public TypeScript types for
// their internal inference tensors, pipeline outputs, or progress callbacks. We use
// `any` intentionally throughout this file rather than making up phantom interfaces
// that would drift silently. All external-facing types are declared in meta.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { FilesetResolver, FaceDetector } from "@mediapipe/tasks-vision";
import { pipeline } from "@huggingface/transformers";
// Same onnxruntime-web instance transformers.js bundles (single ORT copy → no
// backend conflict). Used to run Silero VAD before Whisper.
// @ts-expect-error onnxruntime-web's package "exports" map omits a "types"
// condition (resolves to the bundled .mjs), so it's untyped under bundler
// resolution — used loosely as `any` here, like the rest of this worker.
import * as ort from "onnxruntime-web";
import {
  probsToSpeechRegions,
  overlapsSpeech,
  type SpeechRegion,
} from "./vadSegments";
import { SUPPORTED_WHISPER_MODEL_IDS, type WhisperModelId } from "./meta";
import {
  alignSegment,
  logSoftmaxInPlace,
  normalizeAlignText,
  shouldUseGlobalAlign,
} from "./ctcAlign";

let faceDetector: FaceDetector | null = null;
const backgroundRemovers = new Map<string, any>();
const transcribers = new Map<string, any>();
// Held in an object so the formatter doesn't convert to const (same pattern as wav2vec).
const translatorSingleton = {
  instance: null as any,
  loadingPromise: null as Promise<any> | null,
};
let vadSession: any = null;
// wav2vec2-base-960h for English CTC forced alignment (Phase 2 word-level karaoke).
// Mutable via getWav2Vec() — held in an object so the formatter doesn't convert to const.
const wav2vec = {
  model: null as any,
  processor: null as any,
  vocab: null as Record<string, number> | null,
  loadingPromise: null as Promise<{
    model: any;
    processor: any;
    vocab: Record<string, number>;
    blankId: number;
    unkId: number;
  }> | null,
};

const w = self as unknown as Worker;

// `text` is a STABLE STATUS TOKEN (not display prose) — the worker has no access
// to the i18n hook, so useBackgroundRemoval maps these tokens to localized strings
// (icongenerator.preview-progress-*). Keep tokens in sync with that map.
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
        reportProgress(percent, "loading-model");
      } else if (data.status === "done") {
        reportProgress(100, "model-loaded");
      }
    },
  });

  backgroundRemovers.set(modelId, remover);
  return remover;
}

type LoadConfig = { device?: "webgpu"; dtype?: string };

// Ordered backend configs per model — tried top-to-bottom until one both LOADS and
// RUNS inference (see transcribeWithFallback). Two hard constraints learned the hard way:
//
//   • WASM 32-bit heap: the big models abort during inference with a raw integer
//     exception. Word-level timestamps were the main driver (see WHISPER_WORD_TIMESTAMPS)
//     — with segment-level timestamps, WASM-quantized inference fits.
//   • WebGPU EP (onnxruntime-web JSEP) executes FLOAT ops (fp32/fp16) but NOT int8/int4:
//     a `webgpu` + `q8`/`q4` config *loads* fine, then aborts at execution
//     ("error during model execution"). So the Whisper WebGPU configs below use
//     fp16 (VRAM-efficient at that size); quantized variants stay WASM-only.
//     fp32-on-WebGPU is equally valid (the MMS aligner in getMms() uses fp16,
//     the smallest accurate WebGPU dtype — 4-bit variants degrade alignment);
//     JSEP runs any float dtype; only int8/int4 are the WASM-only ones.
//
// Falling back on execution (not just load) is essential: a config can load and then
// fail to run, so the loop must verify a real inference before committing to a backend.
const WHISPER_LOAD_CONFIGS: Record<string, LoadConfig[]> = {
  // base: prefer WebGPU fp16 (~75 MB, 3-5× faster than WASM); q8 fallback for no-GPU
  // machines (~38 MB). Both are safe with word-level timestamps (6 encoder layers × 8
  // heads — no WASM heap OOM risk at this size).
  "onnx-community/whisper-base": [
    { device: "webgpu", dtype: "fp16" },
    { dtype: "q8" },
  ],
  // turbo ships fp16 ONNX → runs on WebGPU (the only backend that fits it: WASM aborts
  // during inference, and JSEP can't execute the int8 variants). The WASM-q8 entry is a
  // best-effort fallback for no-GPU machines; it will likely abort on this size,
  // surfacing a tagged "[infer:wasm/q8] …" error that tells the user to pick Base.
  "onnx-community/whisper-large-v3-turbo": [
    { device: "webgpu", dtype: "fp16" },
    { dtype: "q8" },
  ],
};

function backendLabel(cfg: LoadConfig): string {
  return cfg.device === "webgpu"
    ? `webgpu/${cfg.dtype ?? "default"}`
    : `wasm/${cfg.dtype ?? "default"}`;
}

async function resolveConfigs(modelId: string): Promise<LoadConfig[]> {
  const configs = WHISPER_LOAD_CONFIGS[modelId] ?? [{}];
  // Drop WebGPU configs up front when there's no adapter, so a non-GPU machine goes
  // straight to the WASM fallback instead of paying a failed GPU init first.
  if (!(await hasWebGPU())) {
    const wasmOnly = configs.filter((c) => c.device !== "webgpu");
    return wasmOnly.length > 0 ? wasmOnly : [{}];
  }
  return configs;
}

// Word-level timestamps (`return_timestamps: "word"`) force transformers.js to keep
// the cross-attention weights of EVERY decoder layer × head to run DTW alignment —
// cheap for base (6 layers × 8 heads) but a large memory multiplier for medium
// (24 × 16) / turbo that can abort the WASM heap during *inference* even after the
// weights load fine. Use lighter segment-level timestamps (`return_timestamps: true`,
// no cross-attention retention) for the big models; keep word-level for base only.
// Typed exhaustively (Record<WhisperModelId, …>) so adding a model to
// SUPPORTED_WHISPER_MODEL_IDS without a timestamp policy here is a compile error.
const WHISPER_WORD_TIMESTAMPS: Record<WhisperModelId, boolean> = {
  "onnx-community/whisper-base": true,
  "onnx-community/whisper-large-v3-turbo": false,
};

// modelId → human label of the backend/dtype that actually loaded (for diagnostics).
const transcriberBackends = new Map<string, string>();

let webgpuAvailable: boolean | null = null;
async function hasWebGPU(): Promise<boolean> {
  if (webgpuAvailable !== null) return webgpuAvailable;
  try {
    const gpu = (navigator as any).gpu;
    const adapter = gpu ? await gpu.requestAdapter() : null;
    webgpuAvailable = !!adapter;
  } catch {
    webgpuAvailable = false;
  }
  return webgpuAvailable;
}

// Per-model, per-file download byte tallies, so the loading % is a SMOOTH
// aggregate instead of resetting 0→100 for each of a model's files. Keyed by
// model `name` so concurrent/sequential model loads don't pollute each other
// (and a reload just overwrites the same file entries — no stale growth).
const dlProgress: Record<
  string,
  Record<string, { loaded: number; total: number }>
> = {};
let lastLoadPct = -1;
let lastLoadName = "";

const transcriberProgress = (data: any) => {
  // Only the streaming download events carry bytes. We deliberately IGNORE
  // status==="done": it fires once PER FILE, and emitting "model-loaded" there
  // flashed the next phase ("Transcribing") between loading updates → flicker.
  // The real model-loaded→transcribing/aligning transition is reported by the
  // caller after from_pretrained resolves (the "transcribing"/"aligning" tokens).
  if (data.status !== "progress" || !(data.total > 0)) return;
  const name = data.name ?? "model";
  // A different model started loading → reset the dedupe so its first % always
  // emits (the previous model may have left lastLoadPct at 100).
  if (name !== lastLoadName) {
    lastLoadName = name;
    lastLoadPct = -1;
  }
  const files = (dlProgress[name] ??= {});
  files[data.file ?? "_"] = { loaded: data.loaded, total: data.total };
  let loaded = 0;
  let total = 0;
  for (const f of Object.values(files)) {
    loaded += f.loaded;
    total += f.total;
  }
  const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
  // Skip duplicate percentages — avoids redundant postMessage / re-render churn.
  if (pct === lastLoadPct) return;
  lastLoadPct = pct;
  reportProgress(pct, "loading-model");
};

function rawErr(err: any): string | number {
  return typeof err === "number" ? err : (err?.message ?? String(err));
}

/**
 * Load a transcription pipeline, retrying once on a transient network error.
 * transformers.js surfaces a flaky fetch (HF hiccup / rate limit) as a generic
 * "network error" even when the ONNX file exists — without the retry, one such blip
 * on the preferred WebGPU/fp16 config would drop us to the WASM fallback that can't
 * run these big models. Non-network errors (404, unsupported dtype) are not retried.
 */
async function loadTranscriberPipeline(
  modelId: string,
  cfg: LoadConfig,
): Promise<any> {
  const make = () =>
    pipeline("automatic-speech-recognition", modelId, {
      ...cfg,
      progress_callback: transcriberProgress,
    } as any); // dtype is a free string here; cast past the strict DataType union
  try {
    return await make();
  } catch (err: any) {
    const msg = String(err?.message ?? err).toLowerCase();
    if (msg.includes("network") || msg.includes("failed to fetch")) {
      console.warn(
        `[aiWorker] transient load error (${modelId}, ${backendLabel(cfg)}) — retrying once`,
      );
      return await make();
    }
    throw err;
  }
}

/**
 * Run Whisper transcription, falling back across WHISPER_LOAD_CONFIGS on EITHER a
 * load failure OR an inference failure, until one backend both loads and produces a
 * result. The first working transcriber is cached for reuse.
 *
 * Returns the raw pipeline output. Throws `[load:<backend>] …` if every config fails
 * to load, or `[infer:<backend>] …` if a model loads but inference aborts everywhere.
 */
async function transcribeWithFallback(
  modelId: string,
  audio: Float32Array,
  inferOpts: Record<string, unknown>,
): Promise<any> {
  // Reuse a previously-validated transcriber (already proven to load AND run).
  const cached = transcribers.get(modelId);
  if (cached) {
    const t = await cached;
    try {
      return await t(audio, inferOpts);
    } catch (err: any) {
      // A cached transcriber that stops working: evict so the next call re-runs the
      // whole fallback search rather than failing on the same backend forever.
      transcribers.delete(modelId);
      const label = transcriberBackends.get(modelId) ?? "?";
      transcriberBackends.delete(modelId);
      throw new Error(`[infer:${label}] ${rawErr(err)}`);
    }
  }

  const configs = await resolveConfigs(modelId);
  let lastErr: unknown;
  let lastStep: "load" | "infer" = "load";
  let lastLabel = "?";
  reportProgress(60, "transcribing"); // once, not per-config-attempt
  for (const cfg of configs) {
    const label = backendLabel(cfg);
    lastLabel = label;
    let pipe: any;
    // --- load (one retry on transient network errors) ---
    try {
      pipe = await loadTranscriberPipeline(modelId, cfg);
    } catch (err: any) {
      lastErr = err;
      lastStep = "load";
      console.warn(
        `[aiWorker] load failed (${modelId}, ${label}): ${rawErr(err)}`,
      );
      continue;
    }
    // --- inference (the actual transcription; verifies the backend can execute) ---
    try {
      // Reset chunk counter so a fallback backend doesn't inherit the partial
      // progress from the previous backend's failed inference run.
      (inferOpts.callback_function as { reset?: () => void })?.reset?.();
      const out = await pipe(audio, inferOpts);
      transcribers.set(modelId, Promise.resolve(pipe));
      transcriberBackends.set(modelId, label);
      console.info(`[aiWorker] transcribed (${modelId}) on ${label}`);
      return out;
    } catch (err: any) {
      lastErr = err;
      lastStep = "infer";
      console.warn(
        `[aiWorker] inference failed (${modelId}, ${label}): ${rawErr(err)}`,
      );
      // Free the failed pipeline (esp. a WebGPU device) before the next attempt.
      try {
        await pipe?.dispose?.();
      } catch {
        /* ignore dispose errors */
      }
    }
  }
  throw new Error(`[${lastStep}:${lastLabel}] ${rawErr(lastErr)}`);
}

async function getTranslator() {
  if (translatorSingleton.instance) return translatorSingleton.instance;
  if (translatorSingleton.loadingPromise)
    return translatorSingleton.loadingPromise;
  // m2m100_418M: ~350 MB quantized ONNX, covers 100 languages, no server.
  // Reuse the shared aggregating callback so the translate model-load shows a
  // smooth % and doesn't flicker on per-file "done" (same fix as transcribe/
  // align). The post-load transition is signaled by the "translating" token.
  // Cache the in-flight Promise so concurrent callers don't double-download.
  translatorSingleton.loadingPromise = pipeline(
    "translation",
    "Xenova/m2m100_418M",
    { progress_callback: transcriberProgress },
  )
    .then((t) => {
      translatorSingleton.instance = t;
      translatorSingleton.loadingPromise = null;
      return t;
    })
    .catch((err) => {
      translatorSingleton.loadingPromise = null;
      throw err;
    });
  return translatorSingleton.loadingPromise;
}

/**
 * Extract a char→token-id map from a transformers.js tokenizer, trying every
 * place the vocab can live across tokenizer classes/versions:
 *   - tokens_to_ids (Map) at the top level OR on the inner TokenizerModel
 *   - vocab / encoder as an Array (index = id) OR a plain object (token → id)
 * Wav2Vec2's AutoProcessor in transformers.js does NOT bundle a tokenizer, and
 * the CTC tokenizer keeps its vocab on `tokenizer.model`, so the old single-path
 * lookup (`processor.tokenizer.tokens_to_ids`) silently returned {} → alignment
 * threw → English fell back to (mis-timed) Whisper DTW. This tries all paths.
 */
function extractTokenizerVocab(tokenizer: any): Record<string, number> {
  const out: Record<string, number> = {};
  if (!tokenizer) return out;
  for (const m of [tokenizer.tokens_to_ids, tokenizer.model?.tokens_to_ids]) {
    if (m instanceof Map) {
      for (const [k, v] of m as Map<string, number>) out[k] = v;
      if (Object.keys(out).length > 0) return out;
    }
  }
  for (const v of [
    tokenizer.vocab,
    tokenizer.model?.vocab,
    tokenizer.encoder,
    tokenizer.model?.encoder,
  ]) {
    if (Array.isArray(v)) {
      v.forEach((ch: string, id: number) => {
        if (ch != null) out[ch] = id;
      });
    } else if (v && typeof v === "object") {
      for (const k of Object.keys(v)) out[k] = (v as Record<string, number>)[k];
    }
    if (Object.keys(out).length > 0) return out;
  }
  return out;
}

/**
 * Lazy-load the wav2vec2-base-960h CTC model for English word alignment.
 * Uses transformers.js AutoModelForCTC + AutoProcessor (ONNX quantized, ~95 MB).
 * Reuses the same progress tokens as transcribeAudio so the UI doesn't need a
 * new i18n key for the "downloading aligner model" state.
 */
async function getWav2Vec(): Promise<{
  model: any;
  processor: any;
  vocab: Record<string, number>;
  blankId: number;
  unkId: number;
}> {
  if (wav2vec.model && wav2vec.processor && wav2vec.vocab) {
    return {
      model: wav2vec.model,
      processor: wav2vec.processor,
      vocab: wav2vec.vocab,
      blankId: wav2vec.vocab["<pad>"] ?? 0,
      unkId: wav2vec.vocab["<unk>"] ?? 3,
    };
  }
  if (wav2vec.loadingPromise) return wav2vec.loadingPromise;
  wav2vec.loadingPromise = (async () => {
    try {
      const { AutoProcessor, AutoModelForCTC, AutoTokenizer } = await import(
        "@huggingface/transformers"
      );
      wav2vec.processor = await AutoProcessor.from_pretrained(
        "Xenova/wav2vec2-base-960h",
      );
      wav2vec.model = await AutoModelForCTC.from_pretrained(
        "Xenova/wav2vec2-base-960h",
        {
          // Default picks model_quantized.onnx (~95 MB) automatically.
          progress_callback: transcriberProgress,
        },
      );
      // The Wav2Vec2 AutoProcessor does NOT bundle a tokenizer (only the feature
      // extractor), so load the CTC tokenizer explicitly to get the char→id vocab.
      const tokenizer =
        wav2vec.processor.tokenizer ??
        (await AutoTokenizer.from_pretrained("Xenova/wav2vec2-base-960h"));
      wav2vec.vocab = extractTokenizerVocab(tokenizer);
      // If every extraction path missed (tokenizer API mismatch), fail loudly so
      // the caller falls back to Whisper DTW instead of using a garbage vocab.
      if (Object.keys(wav2vec.vocab).length === 0) {
        throw new Error(
          "[wav2vec] vocab extraction failed — tokenizer API mismatch",
        );
      }
      return {
        model: wav2vec.model,
        processor: wav2vec.processor,
        vocab: wav2vec.vocab,
        blankId: wav2vec.vocab["<pad>"] ?? 0,
        unkId: wav2vec.vocab["<unk>"] ?? 3,
      };
    } catch (err) {
      // Reset ALL state so a retry is a clean reload — mirrors getMms pattern.
      wav2vec.vocab = null;
      wav2vec.model = null;
      wav2vec.processor = null;
      wav2vec.loadingPromise = null;
      throw err;
    }
  })();
  return wav2vec.loadingPromise;
}

// ── MMS-1130 forced aligner singleton (multilingual) ─────────────────────────
// Loaded lazily on first non-English alignWords() call. The model supports
// 1130 languages via a shared UTF-8 CTC vocabulary. Download: ~632 MB fp16
// (WebGPU) or ~317 MB q8 (WASM fallback).
const mms: {
  model: any;
  processor: any;
  vocab: Record<string, number> | null;
  loadingPromise: Promise<{
    model: any;
    processor: any;
    vocab: Record<string, number>;
    blankId: number;
    unkId: number;
  }> | null;
} = {
  model: null,
  processor: null,
  vocab: null,
  loadingPromise: null,
};

/**
 * Lazy-load onnx-community/mms-300m-1130-forced-aligner-ONNX.
 * Same pattern as getWav2Vec(); progress tokens are reused.
 * Promise-based singleton to prevent concurrent double-load of the ~1.26 GB model.
 */
async function getMms(): Promise<{
  model: any;
  processor: any;
  vocab: Record<string, number>;
  blankId: number;
  unkId: number;
}> {
  if (mms.model && mms.processor && mms.vocab) {
    return {
      model: mms.model,
      processor: mms.processor,
      vocab: mms.vocab,
      blankId: mms.vocab["<pad>"] ?? 0,
      unkId: mms.vocab["<unk>"] ?? 0,
    };
  }
  if (mms.loadingPromise) return mms.loadingPromise;
  mms.loadingPromise = (async () => {
    try {
      const { AutoProcessor, AutoModelForCTC, AutoTokenizer } = await import(
        "@huggingface/transformers"
      );
      mms.processor = await AutoProcessor.from_pretrained(
        "onnx-community/mms-300m-1130-forced-aligner-ONNX",
      );
      // Run the 300M aligner on WebGPU (fp16) when there's an adapter — on
      // WASM/CPU its forward pass takes MINUTES on a ~2-min clip (measured: >4 min,
      // the dominant cost — far exceeds download + trellis). **fp16 (~632 MB) is the
      // smallest dtype that is BOTH accurate AND WebGPU-runnable**: every smaller
      // variant is 4-bit (q4f16/q4/bnb4) which measurably degrades non-English
      // alignment accuracy (Vietnamese word timing drifts), and int8/q8 cannot
      // execute on the WebGPU EP (JSEP runs float only). No adapter → explicit
      // WASM q8 (~317 MB; without dtype the hub default could pull the 1.26 GB fp32
      // onto the CPU heap). NOTE: this download is gated OPT-IN — the caller only
      // reaches getMms() for non-English when the user enables precise word-level
      // karaoke (see index.tsx); otherwise non-English uses Turbo segment timing.
      const useGpu = await hasWebGPU();
      mms.model = await AutoModelForCTC.from_pretrained(
        "onnx-community/mms-300m-1130-forced-aligner-ONNX",
        useGpu
          ? {
              device: "webgpu",
              dtype: "fp16",
              progress_callback: transcriberProgress,
            }
          : { dtype: "q8", progress_callback: transcriberProgress },
      );
      console.info(
        `[aiWorker] MMS aligner loaded on ${useGpu ? "webgpu/fp16" : "wasm/q8"}`,
      );
      const mmsTokenizer =
        mms.processor.tokenizer ??
        (await AutoTokenizer.from_pretrained(
          "onnx-community/mms-300m-1130-forced-aligner-ONNX",
        ));
      mms.vocab = extractTokenizerVocab(mmsTokenizer);
      if (Object.keys(mms.vocab).length === 0) {
        throw new Error(
          "[mms] vocab extraction failed — tokenizer API mismatch",
        );
      }
      return {
        model: mms.model,
        processor: mms.processor,
        vocab: mms.vocab,
        blankId: mms.vocab["<pad>"] ?? 0,
        unkId: mms.vocab["<unk>"] ?? 0,
      };
    } catch (err) {
      // ANY load failure (from_pretrained abort, WebGPU OOM / device-lost, vocab
      // mismatch) must reset ALL state — otherwise the rejected loadingPromise is
      // cached by the guard above and every later non-English align silently
      // degrades to DTW with no retry for the worker's lifetime. A clean reset
      // lets the next alignWords() call re-attempt the load.
      mms.model = null;
      mms.processor = null;
      mms.vocab = null;
      mms.loadingPromise = null;
      throw err;
    }
  })();
  return mms.loadingPromise;
}

const VAD_FRAME = 512; // Silero v5: 512 samples @ 16 kHz (~32 ms)
const VAD_SR = 16000;

async function getVad(): Promise<any> {
  if (vadSession) return vadSession;
  // Self-hosted Silero VAD v5 (~2.3 MB, public/vad/). Reuses the ORT instance
  // transformers.js configured — called AFTER transcription so the wasm
  // backend/paths are already set up.
  vadSession = await ort.InferenceSession.create("/vad/silero_vad.onnx");
  return vadSession;
}

/**
 * Run Silero VAD over 16 kHz mono audio → merged speech regions (seconds).
 * Sequential frame inference carrying the recurrent state, then hysteresis.
 */
async function runVad(audio: Float32Array): Promise<SpeechRegion[]> {
  const sess = await getVad();
  let state = new ort.Tensor(
    "float32",
    new Float32Array(2 * 1 * 128),
    [2, 1, 128],
  );
  const sr = new ort.Tensor("int64", BigInt64Array.from([BigInt(VAD_SR)]), []);
  const probs: number[] = [];
  for (let i = 0; i + VAD_FRAME <= audio.length; i += VAD_FRAME) {
    const input = new ort.Tensor("float32", audio.subarray(i, i + VAD_FRAME), [
      1,
      VAD_FRAME,
    ]);
    const res = await sess.run({ input, state, sr });
    // Guard the output tensor names: a model/code version mismatch (renamed
    // "output"/"stateN") would otherwise silently feed `undefined` back as the
    // recurrent state. Throwing turns it into an actionable warning via the
    // best-effort catch in transcribeAudio (regions=null → keep all captions).
    if (!res.output || !res.stateN) {
      throw new Error("[VAD] unexpected ONNX output names (model mismatch)");
    }
    probs.push((res.output.data as Float32Array)[0]);
    state = res.stateN as ort.Tensor;
  }
  return probsToSpeechRegions(probs, VAD_FRAME, VAD_SR);
}

type WordChunk = { text: string; timestamp: [number, number | null] };

/**
 * Merge word-level Whisper output into subtitle-sized segments.
 * Breaks at silence gaps, word count cap, or duration cap so each segment
 * fits on one caption line.
 *
 * Stride-boundary deduplication: Transformers.js excludes tokens in the overlap
 * window internally (first_timestamp / last_timestamp guards in tokenizers.js),
 * so repeated words across chunk boundaries are not present in `words`.
 *
 * Words with null start timestamps are skipped — matches sanitizeSubtitles
 * which also drops null-start chunks.
 */
function groupWordChunks(words: WordChunk[]): WordChunk[] {
  const SILENCE_BREAK = 0.5; // seconds gap → new segment
  const MAX_WORDS = 8; // readability cap
  const MAX_DURATION = 5.0; // seconds cap

  const out: WordChunk[] = [];
  let buf: string[] = [];
  let segStart = 0;
  let segEnd = 0;

  const flush = () => {
    if (buf.length === 0) return;
    out.push({ text: buf.join("").trimStart(), timestamp: [segStart, segEnd] });
    buf = [];
  };

  for (const word of words) {
    const wStart = word.timestamp[0];
    if (wStart === null) {
      // Null start = boundary/partial frame with no reliable position; skip to
      // match sanitizeSubtitles behaviour which drops these.
      if (buf.length > 0) buf.push(word.text); // still include text in current segment
      continue;
    }
    const wEnd = word.timestamp[1] ?? wStart + 0.5;
    if (buf.length === 0) {
      segStart = wStart;
      segEnd = wEnd;
      buf.push(word.text);
    } else {
      const gap = wStart - segEnd; // negative gap = slight overlap (rounding); treated as 0
      const duration = wEnd - segStart;
      if (
        gap > SILENCE_BREAK ||
        buf.length >= MAX_WORDS ||
        duration > MAX_DURATION
      ) {
        flush();
        segStart = wStart;
        segEnd = wEnd;
        buf.push(word.text);
      } else {
        segEnd = Math.max(segEnd, wEnd);
        buf.push(word.text);
      }
    }
  }
  flush();
  return out;
}

const api = {
  // `audio` arrives copied (not transferred) via structured clone — the caller's
  // ~2 MB / 30 s buffer is small, and copying keeps the caller's buffer usable.
  async transcribeAudio(
    audio: Float32Array,
    modelId = "onnx-community/whisper-base",
    language?: string,
  ): Promise<{
    chunks: { text: string; timestamp: [number, number | null] }[];
    words: { text: string; timestamp: [number, number | null] }[];
    text: string;
  }> {
    if (!(SUPPORTED_WHISPER_MODEL_IDS as readonly string[]).includes(modelId)) {
      throw new Error(`[load] Unsupported Whisper model: ${modelId}`);
    }
    // Timestamp granularity is per-model (WHISPER_WORD_TIMESTAMPS): "word" for base
    // (cross-attention DTW — per-word timing, regrouped by groupWordChunks below); true
    // (segment-level, no cross-attention retention) for medium/turbo, whose word-level
    // cross-attention buffers can abort the WASM heap during inference. Unknown models
    // default to segment-level (the safer, lower-memory path).
    //
    // no_repeat_ngram_size kills the within-window "phrase, phrase…" repetition loop;
    // temperature 0 = deterministic greedy decode. Whisper has no built-in no-speech
    // gate — the VAD post-filter below drops non-speech captions.
    const wantWordTimestamps =
      WHISPER_WORD_TIMESTAMPS[modelId as WhisperModelId] ?? false;
    reportProgress(40, "transcribing");
    // Whisper forces English when no language is given in chunked mode (the pipeline
    // does `language ?? "en"`), so a non-English clip would be mis-transcribed into
    // phonetic English. Pass the user-selected source language; task stays "transcribe"
    // (keep the spoken language) rather than "translate".
    const CHUNK_LEN_S = 30;
    const STRIDE_S = 5;
    const audioDurationS = audio.length / 16000;
    const totalChunks = Math.max(
      1,
      Math.ceil(audioDurationS / (CHUNK_LEN_S - STRIDE_S)),
    );
    let doneChunks = 0;
    // Called by transformers.js after each audio chunk is decoded — gives real
    // per-chunk progress for long videos rather than a static "transcribing" label.
    // The `.reset()` method lets transcribeWithFallback zero the counter before
    // each backend attempt so a failed WebGPU run's partial count doesn't carry
    // over into the WASM fallback, which would freeze the bar at 95%.
    const chunkCb = Object.assign(
      () => {
        doneChunks = Math.min(doneChunks + 1, totalChunks);
        const pct = Math.round(60 + (doneChunks / totalChunks) * 35);
        reportProgress(Math.min(pct, 95), "transcribing");
      },
      {
        reset: () => {
          doneChunks = 0;
        },
      },
    );
    const inferOpts: Record<string, unknown> = {
      return_timestamps: wantWordTimestamps ? "word" : true,
      chunk_length_s: CHUNK_LEN_S,
      stride_length_s: STRIDE_S,
      no_repeat_ngram_size: 3,
      temperature: 0,
      task: "transcribe",
      callback_function: chunkCb,
    };
    if (language) inferOpts.language = language;
    // Reset before each top-level call so the second run on a cached model doesn't
    // inherit doneChunks=totalChunks from the prior run (which would freeze at 95%).
    chunkCb.reset();
    // Load + run inference with backend fallback (WebGPU float → WASM quantized), so a
    // backend that loads but can't execute is skipped automatically. Throws a tagged
    // `[load:…]` / `[infer:…]` error if every backend fails.
    const out = await transcribeWithFallback(modelId, audio, inferOpts);

    // VAD post-pass: find speech regions and drop captions that don't overlap any —
    // catches Whisper hallucinations on non-speech audio (music/silence). Runs after a
    // transcriber has initialised the shared ORT wasm backend. Best-effort: on failure
    // keep all captions (degrade, never break the feature).
    let regions: SpeechRegion[] | null = null;
    try {
      regions = await runVad(audio);
    } catch (err) {
      console.warn(
        "[aiWorker] VAD failed; skipping speech-region filter:",
        err,
      );
      regions = null;
    }

    let chunks: { text: string; timestamp: [number, number | null] }[] =
      Array.isArray(out?.chunks) ? out.chunks : [];
    // Drop chunks that don't overlap any detected speech region (best-effort VAD).
    if (regions) {
      const r = regions;
      chunks = chunks.filter(
        (c) =>
          c.timestamp[0] == null ||
          overlapsSpeech(c.timestamp[0], c.timestamp[1] ?? c.timestamp[0], r),
      );
    }
    // Word mode → merge words into readable subtitle segments at natural boundaries.
    // Segment mode → Whisper already returns caption-sized segments; use as-is
    // (groupWordChunks would corrupt them by treating each segment's text as a word).
    // Save raw word-level chunks before grouping so callers can render per-word
    // timeline blocks (word track in SubtitleTimeline).
    const rawWords = wantWordTimestamps ? chunks : [];
    if (wantWordTimestamps) {
      chunks = groupWordChunks(chunks);
    }
    reportProgress(100, "done");
    return {
      chunks,
      words: rawWords,
      text: typeof out?.text === "string" ? out.text : "",
    };
  },

  // Full Whisper language name (used in language_to_id) → ISO 639-1 code.
  // Kept module-level so it's not re-allocated on every detect call.
  async detectLanguage(audio: Float32Array): Promise<string | null> {
    // First 30 s at 16 kHz is enough for Whisper's language-ID step.
    const sample = audio.slice(0, Math.min(audio.length, 30 * 16000));
    const BASE_MODEL = "onnx-community/whisper-base";

    let pipe: any;
    try {
      // Reuse the cached base transcriber when available (post-first-transcription).
      // Otherwise load fresh — best-effort, so we tolerate failure silently.
      const cached = transcribers.get(BASE_MODEL);
      pipe = cached
        ? await cached
        : await loadTranscriberPipeline(BASE_MODEL, { dtype: "q8" });
    } catch {
      return null;
    }
    if (!pipe) return null;

    // Build token-ID → ISO 639-1 map from the tokenizer's language_to_id dict.
    // WhisperTokenizer keys that dict by full English name: "english" → 50259,
    // "vietnamese" → 50278, etc.  We map those to standard 2-letter ISO codes.
    const WHISPER_NAME_TO_ISO: Record<string, string> = {
      afrikaans: "af",
      arabic: "ar",
      armenian: "hy",
      azerbaijani: "az",
      belarusian: "be",
      bosnian: "bs",
      bulgarian: "bg",
      catalan: "ca",
      chinese: "zh",
      croatian: "hr",
      czech: "cs",
      danish: "da",
      dutch: "nl",
      english: "en",
      estonian: "et",
      finnish: "fi",
      french: "fr",
      galician: "gl",
      german: "de",
      greek: "el",
      hebrew: "he",
      hindi: "hi",
      hungarian: "hu",
      icelandic: "is",
      indonesian: "id",
      italian: "it",
      japanese: "ja",
      kannada: "kn",
      kazakh: "kk",
      korean: "ko",
      latvian: "lv",
      lithuanian: "lt",
      macedonian: "mk",
      malay: "ms",
      marathi: "mr",
      maori: "mi",
      nepali: "ne",
      norwegian: "no",
      persian: "fa",
      polish: "pl",
      portuguese: "pt",
      romanian: "ro",
      russian: "ru",
      serbian: "sr",
      slovak: "sk",
      slovenian: "sl",
      spanish: "es",
      swahili: "sw",
      swedish: "sv",
      tagalog: "tl",
      tamil: "ta",
      thai: "th",
      turkish: "tr",
      ukrainian: "uk",
      urdu: "ur",
      vietnamese: "vi",
      welsh: "cy",
    };

    const tokenizer = pipe.tokenizer;
    const idToIso: Record<number, string> = {};
    if (
      tokenizer?.language_to_id &&
      typeof tokenizer.language_to_id === "object"
    ) {
      for (const [name, id] of Object.entries(tokenizer.language_to_id)) {
        const iso = WHISPER_NAME_TO_ISO[name];
        if (iso) idToIso[id as number] = iso;
      }
    }

    let capturedLang: string | null = null;

    try {
      // Single-pass on first 30 s (no chunk_length_s) with max_new_tokens: 1.
      // Whisper's forced-decoder sequence: <|startoftranscript|> then the language
      // token (first free token).  callback_function fires per generation step with
      // an array of beam objects; output_token_ids holds the sequence so far.
      await pipe(sample, {
        return_timestamps: false,
        max_new_tokens: 1,
        callback_function: (beams: any) => {
          if (capturedLang !== null) return;
          const ids: number[] = beams?.[0]?.output_token_ids ?? [];
          // Look for any id that maps to a known language
          for (const id of ids) {
            const iso = idToIso[id];
            if (iso) {
              capturedLang = iso;
              return;
            }
          }
          // Fallback: decode the second token directly as a special-token string
          // ("<|vi|>", "<|en|>", …) in case the id→iso map has a gap.
          if (!capturedLang && tokenizer && ids.length >= 2) {
            try {
              const decoded: string = tokenizer.decode([ids[1]], {
                skip_special_tokens: false,
              });
              const m = decoded?.match?.(/<\|([a-z]{2,3})\|>/);
              if (m) capturedLang = m[1];
            } catch {
              /* ignore tokenizer decode errors */
            }
          }
        },
      });
    } catch {
      /* detection is strictly best-effort; never block transcription */
    }

    return capturedLang;
  },

  async translateTexts(
    texts: string[],
    srcLang: string,
    tgtLang: string,
  ): Promise<string[]> {
    const tr = await getTranslator();
    reportProgress(50, "translating");
    const results: { translation_text: string }[] = await tr(texts, {
      src_lang: srcLang,
      tgt_lang: tgtLang,
      max_new_tokens: 256,
    });
    reportProgress(100, "done");
    return results.map((r) => r.translation_text);
  },

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

    reportProgress(10, "removing");

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
      reportProgress(fakePercent, "removing");
    }, 800);

    try {
      const output = await backgroundRemover(canvas);
      clearInterval(progressInterval);
      reportProgress(95, "finalizing");

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
      reportProgress(100, "done");
      return bitmap;
    } catch (err) {
      clearInterval(progressInterval);
      throw err;
    }
  },

  /**
   * CTC forced alignment for karaoke-quality word timestamps (±20 ms).
   * English: wav2vec2-base-960h (ONNX, ~95 MB).
   * Other languages: MMS-300M-1130 forced aligner (ONNX, ~1.26 GB, 1130 languages).
   * Returns null on any failure — caller falls back to Whisper DTW timestamps.
   */
  async alignWords(
    audio: Float32Array,
    segments: { text: string; timestamp: [number, number | null] }[],
    language = "en",
  ): Promise<{
    words: { text: string; start: number; end: number }[];
    /** Corrected [start,end] per INPUT segment (null = not aligned); index-aligned to `segments`. */
    segments: ({ start: number; end: number } | null)[];
  } | null> {
    const isEnglish = language === "en";
    // MMS-1130 supports all languages; the caller passes "en" for English only.
    const MAX_DURATION_S = 600; // 10 min cap — full audio loaded into WASM at once
    const audioDurationS = audio.length / 16000;
    if (audioDurationS > MAX_DURATION_S) return null;

    // Keep original indices so we can return per-input-segment corrected times.
    const validSegs = segments
      .map((s, idx) => ({ ...s, idx }))
      .filter((s) => s.text.trim().length > 0 && s.timestamp[0] != null);
    if (validSegs.length === 0) return null;

    // Word count exactly as alignSegment tokenizes: it does `replace(/ +/g,"|")`
    // then splits words on the "|" separator, so BOTH spaces AND any literal "|"
    // in the text act as word boundaries. Mirror that here (treat "|" as a
    // space) so a hallucinated "|" can't desync the global word→segment split.
    const wordCount = (txt: string) =>
      txt.trim().replace(/\|/g, " ").split(/ +/).filter(Boolean).length;

    try {
      reportProgress(5, "loading-model");
      const { model, processor, vocab, blankId, unkId } = isEnglish
        ? await getWav2Vec()
        : await getMms();

      // Feature extraction: zero-mean / unit-var normalisation + Tensor wrapping.
      const feats = await processor.feature_extractor(audio, {
        sampling_rate: 16000,
      });
      reportProgress(30, "aligning");

      // Single forward pass on full audio → logits [1, T, C].
      const output = await model(feats);
      const logits = output.logits;
      const dims = logits.dims as number[];
      const T = dims[1];
      const C = dims[2];

      // Copy to a mutable buffer and apply log-softmax in-place.
      const emission = new Float32Array(logits.data as Float32Array);
      logSoftmaxInPlace(emission, T, C);
      reportProgress(50, "aligning");

      // Actual frame rate from model output (≈50 fps for wav2vec2-base stride=320)
      const framesPerSec = T / audioDurationS;

      // Corrected per-INPUT-segment timing (index-aligned to `segments`).
      const segTimings: ({ start: number; end: number } | null)[] = new Array(
        segments.length,
      ).fill(null);
      let words: { text: string; start: number; end: number }[] = [];

      // ── GLOBAL forced alignment (ENGLISH ONLY) ───────────────────────────
      // Align the WHOLE transcript against the WHOLE audio in one trellis, so
      // word + segment times come from the acoustics — NOT Whisper's segment
      // windows. Whisper base often mis-times segments (esp. after leading
      // silence); for the English wav2vec2 path (clean A–Z vocab) the global
      // alignment is reliable and fixes that.
      //
      // For the MMS multilingual path it is NOT safe: global alignment produces
      // ABSOLUTE times with no anchor, and MMS has far more `<unk>` chars (script
      // gaps, no-space languages like zh/ja, diacritic mismatches) so the trellis
      // path can drift and place captions at wildly wrong times. So non-English
      // ALWAYS takes the per-segment path below, which bounds each segment's words
      // to its Whisper window → graceful for ANY language (see shouldUseGlobalAlign
      // + the 2026-06-21 [DEBUG] regression entry in log.md).
      //
      // GLOBAL_CELL_BUDGET caps the trellis getTrellis() allocates: 60M Float32
      // cells ≈ 240 MB JS heap (a 10-min clip would need ~1.8 GB → per-segment).
      // Pure memory guard, English-only now; NOT a speed lever.
      const fullText = validSegs.map((s) => s.text.trim()).join(" ");
      // Count tokens exactly as alignSegment will tokenize (NFC + uppercase-for-
      // English + space→sep), so the budget estimate matches the real trellis size.
      const nTokens = Array.from(
        normalizeAlignText(fullText, isEnglish),
      ).length;
      const GLOBAL_CELL_BUDGET = 60_000_000;
      if (shouldUseGlobalAlign(isEnglish, T, nTokens, GLOBAL_CELL_BUDGET)) {
        try {
          const gWords = alignSegment(
            emission,
            T,
            C,
            fullText,
            vocab,
            0,
            framesPerSec,
            blankId,
            unkId,
            "|",
            isEnglish,
          );
          reportProgress(75, "aligning"); // trellis built; counts + slicing next
          // gWords maps 1:1 (in order) to the concatenated segment words ONLY
          // when the counts match exactly; otherwise the per-segment split
          // would be misaligned, so reject and fall back to per-segment.
          const expected = validSegs.reduce((n, s) => n + wordCount(s.text), 0);
          if (gWords.length > 0 && gWords.length === expected) {
            words = gWords;
            let wi = 0;
            for (const seg of validSegs) {
              const wc = wordCount(seg.text);
              const sw = gWords.slice(wi, wi + wc);
              wi += wc;
              if (sw.length > 0)
                segTimings[seg.idx] = {
                  start: sw[0].start,
                  end: sw[sw.length - 1].end,
                };
            }
          }
        } catch (e) {
          // Don't mask a real bug behind the silent per-segment fallback.
          console.warn("[aiWorker] global alignment failed, falling back:", e);
        }
      }

      // ── Per-segment alignment (windowed) ─────────────────────────────────
      // PRIMARY path for all non-English (MMS) languages, and the fallback for
      // English when global was skipped/over-budget or produced an unexpected
      // word count. Aligns each segment within its (padded) Whisper window, so
      // word + caption times are BOUNDED to that window — they can refine within
      // it but never drift to a wrong absolute time. This is what makes alignment
      // robust across every supported language.
      if (words.length === 0) {
        for (let si = 0; si < validSegs.length; si++) {
          const seg = validSegs[si];
          const segStart = seg.timestamp[0] as number;
          const segEnd =
            seg.timestamp[1] ?? Math.min(segStart + 10, audioDurationS);

          // Add 0.1 s padding on each side to absorb Whisper timestamp drift.
          const padS = 0.1;
          const fStart = Math.max(
            0,
            Math.floor((segStart - padS) * framesPerSec),
          );
          const fEnd = Math.min(T, Math.ceil((segEnd + padS) * framesPerSec));
          if (fEnd <= fStart + 1) continue;

          const segT = fEnd - fStart;
          // subarray is a zero-copy view — safe; alignSegment only reads it.
          const segEmission = emission.subarray(fStart * C, fEnd * C);
          const startSec = fStart / framesPerSec;

          try {
            const segWords = alignSegment(
              segEmission,
              segT,
              C,
              seg.text,
              vocab,
              startSec,
              framesPerSec,
              blankId, // <pad> token id — model-specific
              unkId, // <unk> token id — model-specific (wav2vec2=3, MMS=1)
              "|", // wordSep — both wav2vec2 and MMS-1130 use "|"
              isEnglish, // uppercaseText: wav2vec2 is A-Z; MMS is Unicode
            );
            words.push(...segWords);
            if (segWords.length > 0)
              segTimings[seg.idx] = {
                start: segWords[0].start,
                end: segWords[segWords.length - 1].end,
              };
          } catch {
            // Individual segment failure is non-fatal — skip it.
          }

          reportProgress(
            50 + Math.round(((si + 1) / validSegs.length) * 45),
            "aligning",
          );
        }
      }

      reportProgress(100, "done");
      return words.length > 0 ? { words, segments: segTimings } : null;
    } catch {
      // Best-effort: any failure → caller uses Whisper DTW fallback.
      // A failure HERE is most likely a post-load inference error (WebGPU
      // device-lost / OOM / unsupported op surfacing only at run time). Reset the
      // singleton for the model we used so the NEXT call reloads from scratch —
      // otherwise the loaded-but-broken model stays cached and every later align
      // silently degrades to DTW for the worker's lifetime. (This is the run-time
      // safety the removed q4f16 load-probe used to provide.)
      const broken = isEnglish ? wav2vec : mms;
      broken.model = null;
      broken.processor = null;
      broken.vocab = null;
      broken.loadingPromise = null;
      return null;
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
