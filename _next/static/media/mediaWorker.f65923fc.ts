import { expose } from "comlink";
import { timed } from "../wasm-utils";
import { encodeToMp4, encodeToGif } from "./media";

const exports = {
  encodeToMp4(
    ...args: Parameters<typeof encodeToMp4>
  ): ReturnType<typeof encodeToMp4> {
    return timed("encodeToMp4", () => encodeToMp4(...args));
  },
  encodeToGif(
    ...args: Parameters<typeof encodeToGif>
  ): ReturnType<typeof encodeToGif> {
    return timed("encodeToGif", () => encodeToGif(...args));
  },
};

export type MediaWorkerApi = typeof exports;

expose(exports, self as any);
