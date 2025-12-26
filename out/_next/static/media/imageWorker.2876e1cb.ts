import { expose } from "comlink";
import { timed } from "../wasm-utils";
import avifEncode from "@/lib/encoders/avif/avifEncode";
import avifDecode from "@/lib/decoders/avif/avifDecode";
import mozjpegEncode from "@/lib/encoders/mozJPEG/mozjpegEncode";

const exports = {
  avifEncode(
    ...args: Parameters<typeof avifEncode>
  ): ReturnType<typeof avifEncode> {
    return timed("avifEncode", () => avifEncode(...args));
  },
  avifDecode(
    ...args: Parameters<typeof avifDecode>
  ): ReturnType<typeof avifDecode> {
    return timed("avifDecode", () => avifDecode(...args));
  },
  mozjpegEncode(
    ...args: Parameters<typeof mozjpegEncode>
  ): ReturnType<typeof mozjpegEncode> {
    return timed("mozjpegEncode", () => mozjpegEncode(...args));
  },
};
export type ProcessorWorkerApi = typeof exports;
// 'as any' to work around the way our client code has insight into worker code
expose(exports, self as any);
