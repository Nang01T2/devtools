/// <reference lib="webworker" />
// Photon WASM op worker (arch track A2, F03 of mememaker-arch-track-a1-a3).
// Runs SINGLE-IMAGE photon ops off the main thread: the module below is
// imported UNCHANGED — its init-once-with-retry WASM bootstrap runs exactly
// the same inside this worker context, so the WASM heap lives here for the
// whole session (the client keeps one worker alive across ops).
//
// Protocol (see lib/photonClient.ts, the only caller):
//   in:  PhotonJob  { id, op, width, height, buffer (TRANSFERRED), args }
//   out: { id, ok: true, width, height, buffer (TRANSFERRED) }
//      | { id, ok: false, error: string }
// Two-image ops (watermark/blend) never travel this path — every
// applyPhotonOpToLayer/applyPhotonOp call site is a single-image op.
import * as photon from "@gadgetforge/media-core/photon";

interface PhotonJob {
  id: number;
  /** Name of an export of @gadgetforge/media-core/photon, e.g. "sepia". */
  op: string;
  width: number;
  height: number;
  /** The source ImageData's RGBA bytes — transferred in, owned by the worker. */
  buffer: ArrayBuffer;
  /** Scalar params after the leading ImageData argument. */
  args: unknown[];
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<PhotonJob>) => {
  const { id, op, width, height, buffer, args } = e.data;
  try {
    const data = new ImageData(new Uint8ClampedArray(buffer), width, height);
    const fn = (photon as Record<string, unknown>)[op];
    if (typeof fn !== "function") {
      throw new Error(`unknown photon op: ${op}`);
    }
    const out = await (
      fn as (d: ImageData, ...a: unknown[]) => Promise<ImageData>
    )(data, ...args);
    // Return direction transfers for real — the worker has no further use
    // for the result buffer, so main gets it zero-copy.
    ctx.postMessage(
      {
        id,
        ok: true,
        width: out.width,
        height: out.height,
        buffer: out.data.buffer,
      },
      [out.data.buffer],
    );
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: String(err) });
  }
};
