// workers/pdfWorker.ts
import { expose } from "comlink";
import { timed } from "../wasm-utils";
import { generatePdf, GeneratePdfOptions, PdfImageItem } from "./pdf";


// Expose API via Comlink
const exports = {
  generatePdf(
    images: PdfImageItem[],
    options?: GeneratePdfOptions
  ): Promise<Blob> {
    return timed("generatePdf", () => generatePdf(images, options));
  },
};

export type PdfWorkerApi = typeof exports;

expose(exports, self as any);