# RestoreFormer++ model credits

`restoreformer_plus_plus.int8.onnx` is a self-quantized (dynamic QUInt8)
derivative of the fp32 ONNX export hosted at
[facefusion/models-3.0.0](https://huggingface.co/facefusion/models-3.0.0),
originally [wzhouxiff/RestoreFormerPlusPlus](https://github.com/wzhouxiff/RestoreFormerPlusPlus)
(CVPR 2023 / TPAMI) — Apache-2.0 license (verbatim, spdx-confirmed on the
original repo — the only commercially-unambiguous face-restoration model
found across GFPGAN/CodeFormer/GPEN/RestoreFormer++ as of 2026-07-05; see
`docs/knowledge/wiki/old-photo-restoration-design.md` §0b for the full
license survey).

- fp32 source: 294,264,232 bytes, sha256
  `164818b70d1745da4108a45c9263b05452236d14ac0ffab2202af0ac4a438195`
  (verified against HuggingFace's own LFS object hash).
- int8 (shipped): 75,523,338 bytes, sha256
  `d4fd17676edb8375124abe210bdc53c8b6c5e805677ea083da4af6bddb8557a2` —
  produced by `scripts/quantize-restoreformer-onnx.py` via
  `onnxruntime.quantization.quantize_dynamic(weight_type=QuantType.QUInt8)`.
  **QUInt8, not QInt8** — QInt8 emits signed `ConvInteger` nodes with no
  kernel in ORT's CPU EP or ort-web's WASM backend (confirmed by execution).

## Real I/O contract (verified by execution, not assumed)

- Input: `input` `[1, 3, 512, 512]` float32, RGB, normalized to `[-1, 1]`
  (`(px/255 - 0.5)/0.5`). Fixed 512×512 — no dynamic shape, unlike MI-GAN.
- **Multi-output graph** (15 outputs) — the restored image is `outputs[0]`,
  `[1, 3, 512, 512]` float32. The other 14 outputs are internal
  codebook/attention tensors, unused by this feature.
- Output range is **not** guaranteed inside `[-1, 1]` — the consumer must
  clip before denormalizing (facefusion's own postprocessing clips
  explicitly; a random-noise probe input produced `[-3.61, 4.38]`).
- **Alignment is mandatory, not optional**: this model expects a face
  aligned to the `ffhq_512` template (5-point similarity warp — see
  `packages/ai-core/src/worker/vision/faceAlign.ts`). Unaligned crops mangle
  the mouth/nose region identically at both fp32 and int8 precision
  (confirmed by direct A/B, matching Google's LiteRT-community GFPGAN card's
  documented warning for the same class of model).

## Quality & performance (verified by execution, 2026-07-05)

- int8 vs fp32 visual quality: ~equal (12 A/B cases across 6 portraits × 2
  degradation levels, MAD mean 5.8/255, PSNR 24.3–32.9dB — inspected by eye,
  not just metrics).
- Real-browser latency (Chromium, onnxruntime-web WASM, 10-core,
  `crossOriginIsolated` via the site's `public/sw.js` COEP credentialless —
  same threading conditions as production): int8 7.6–7.8s/face, fp32
  6.8s/face. int8 is ~13% _slower_ at runtime (dynamic-quant conv overhead)
  — it wins purely on download size (75.5 MB vs 294 MB).
