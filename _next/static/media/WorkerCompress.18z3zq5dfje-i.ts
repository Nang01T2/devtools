import { Queue } from "./Queue";
import {
  MessageData,
  SvgEncodeMessage,
  convert,
  handleSvgEncode,
} from "./handler";
import { avifCheck } from "./support";
import { CodecId, preloadCodecById } from "./codecRegistry";
// Static import is safe: avif_enc.js is behind a dynamic import() inside
// init(), so it is not bundled into this worker's initial chunk.
import { initCodec as initAvif } from "@/lib/encoders/avif/avifEncode";
import { flushPendingSsim, clearPendingSsim } from "./handler";

// Start the avif support probe but DON'T block the listener on it. The message
// handler is attached SYNCHRONOUSLY so a message posted immediately after the
// worker is created (lazy init) can't arrive before the listener exists and be
// dropped — each task awaits `ready` before converting instead.
const ready = avifCheck();

// Pool size (number of WorkerCompress instances) is determined on the main
// thread (transform.ts) based on hardwareConcurrency. Each worker runs with
// Queue(1) — one synchronous WASM encode at a time — so true CPU parallelism
// comes from having multiple workers, not multiple concurrent tasks inside one.
const queue = new Queue(1);

// format is validated to CodecId on the main thread (preload.ts:toCodecId) before
// being posted, so the worker can rely on it being a valid registry key.
type PreloadMessage = { type: "preload"; format: CodecId };
// F08: main thread pre-compiles the WASM module and sends it here to avoid a
// redundant fetch+compile on each worker spawn cycle.
type InitModuleMessage = {
  type: "init-module";
  codec: "avif";
  module: WebAssembly.Module;
};
type WorkerIncoming =
  | MessageData
  | SvgEncodeMessage
  | PreloadMessage
  | InitModuleMessage;

function isPreload(msg: WorkerIncoming): msg is PreloadMessage {
  return (msg as PreloadMessage).type === "preload";
}

function isSvgEncode(msg: WorkerIncoming): msg is SvgEncodeMessage {
  return (msg as SvgEncodeMessage).type === "svg-encode";
}

function isInitModule(msg: WorkerIncoming): msg is InitModuleMessage {
  return (msg as InitModuleMessage).type === "init-module";
}

globalThis.addEventListener(
  "message",
  (event: MessageEvent<WorkerIncoming>) => {
    // F08: receive pre-compiled WASM module from main thread. Initialize the codec
    // immediately so compress tasks don't pay the fetch+compile cost. Fire-and-
    // forget: if this loses the race with an in-progress init (from preload or
    // first encode), initAvif returns early and the module is silently skipped —
    // the worker falls back to its own fetch path for this spawn cycle.
    if (isInitModule(event.data)) {
      if (event.data.codec === "avif") {
        void initAvif(event.data.module).catch(() => {});
      }
      return;
    }

    if (isPreload(event.data)) {
      // Non-queued — preload runs outside the compress queue so it doesn't
      // block pending compress tasks. No `await ready` needed here — preload
      // only calls encoder initCodec(); it does not read Mimes.avif which is
      // the only value gated behind ready.
      void preloadCodecById(event.data.format).catch((e) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[image-converter/preload]", e);
        }
      });
      return;
    }

    // F05: SVG pixel transfer — main thread rasterizes, worker encodes AVIF/JXL.
    // Runs outside the compress queue so it doesn't delay pending compress tasks.
    if (isSvgEncode(event.data)) {
      void handleSvgEncode(event.data).then((result) =>
        globalThis.postMessage(result),
      );
      return;
    }

    queue.push(async () => {
      try {
        await ready;
        const output = await convert(event.data, "both");
        globalThis.postMessage(
          output ?? {
            key: event.data.info.key,
            error: "Unsupported or unprocessable image",
            method: "compress",
          },
        );
        // Launch SSIM AFTER output is in the postMessage channel so
        // qualityPatch always arrives after compress+preview (F2 race fix).
        flushPendingSsim();
      } catch (e) {
        clearPendingSsim(); // discard stale launcher — no result to score
        globalThis.postMessage({
          key: event.data.info.key,
          error: e instanceof Error ? e.message : String(e),
          method: "compress",
        });
      }
    });
  },
);
