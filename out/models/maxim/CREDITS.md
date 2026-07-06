# MAXIM enhancement model credits

`maxim_enhancement.onnx` is the ONNX export of Google Research's
[MAXIM](https://github.com/google-research/maxim) (CVPR 2022) enhancement variant, hosted at
[huggingworld/onnx-image-models](https://huggingface.co/huggingworld/onnx-image-models)
(originally packaged for [UpscalerJS](https://github.com/getupscaler/upscalerjs)/Upscayl's
in-browser use). Repo license: **MIT**. Original MAXIM research: **Apache-2.0**
(`google-research/maxim`, GitHub API-confirmed). Both commercial-clean.

- **62,468,964 bytes**, sha256
  `394d72964144b88696fdb4f8b721ae3d1183ca33000245554fe9089467f3fec6`
  (verified against HuggingFace's own LFS object hash — see
  `scripts/fetch-maxim-enhancement-onnx.py`).

## Real I/O contract (verified by execution, not assumed)

- Input: `xs_0:0` NCHW float32, `[0, 1]` range (not `[-1, 1]` — a different convention from
  RestoreFormer++'s, verified by direct testing).
- **Critical constraint (contradicts the graph's symbolic/dynamic-looking shape)**: H and W must
  each be a **multiple of 64** (MAXIM's multi-axis MLP patch size). Confirmed by direct failure:
  65×65 and 100×150 both throw `Reshape` errors
  (`input_shape_size == size was false`); 256×256 and 512×384 succeed. The consumer
  (`GlobalCleanupEngine`) pads up to the next 64-multiple and crops the result back down.
- Output: `Identity:0`, same shape, **NOT clamped to `[0, 1]`** — a random `[0,1]` probe input
  produced output range `[0.179, 1.464]`. The consumer must clamp before converting to bytes.

## Performance (Python CPU reference — NOT a browser number)

256×256 → 1.92s; 512×384 (196,608 px) → 6.24s, unoptimized single-process CPU. No WASM/browser
timing exists yet — measured for real during this feature's manual browser gate, not assumed.

## Purpose

Landmark-free "Global cleanup": low-light/contrast/color enhancement for photos too damaged for
face-specific restoration (see `restoreformer-face-restoration`'s `no-face` path). Does NOT
restore facial detail or any specific lost information — it enhances what's visually present.
