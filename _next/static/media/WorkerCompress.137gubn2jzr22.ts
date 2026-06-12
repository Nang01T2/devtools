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
import {
  flushPendingSsim,
  clearPendingSsimForKey,
  cancelPendingSsimKey,
  cancelAllPendingSsim,
  getSsimEpoch,
} from "./handler";

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
// Main thread broadcasts this on remove()/clear() so pending SSIM launchers
// (and the blob references in their closures) are dropped immediately.
type CancelSsimMessage = { type: "cancel-ssim"; key?: number };
type WorkerIncoming =
  | MessageData
  | SvgEncodeMessage
  | PreloadMessage
  | InitModuleMessage
  | CancelSsimMessage;

function isPreload(msg: WorkerIncoming): msg is PreloadMessage {
  return (msg as PreloadMessage).type === "preload";
}

function isSvgEncode(msg: WorkerIncoming): msg is SvgEncodeMessage {
  return (msg as SvgEncodeMessage).type === "svg-encode";
}

function isInitModule(msg: WorkerIncoming): msg is InitModuleMessage {
  return (msg as InitModuleMessage).type === "init-module";
}

function isCancelSsim(msg: WorkerIncoming): msg is CancelSsimMessage {
  return (msg as CancelSsimMessage).type === "cancel-ssim";
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

    // Non-queued — cancellation must take effect immediately, not after the
    // current encode finishes. Durable against tasks still sitting in the
    // queue (R6-M1): a per-key cancel tombstones the key and a cancel-all
    // bumps the epoch, so a queued task that finishes its encode AFTER this
    // message is refused at launcher registration. A launcher already
    // mid-SSIM cannot be aborted; its patch is discarded on the main thread.
    if (isCancelSsim(event.data)) {
      if (event.data.key !== undefined) cancelPendingSsimKey(event.data.key);
      else cancelAllPendingSsim();
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

    // Narrow out of the union — all non-MessageData variants were filtered above.
    const data = event.data as MessageData;
    // Stamp the cancellation epoch at message RECEIPT (FIFO-ordered with any
    // cancel-ssim broadcast): a clear() posted after this task bumps the epoch
    // before the task's encode finishes, so its launcher registration is
    // refused even though the task was already queued (R6-M1).
    data._ssimCancelEpoch = getSsimEpoch();
    queue.push(async () => {
      try {
        await ready;
        const output = await convert(data, data.method ?? "both");
        globalThis.postMessage(
          output ?? {
            key: data.info.key,
            error: "Unsupported or unprocessable image",
            method: "compress",
          },
        );
        // Launch SSIM AFTER output is in the postMessage channel so
        // qualityPatch always arrives after compress+preview (F2 race fix).
        // If output was null (unsupported format), no launcher was registered
        // for this key, so flushPendingSsim() is a no-op for this item.
        flushPendingSsim();
      } catch (e) {
        // Remove the launcher registered for this key (if any was set before
        // the throw). Key-based delete is safe: other items' launchers are
        // unaffected even if they share the same worker.
        clearPendingSsimForKey(data.info.key);
        globalThis.postMessage({
          key: data.info.key,
          error: e instanceof Error ? e.message : String(e),
          method: "compress",
        });
      }
    });
  },
);
