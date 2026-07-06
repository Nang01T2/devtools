# MI-GAN model credits

`migan_pipeline_v2.onnx` is the official pipeline export from
[andraniksargsyan/migan](https://huggingface.co/andraniksargsyan/migan),
the ONNX distribution of
[MI-GAN](https://github.com/Picsart-AI-Research/MI-GAN) (ICCV 2023) —
Copyright (c) 2024 Picsart AI Research (PAIR) — MIT license.

28,079,181 bytes, sha256
`6f1f3530a1a2324b19752018ce756088b07973cda8d7d890034ace5c8a48c40b`
(verified against HuggingFace's own LFS object hash — see
`scripts/fetch-migan-onnx.py`).

## Real I/O contract (verified by execution, not assumed)

- Inputs, in order: `image` `[batch, 3, H, W]` uint8 RGB, `mask` `[batch, 1,
H, W]` uint8. Both H/W are dynamic — no fixed input size.
- Output: `result` `[batch, 3, H, W]` uint8 RGB.
- **Mask polarity**: `0` (black) marks the hole to be filled/regenerated;
  `255` (white) marks pixels to keep unchanged. Confirmed both numerically
  (mean-abs-diff inside vs. outside a test square, both directions) and
  visually (saved probe PNGs) — see `scripts/fetch-migan-onnx.py`. This is
  the OPPOSITE of a naive "white = paint here to repair" assumption; any
  UI-facing mask ("paint white where you want repaired") must be inverted
  before being fed to the model.
