/// <reference lib="webworker" />
// LittleCMS2 WASM transform worker (F01, mememaker-color-management-phase1).
// Spawned by lib/cmsClient.ts (the only spawner) on first transform request;
// the module boundary below IS the lazy-load gate for the 413 KB binding —
// static import, never a dynamic import() (photonWorker.ts precedent).
//
// Protocol (lib/cmsProtocol.ts — the NEUTRAL shared module):
//   in:  CmsJobMessage { id, sourceProfileBytes, destProfileBytes,
//                        pixels (TRANSFERRED), width, height }
//   out: CmsReplyOk    { id, ok: true, pixels (TRANSFERRED), width, height }
//      | CmsReplyErr   { id, ok: false, error, fatal }
//
// RULE 13: this file must NEVER import cmsClient.ts (or anything that reaches
// back to it) — a cycle across the worker-entry boundary deadlocks
// `next build` under Turbopack (0% CPU, no error, never returns).
import type { CmsWorkerInbound, CmsReply } from "./cmsProtocol";
import {
  CmsWasmInitError,
  inspectIccProfile,
  transformRgbaStraightAlpha,
  transformRgbaProofing,
  disposeProofCacheInWorker,
  evictProofProfilesInWorker,
  // Cross-cutting reset (module + handle cache together) — NEVER call
  // cms/lcmsExtended.ts's bare module-only reset directly from here (see
  // that function's own doc comment: doubt-driven-review cycle 2 CRITICAL).
  resetExtendedEngineAfterUnexpectedError,
} from "./cmsTransformCore";
import { CmsExtendedInitError, ExtOomError } from "./cms/lcmsExtended";
import { CmsProofingProfileError } from "./cms/cmsProofingErrors";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

// mememaker-color-management-phase3a-proof F02 — the transform job kind
// (below) is UNCHANGED: it carries no `kind` field, so an incoming message
// with `"kind" in e.data === false` is dispatched exactly as before this
// feature. `kind: "inspectProfile"` is the new, additive validation-only
// job (see cmsProtocol.ts's CmsWorkerInbound doc comment).
ctx.onmessage = async (e: MessageEvent<CmsWorkerInbound>) => {
  // mememaker-color-management-phase3a-proof F01 — the two "fire and forget,
  // no reply" cache-maintenance messages, checked first since they never
  // touch `id`-keyed reply bookkeeping.
  if (e.data.kind === "proof-evict") {
    // Fire-and-forget, but caught — an unhandled rejection here would
    // otherwise surface as an unhandled-promise-rejection in the Worker
    // (doubt-driven-review cycle 1 important fix).
    evictProofProfilesInWorker(e.data.profileIds).catch((err: unknown) => {
      console.warn("[cmsWorker] proof-evict failed", err);
    });
    return;
  }
  if (e.data.kind === "proof-dispose") {
    disposeProofCacheInWorker().catch((err: unknown) => {
      console.warn("[cmsWorker] proof-dispose failed", err);
    });
    return;
  }
  if (e.data.kind === "proof") {
    const {
      id,
      inputProfileBytes,
      inputProfileId,
      outputProfileBytes,
      outputProfileId,
      proofingProfileBytes,
      proofingProfileId,
      intent,
      proofingIntent,
      gamutCheck,
      alarmRgb,
      blackPointCompensation,
      pixels,
      width,
      height,
    } = e.data;
    try {
      const out = await transformRgbaProofing({
        inputProfileBytes,
        inputProfileId,
        outputProfileBytes,
        outputProfileId,
        proofingProfileBytes,
        proofingProfileId,
        intent,
        proofingIntent,
        gamutCheck,
        alarmRgb,
        blackPointCompensation,
        pixels: new Uint8ClampedArray(pixels),
        width,
        height,
      });
      const buffer = out.buffer as ArrayBuffer;
      const reply: CmsReply = {
        id,
        ok: true,
        kind: "proof",
        pixels: buffer,
        width,
        height,
      };
      ctx.postMessage(reply, [buffer]);
    } catch (err) {
      const isKnownProfileError = err instanceof CmsProofingProfileError;
      const isEngineInitError = err instanceof CmsExtendedInitError;
      // Doubt-driven-review cycle 3 minor fix: OOM is a THIRD, distinct
      // failure kind (the module and the profile bytes are both fine; the
      // WASM heap ran out) — reported with its own wire code rather than
      // conflated with generic malformed-request "bad-request".
      const isOomError = err instanceof ExtOomError;
      if (!isKnownProfileError && !isEngineInitError) {
        // Doubt-driven-review cycle 1 important fix: an UNRECOGNISED error
        // (a WebAssembly.RuntimeError trap, an Emscripten abort(), OR an
        // OOM) leaves the Emscripten module permanently unusable
        // (ABORT=true), or at least resource-starved — without this reset,
        // every LATER proofing job would keep silently failing against the
        // same dead/starved instance, misreported as a generic
        // "bad-request" forever instead of recovering on the next attempt.
        resetExtendedEngineAfterUnexpectedError();
      }
      const reply: CmsReply = {
        id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        // An extended-engine load failure must NEVER latch the shared
        // `workerDead` channel the baseline (Assign/Convert) path depends
        // on — always reported non-fatal, distinguished by `code`.
        fatal: false,
        code: isEngineInitError
          ? "proof-engine-unavailable"
          : isOomError
            ? "proof-resource-exhausted"
            : isKnownProfileError
              ? (err as InstanceType<typeof CmsProofingProfileError>).code
              : "bad-request",
      };
      ctx.postMessage(reply);
    }
    return;
  }
  if ("kind" in e.data && e.data.kind === "inspectProfile") {
    const { id, profileBytes } = e.data;
    try {
      const result = await inspectIccProfile(profileBytes);
      const reply: CmsReply = {
        id,
        ok: true,
        kind: "inspectProfile",
        colorSpace: result.colorSpace,
        canBeOutput: result.canBeOutput,
        description: result.description,
      };
      ctx.postMessage(reply);
    } catch (err) {
      const reply: CmsReply = {
        id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        fatal: err instanceof CmsWasmInitError,
        code: err instanceof CmsWasmInitError ? undefined : "unparseable",
      };
      ctx.postMessage(reply);
    }
    return;
  }

  const { id, sourceProfileBytes, destProfileBytes, pixels, width, height } =
    e.data;
  try {
    const out = await transformRgbaStraightAlpha({
      sourceProfileBytes,
      destProfileBytes,
      // View over the transferred-in buffer; transformed in place.
      pixels: new Uint8ClampedArray(pixels),
      width,
      height,
    });
    const buffer = out.buffer as ArrayBuffer;
    const reply: CmsReply = { id, ok: true, pixels: buffer, width, height };
    // Transfer back (not clone): the buffer we own becomes the caller's.
    ctx.postMessage(reply, [buffer]);
  } catch (err) {
    const reply: CmsReply = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      fatal: err instanceof CmsWasmInitError,
    };
    ctx.postMessage(reply);
  }
};
