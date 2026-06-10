import { Queue } from "./Queue";
import { MessageData, convert } from "./handler";
import { avifCheck } from "./support";

(async () => {
  // Ensure avif check in worker
  await avifCheck();
  const queue = new Queue(3);

  globalThis.addEventListener(
    "message",
    async (event: MessageEvent<MessageData>) => {
      queue.push(async () => {
        try {
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
    },
  );
})();
