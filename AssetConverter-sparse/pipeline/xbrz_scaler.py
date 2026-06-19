"""xBRZ 2x upscaler for Minecraft RGBA textures."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from PIL import Image

from pipeline.xbrz_lib import scale_pillow

SCALE = 2


def upscale_rgba(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    return scale_pillow(image, SCALE)