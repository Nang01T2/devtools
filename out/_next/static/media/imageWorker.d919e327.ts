import { expose } from "comlink";
import { timed } from "../wasm-utils";
import avifEncode from "@/lib/encoders/avif/avifEncode";
import webpEncode from "@/lib/encoders/webp/webpEncode";
import jxlEncode from "@/lib/encoders/jxl/jxlEncode";
import avifDecode from "@/lib/decoders/avif/avifDecode";
import webpDecode from "@/lib/decoders/webp/webpDecode";
import mozjpegEncode from "@/lib/encoders/mozJPEG/mozjpegEncode";
import jxlDecode from "@/lib/decoders/jxl/jxlDecode";

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
  jxlEncode(
    ...args: Parameters<typeof jxlEncode>
  ): ReturnType<typeof jxlEncode> {
    return timed("jxlEncode", () => jxlEncode(...args));
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
  jxlDecode(
    ...args: Parameters<typeof jxlDecode>
  ): ReturnType<typeof jxlDecode> {
    return timed("jxlDecode", () => jxlDecode(...args));
  },
};
export type ProcessorWorkerApi = typeof exports;
// 'as any' to work around the way our client code has insight into worker code
expose(exports, self as any);
