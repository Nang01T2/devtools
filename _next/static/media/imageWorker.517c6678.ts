import { expose } from "comlink";
import avifEncode from "@/lib/encoders/avif/avifEncode";
import { timed } from "../wasm-utils";

const exports = {
  avifEncode(
    ...args: Parameters<typeof avifEncode>
  ): ReturnType<typeof avifEncode> {
    return timed("avifEncode", () => avifEncode(...args));
  },
};
export type ProcessorWorkerApi = typeof exports;
// 'as any' to work around the way our client code has insight into worker code
expose(exports, self as any);
