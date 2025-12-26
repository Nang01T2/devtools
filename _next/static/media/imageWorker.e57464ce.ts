import { expose } from "comlink";
import { timed } from "../wasm-utils";
import avifEncode from "@/lib/encoders/avif/avifEncode";
import webpEncode from "@/lib/encoders/webp/webpEncode";
import avifDecode from "@/lib/decoders/avif/avifDecode";
import webpDecode from "@/lib/decoders/webp/webpDecode";
import mozjpegEncode from "@/lib/encoders/mozJPEG/mozjpegEncode";

const exports = {
  avifEncode(
    ...args: Parameters<typeof avifEncode>
  ): ReturnType<typeof avifEncode> {
    return timed("avifEncode", () => avifEncode(...args));
  },
  webpEncode(
    ...args: Parameters<typeof webpEncode>
  ): ReturnType<typeof webpEncode> {
    return timed("webpEncode", () => webpEncode(...args));
  },
  avifDecode(
    ...args: Parameters<typeof avifDecode>
  ): ReturnType<typeof avifDecode> {
    return timed("avifDecode", () => avifDecode(...args));
  },
  webpDecode(
    ...args: Parameters<typeof webpDecode>
  ): ReturnType<typeof webpDecode> {
    return timed("webpDecode", () => webpDecode(...args));
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
