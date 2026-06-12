import { Queue } from "./Queue";
import { MessageData, convert } from "./handler";

// GIF animation lane — isolated from the raster codec worker to avoid WASM
// contention. Queue(1): the GIF encoder's WASM module is not safely
// parallelizable, so only one GIF encode runs at a time.
// Uses "both" (not "compress") so compress + preview are both settled;
// if only compress arrived, previewSettled would stay false and
// hasTaskRunning() would be stuck true, freezing all controls.
const queue = new Queue(1);

globalThis.addEventListener("message", (event: MessageEvent<MessageData>) => {
  queue.push(async () => {
    try {
      // Respect the method from dispatch; fall back to "both" to ensure
      // previewSettled is always resolved (hasTaskRunning stability).
      const output = await convert(event.data, event.data.method ?? "both");
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
        method: event.data.method ?? "compress",
      });
    }
  });
});
