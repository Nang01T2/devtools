// lib/images/avif/avif-worker.ts
import { AvifCompressor } from "./avif.compressor";
import { ImageInfo, CompressOption } from "../ImageBase";
import { determineMime } from "../mimes";

interface WorkerMessage {
  id: string;
  // worker can receive ArrayBuffer, Uint8Array, or Blob depending on sender/transfer
  file: ArrayBuffer | Uint8Array | Blob;
  name: string;
  width: number;
  height: number;
  option: CompressOption;
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { id, file, name, width, height, option } = e.data;

  try {
    // Normalize input to a Blob. Caller may send Uint8Array (with transferred buffer),
    // ArrayBuffer, or a Blob already.
    let inputBlob: Blob;
    if (file instanceof Blob) {
      inputBlob = file;
    } else if (ArrayBuffer.isView(file)) {
      // Uint8Array or other TypedArray
      inputBlob = new Blob([file.buffer], { type: determineMime(name) });
    } else if (file instanceof ArrayBuffer) {
      inputBlob = new Blob([file], { type: determineMime(name) });
    } else {
      // Fallback: wrap whatever was provided
      inputBlob = new Blob([file as any], { type: determineMime(name) });
    }

    const info: ImageInfo = { key: 1, name, width, height, blob: inputBlob };

    const compressor = new AvifCompressor(info, {
      ...option,
      avif: { quality: option.avif?.quality ?? 50, speed: 8 }, // faster default
    });

    const result = await compressor.compress();

    // Efficiently transfer compressed bytes back as ArrayBuffer
    const arrayBuffer = await result.blob.arrayBuffer();

    // Return as { data: ArrayBuffer } (consumer accepts result.data or result.blob)
    self.postMessage(
      {
        id,
        data: arrayBuffer,
        width: result.width,
        height: result.height,
      },
      // transfer the ArrayBuffer to avoid copy
      [arrayBuffer]
    );
  } catch (err) {
    console.error("AVIF worker compression error:", err);
    self.postMessage({ id, error: String(err ?? "Compression failed") });
  }
};
