# Real-ESRGAN model credits

`realesr-general-x4v3.onnx` is exported (see
`scripts/export-realesrgan-onnx.py`) from the official
`realesr-general-x4v3.pth` weights of
[Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN) —
Copyright (c) 2021, Xintao Wang — BSD-3-Clause license.

Source weights: `https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth`
(4,885,111 bytes, sha256 `8dc7edb9ac80ccdc30c3a5dca6616509367f05fbc184ad95b731f05bece96292`).

Exported to ONNX with dynamic height/width axes (opset 17) — verified by
execution at multiple input sizes before being committed. See
`docs/superpowers/plans/real-esrgan-upscaling/` for the full export process
and rationale.
