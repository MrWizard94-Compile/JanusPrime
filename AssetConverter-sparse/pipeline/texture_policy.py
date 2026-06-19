"""Size-aware upscale strategy and Minecraft texture sidecar handling."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import os
import shutil
from enum import Enum

from PIL import Image

SCALE = 2

# GUI mods: nearest-neighbor only (layout-sensitive sprites).
UI_MODS = {"jei", "emi", "rei"}


class Strategy(str, Enum):
    PIXEL_ART = "pixel_art"
    NEAREST = "nearest"
    COPY = "copy"


def classify_texture(width: int, height: int, mod_name: str = "") -> Strategy:
    if mod_name in UI_MODS:
        return Strategy.NEAREST

    if width == 16 and height == 16:
        return Strategy.PIXEL_ART

    if width == 32 and height == 32:
        return Strategy.COPY

    short_side = min(width, height)
    long_side = max(width, height)

    if short_side >= 32 and long_side <= 64:
        return Strategy.COPY

    if long_side >= short_side * 4:
        return Strategy.NEAREST

    if short_side <= 16:
        return Strategy.PIXEL_ART

    return Strategy.NEAREST


def nearest_scale(image: Image.Image, scale: int = SCALE) -> Image.Image:
    image = image.convert("RGBA")
    return image.resize((image.width * scale, image.height * scale), Image.NEAREST)


def copy_image(src_path: str, dest_path: str) -> None:
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    shutil.copy2(src_path, dest_path)


def copy_sidecar(src_png: str, dest_png: str) -> bool:
    src_meta = src_png + ".mcmeta"
    if not os.path.isfile(src_meta):
        return False
    dest_meta = dest_png + ".mcmeta"
    os.makedirs(os.path.dirname(dest_meta), exist_ok=True)
    shutil.copy2(src_meta, dest_meta)
    return True