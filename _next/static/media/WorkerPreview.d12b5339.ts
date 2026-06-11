import { Queue } from "./Queue";
import { MessageData, convert } from "./handler";
import { avifCheck } from "./support";

// Attach the listener SYNCHRONOUSLY (see WorkerCompress) so a message posted
// right after lazy worker creation isn't dropped while avifCheck() runs; each
// task awaits `ready` before converting.
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
      const output = await convert(event.data, "preview");
      globalThis.postMessage(
        output ?? {
          key: event.data.info.key,
          error: "Unsupported or unprocessable image",
          method: "preview",
        },
      );
    } catch (e) {
      globalThis.postMessage({
        key: event.data.info.key,
        error: e instanceof Error ? e.message : String(e),
        method: "preview",
      });
    }
  });
});
