"""Pixel-art upscaler for Minecraft textures (hq2x, 2x with edge smoothing)."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import functools
import sys
import types

from PIL import Image

# hqx 1.0 imports removed Pillow.PyAccess; stub it so submodules load on Pillow 12+.
if "PIL.PyAccess" not in sys.modules:
    sys.modules["PIL.PyAccess"] = types.ModuleType("PIL.PyAccess")

import hqx.algor_hq2x
import hqx.rgb_yuv

SCALE = 2


def _hq2x_rgb(image: Image.Image) -> Image.Image:
    width, height = image.size
    source = image.convert("RGB")
    dest = Image.new("RGB", (width * SCALE, height * SCALE))
    sourcegrid = source.load()
    destgrid = dest.load()

    @functools.cache
    def get_px(x_coord: int, y_coord: int) -> tuple[int, int, int]:
        x_coord = max(0, min(x_coord, width - 1))
        y_coord = max(0, min(y_coord, height - 1))
        return sourcegrid[x_coord, y_coord]

    for x in range(width):
        for y in range(height):
            pixel = hqx.algor_hq2x.hq2x_pixel(
                [
                    hqx.rgb_yuv.tuple_to_packed_int(get_px(x - 1, y - 1)),
                    hqx.rgb_yuv.tuple_to_packed_int(get_px(x, y - 1)),
                    hqx.rgb_yuv.tuple_to_packed_int(get_px(x + 1, y - 1)),
                    hqx.rgb_yuv.tuple_to_packed_int(get_px(x - 1, y)),
                    hqx.rgb_yuv.tuple_to_packed_int(get_px(x, y)),
                    hqx.rgb_yuv.tuple_to_packed_int(get_px(x + 1, y)),
                    hqx.rgb_yuv.tuple_to_packed_int(get_px(x - 1, y + 1)),
                    hqx.rgb_yuv.tuple_to_packed_int(get_px(x, y + 1)),
                    hqx.rgb_yuv.tuple_to_packed_int(get_px(x + 1, y + 1)),
                ]
            )

            x_scaled = x * SCALE
            y_scaled = y * SCALE
            destgrid[x_scaled, y_scaled] = hqx.rgb_yuv.packed_int_to_tuple(pixel[0])
            destgrid[x_scaled + 1, y_scaled] = hqx.rgb_yuv.packed_int_to_tuple(pixel[1])
            destgrid[x_scaled, y_scaled + 1] = hqx.rgb_yuv.packed_int_to_tuple(pixel[2])
            destgrid[x_scaled + 1, y_scaled + 1] = hqx.rgb_yuv.packed_int_to_tuple(pixel[3])

    return dest


def upscale_rgba(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    alpha = image.getchannel("A")

    # Flatten onto black so transparent pixels do not bleed into edges.
    flattened = Image.new("RGBA", image.size, (0, 0, 0, 255))
    flattened.paste(image, mask=alpha)
    rgb_upscaled = _hq2x_rgb(flattened.convert("RGB"))

    alpha_upscaled = alpha.resize(
        (image.width * SCALE, image.height * SCALE),
        Image.NEAREST,
    )
    rgb_upscaled.putalpha(alpha_upscaled)
    return rgb_upscaled