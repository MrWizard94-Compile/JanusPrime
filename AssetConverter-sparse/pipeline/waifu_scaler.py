"""waifu2x-ncnn-vulkan 2x upscaler (noise=0, anime model for illustrated assets)."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import subprocess
import tempfile
from pathlib import Path

from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parent
WAIFU_EXE = PROJECT_ROOT / "waifu2x-ncnn-vulkan-20250915-windows" / "waifu2x-ncnn-vulkan.exe"
WAIFU_CWD = WAIFU_EXE.parent
SCALE = 2
NOISE = 0
MODEL = "models-upconv_7_anime_style_art_rgb"


def upscale_rgba(image: Image.Image) -> Image.Image:
    if not WAIFU_EXE.exists():
        raise FileNotFoundError(f"waifu2x executable not found: {WAIFU_EXE}")

    image = image.convert("RGBA")
    alpha = image.getchannel("A")
    flattened = Image.new("RGBA", image.size, (0, 0, 0, 255))
    flattened.paste(image, mask=alpha)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        src_path = tmp_path / "input.png"
        out_path = tmp_path / "output.png"
        flattened.save(src_path, format="PNG")

        command = [
            str(WAIFU_EXE),
            "-i", str(src_path),
            "-o", str(out_path),
            "-s", str(SCALE),
            "-n", str(NOISE),
            "-m", MODEL,
            "-t", "0",
            "-f", "png",
        ]
        subprocess.run(command, check=True, cwd=WAIFU_CWD, capture_output=True)

        result = Image.open(out_path).convert("RGB")
        result.putalpha(alpha.resize(result.size, Image.NEAREST))
        return result