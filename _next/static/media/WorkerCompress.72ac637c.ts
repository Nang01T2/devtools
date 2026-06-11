import { Queue } from "./Queue";
import { MessageData, convert } from "./handler";
import { avifCheck } from "./support";

// Start the avif support probe but DON'T block the listener on it. The message
// handler is attached SYNCHRONOUSLY so a message posted immediately after the
// worker is created (lazy init) can't arrive before the listener exists and be
// dropped — each task awaits `ready` before converting instead.
const ready = avifCheck();

// Cap parallelism by device capability: low-core devices (phones/tablets) run
// fewer concurrent encodes to avoid memory pressure / UI jank. navigator is
// available inside workers.
const cores = navigator.hardwareConcurrency || 4;
const queue = new Queue(Math.max(1, Math.min(3, Math.floor(cores / 2))));

globalThis.addEventListener("message", (event: MessageEvent<MessageData>) => {
  queue.push(async () => {
    try {
      await ready;
      const output = await convert(event.data, "compress");
      globalThis.postMessage(
        output ?? {
          key: event.data.info.key,
          error: "Unsupported or unprocessable image",
          method: "compress",
        },
      );
    } catch (e) {
      globalThis.postMessage({
        key: event.data.info.key,
        error: e instanceof Error ? e.message : String(e),
        method: "compress",
      });
    }
  });
});
