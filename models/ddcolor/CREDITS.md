# DDColor colorization model credits

`ddcolor_tiny.int8.onnx` is a self-quantized (QUInt8) ONNX build of
[piddnad/DDColor](https://github.com/piddnad/DDColor)'s `paper_tiny` variant (Apache-2.0),
starting from the fp16 community conversion hosted at
[Faridzar/ddcolor-mirror](https://huggingface.co/Faridzar/ddcolor-mirror). The mirror itself
carries **no independent license statement** for the conversion — only the original
piddnad/DDColor Apache-2.0 license applies (see
`docs/knowledge/wiki/old-photo-restoration-design.md` §Addendum-2 for the full license survey,
the same rigor `public/models/restoreformer/CREDITS.md` applies to its own mirror source).

- fp16 source: `ddcolor-fp16.onnx`, **113,225,654 bytes**, sha256
  `40ff5091157701a76f05f630b40ce1de7de8d15f1abfa8c403947e4e4ebab73c` (HF tree API `lfs.oid`,
  fetched 2026-07-06).
- The mirror's **own int8 file is unusable**: it is QInt8-quantized, which produces a signed
  `ConvInteger` op with **no kernel on the CPU execution provider or ort-web WASM**
  (`NOT_IMPLEMENTED`, confirmed by direct execution 2026-07-06 — the same bug class hit
  RestoreFormer++'s pre-quantized mirror earlier in the same investigation).
- This artifact is a **self-quantization**: fp16 → fp32 upcast (manual initializer round-trip +
  `Cast` node retarget, `scripts/quantize-ddcolor-onnx.py`) → `quantize_dynamic` with
  `QuantType.QUInt8` (onnxruntime 1.19.2). **61,927,949 bytes**, sha256
  `e7c3347c15a7b476a107992c8d5d5a9e0c857bc4910d6caea43b9120384353f1`. Re-running the script with
  a different onnxruntime version may produce a different valid file — re-pin both hash
  constants in the same commit if that happens.

## Real I/O contract (verified by execution, not assumed)

- Input: `input`, NCHW float32, `[1, 3, 256, 256]`, values in `[0, 1]`, grayscale replicated
  across all 3 channels. **Fixed 256×256 — no dynamic shape.**
- Output: `output`, float32, `[1, 2, 256, 256]`. **This is ab-chroma in CIE Lab space, NOT an
  RGB image.** The consumer (`ColorizationEngine` + `labColor.ts`) must:

  1. Bilinear-upscale the 256×256 ab-chroma to the source image's resolution.
  2. Merge that chroma with the **source's own L (luminance)** channel in Lab space, then
     convert back to sRGB.

  This Lab-merge is what makes the output as sharp as the source regardless of the model's
  fixed 256px working resolution — the model never sees or produces luminance detail.

- Output range is not formally bounded (QUInt8 vs fp32 reference MAD ≈ 0.21 ab-units,
  visually indistinguishable on the 2 subjects tested) — the consumer's Lab→sRGB conversion
  clamps the final RGB, so this script only checks finiteness, not a specific range.

## Performance (Python CPU reference — NOT a browser number)

0.35–0.42s per image at the fixed 256×256 working resolution (fastest model in the vision
fleet, since input size never scales with the source image). The real WASM/browser number is
measured at this feature's manual browser gate, never assumed from this figure.

## Honest caveat

Colorization **guesses** plausible colors from a black-and-white image — it does not and
cannot recover the true original colors of a scene. This is surfaced directly in the
Colorize tool's UI hint copy.
