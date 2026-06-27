import { expose } from "comlink";
import { timed } from "../wasm-utils";
import avifEncode from "@gadgetforge/media-core/encoders/avif";
import webpEncode from "@gadgetforge/media-core/encoders/webp";
import jxlEncode from "@gadgetforge/media-core/encoders/jxl";
import avifDecode from "@gadgetforge/media-core/decoders/avif";
import webpDecode from "@gadgetforge/media-core/decoders/webp";
import mozjpegEncode from "@gadgetforge/media-core/encoders/mozjpeg";
import jxlDecode from "@gadgetforge/media-core/decoders/jxl";
import qoiEncode from "@gadgetforge/media-core/encoders/qoi";
import qoiDecode from "@gadgetforge/media-core/decoders/qoi";
import resize from "@gadgetforge/media-core/resize";
import quantize from "@gadgetforge/media-core/quantize";
import {
  rotate,
  flipHorizontal,
  flipVertical,
  grayscale,
  sepia,
  sharpen,
  gaussianBlur,
  brightness,
  contrast,
  hueRotate,
  watermark,
  filter,
  blendOver,
  blendOverlay,
  blendAtop,
  blendPlus,
  blendMultiply,
  blendBurn,
  blendDifference,
  blendSoftLight,
  blendHardLight,
  blendDodge,
  blendExclusion,
  blendLighten,
  blendDarken,
  pixelateBlur,
} from "@gadgetforge/media-core/photon";

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
  qoiEncode(
    ...args: Parameters<typeof qoiEncode>
  ): ReturnType<typeof qoiEncode> {
    return timed("qoiEncode", () => qoiEncode(...args));
  },
  qoiDecode(
    ...args: Parameters<typeof qoiDecode>
  ): ReturnType<typeof qoiDecode> {
    return timed("qoiDecode", () => qoiDecode(...args));
  },
  resize(...args: Parameters<typeof resize>): ReturnType<typeof resize> {
    return timed("resize", () => resize(...args));
  },
  quantize(...args: Parameters<typeof quantize>): ReturnType<typeof quantize> {
    return timed("quantize", () => quantize(...args));
  },
  rotate(...args: Parameters<typeof rotate>): ReturnType<typeof rotate> {
    return timed("rotate", () => rotate(...args));
  },
  flipHorizontal(
    ...args: Parameters<typeof flipHorizontal>
  ): ReturnType<typeof flipHorizontal> {
    return timed("flipHorizontal", () => flipHorizontal(...args));
  },
  flipVertical(
    ...args: Parameters<typeof flipVertical>
  ): ReturnType<typeof flipVertical> {
    return timed("flipVertical", () => flipVertical(...args));
  },
  grayscale(
    ...args: Parameters<typeof grayscale>
  ): ReturnType<typeof grayscale> {
    return timed("grayscale", () => grayscale(...args));
  },
  sepia(...args: Parameters<typeof sepia>): ReturnType<typeof sepia> {
    return timed("sepia", () => sepia(...args));
  },
  sharpen(...args: Parameters<typeof sharpen>): ReturnType<typeof sharpen> {
    return timed("sharpen", () => sharpen(...args));
  },
  gaussianBlur(
    ...args: Parameters<typeof gaussianBlur>
  ): ReturnType<typeof gaussianBlur> {
    return timed("gaussianBlur", () => gaussianBlur(...args));
  },
  brightness(
    ...args: Parameters<typeof brightness>
  ): ReturnType<typeof brightness> {
    return timed("brightness", () => brightness(...args));
  },
  contrast(...args: Parameters<typeof contrast>): ReturnType<typeof contrast> {
    return timed("contrast", () => contrast(...args));
  },
  hueRotate(
    ...args: Parameters<typeof hueRotate>
  ): ReturnType<typeof hueRotate> {
    return timed("hueRotate", () => hueRotate(...args));
  },
  watermark(
    ...args: Parameters<typeof watermark>
  ): ReturnType<typeof watermark> {
    return timed("watermark", () => watermark(...args));
  },
  filter(...args: Parameters<typeof filter>): ReturnType<typeof filter> {
    return timed("filter", () => filter(...args));
  },
  blendOver(
    ...args: Parameters<typeof blendOver>
  ): ReturnType<typeof blendOver> {
    return timed("blendOver", () => blendOver(...args));
  },
  blendOverlay(
    ...args: Parameters<typeof blendOverlay>
  ): ReturnType<typeof blendOverlay> {
    return timed("blendOverlay", () => blendOverlay(...args));
  },
  blendAtop(
    ...args: Parameters<typeof blendAtop>
  ): ReturnType<typeof blendAtop> {
    return timed("blendAtop", () => blendAtop(...args));
  },
  blendPlus(
    ...args: Parameters<typeof blendPlus>
  ): ReturnType<typeof blendPlus> {
    return timed("blendPlus", () => blendPlus(...args));
  },
  blendMultiply(
    ...args: Parameters<typeof blendMultiply>
  ): ReturnType<typeof blendMultiply> {
    return timed("blendMultiply", () => blendMultiply(...args));
  },
  blendBurn(
    ...args: Parameters<typeof blendBurn>
  ): ReturnType<typeof blendBurn> {
    return timed("blendBurn", () => blendBurn(...args));
  },
  blendDifference(
    ...args: Parameters<typeof blendDifference>
  ): ReturnType<typeof blendDifference> {
    return timed("blendDifference", () => blendDifference(...args));
  },
  blendSoftLight(
    ...args: Parameters<typeof blendSoftLight>
  ): ReturnType<typeof blendSoftLight> {
    return timed("blendSoftLight", () => blendSoftLight(...args));
  },
  blendHardLight(
    ...args: Parameters<typeof blendHardLight>
  ): ReturnType<typeof blendHardLight> {
    return timed("blendHardLight", () => blendHardLight(...args));
  },
  blendDodge(
    ...args: Parameters<typeof blendDodge>
  ): ReturnType<typeof blendDodge> {
    return timed("blendDodge", () => blendDodge(...args));
  },
  blendExclusion(
    ...args: Parameters<typeof blendExclusion>
  ): ReturnType<typeof blendExclusion> {
    return timed("blendExclusion", () => blendExclusion(...args));
  },
  blendLighten(
    ...args: Parameters<typeof blendLighten>
  ): ReturnType<typeof blendLighten> {
    return timed("blendLighten", () => blendLighten(...args));
  },
  blendDarken(
    ...args: Parameters<typeof blendDarken>
  ): ReturnType<typeof blendDarken> {
    return timed("blendDarken", () => blendDarken(...args));
  },
  pixelateBlur(
    ...args: Parameters<typeof pixelateBlur>
  ): ReturnType<typeof pixelateBlur> {
    return timed("pixelateBlur", () => pixelateBlur(...args));
  },
};
export type ProcessorWorkerApi = typeof exports;
// 'as any' to work around the way our client code has insight into worker code
expose(exports, self as any);
