"""Build side-by-side upscaler comparison sheets for review."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from pixel_scaler import upscale_rgba as hq2x_upscale
from waifu_scaler import upscale_rgba as waifu_upscale
from xbrz_scaler import upscale_rgba as xbrz_upscale

PROJECT_ROOT = Path(__file__).resolve().parent

SAMPLES = [
    "item/control_chip.png",
    "block/brake_off.png",
    "block/axis_magnetic.png",
    "block/brass_gearbox_top.png",
    "block/sequenced_pulse_generator_on.png",
    "gui/sequencer.png",
    "item/music_disc_elevator.png",
    "block/kinetic_battery/level_3_charge.png",
    "block/inventory_bridge_both.png",
    "block/creeper.png",
]

METHODS = [
    ("source_2x", "Source (nearest 2x)"),
    ("hq2x", "hq2x"),
    ("xbrz", "xBRZ"),
    ("waifu2x", "waifu2x (n0)"),
]


def texture_paths(mod_name: str) -> Path:
    return (
        PROJECT_ROOT
        / mod_name
        / "src"
        / "main"
        / "resources"
        / "assets"
        / mod_name
        / "textures"
    )


def upscale_with_method(image: Image.Image, method: str) -> Image.Image:
    if method == "source_2x":
        return image.resize((image.width * 2, image.height * 2), Image.NEAREST)
    if method == "hq2x":
        return hq2x_upscale(image)
    if method == "xbrz":
        return xbrz_upscale(image)
    if method == "waifu2x":
        return waifu_upscale(image)
    raise ValueError(f"Unknown method: {method}")


def _load_font(size: int) -> ImageFont.ImageFont:
    for name in ("arial.ttf", "segoeui.ttf"):
        try:
            return ImageFont.truetype(name, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def make_row(image: Image.Image, rel_path: str, cell_size: int, label_height: int) -> Image.Image:
    font = _load_font(14)
    columns = len(METHODS)
    row = Image.new("RGBA", (columns * cell_size, cell_size + label_height), (24, 24, 24, 255))
    draw = ImageDraw.Draw(row)

    for index, (method_key, method_label) in enumerate(METHODS):
        result = upscale_with_method(image, method_key)
        preview = result.convert("RGBA")

        scale = min(cell_size / preview.width, cell_size / preview.height)
        preview_size = (
            max(1, int(preview.width * scale)),
            max(1, int(preview.height * scale)),
        )
        preview = preview.resize(preview_size, Image.NEAREST)

        x0 = index * cell_size + (cell_size - preview_size[0]) // 2
        y0 = label_height + (cell_size - preview_size[1]) // 2
        row.paste(preview, (x0, y0), preview)

        header = f"{method_label}\n{preview_size[0]}x{preview_size[1]}"
        draw.multiline_text((index * cell_size + 8, 6), header, fill=(220, 220, 220), font=font, spacing=2)

    title_font = _load_font(16)
    draw.text((8, cell_size + label_height - 22), rel_path.replace("/", "\\"), fill=(255, 255, 255), font=title_font)
    return row


def build_comparison(mod_name: str, output_dir: Path) -> Path:
    source_root = texture_paths(mod_name)
    if not source_root.exists():
        raise FileNotFoundError(f"Texture folder not found: {source_root}")

    output_dir.mkdir(parents=True, exist_ok=True)
    per_texture_dir = output_dir / "per_texture"
    per_texture_dir.mkdir(exist_ok=True)

    cell_size = 192
    label_height = 52
    rows: list[Image.Image] = []

    header_font = _load_font(18)
    header = Image.new("RGBA", (len(METHODS) * cell_size, 40), (12, 12, 12, 255))
    header_draw = ImageDraw.Draw(header)
    header_draw.text(
        (8, 10),
        f"{mod_name} upscaler comparison — pick the column you prefer, then run batch with --method",
        fill=(255, 255, 255),
        font=header_font,
    )
    rows.append(header)

    for rel_path in SAMPLES:
        src_path = source_root / rel_path
        if not src_path.exists():
            print(f"[-] Skipping missing sample: {rel_path}")
            continue

        with Image.open(src_path) as image:
            image = image.convert("RGBA")
            row = make_row(image, rel_path, cell_size, label_height)
            rows.append(row)
            row.save(per_texture_dir / f"{rel_path.replace('/', '__')}.png", format="PNG")
            print(f"[+] Compared {rel_path} ({image.width}x{image.height})")

    sheet = Image.new("RGBA", (rows[0].width, sum(row.height for row in rows)), (16, 16, 16, 255))
    y = 0
    for row in rows:
        sheet.paste(row, (0, y))
        y += row.height

    sheet_path = output_dir / f"{mod_name}_comparison.png"
    sheet.save(sheet_path, format="PNG")
    print(f"[*] Comparison sheet: {sheet_path}")
    return sheet_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate upscaler comparison sheet.")
    parser.add_argument("mod", nargs="?", default="create_connected")
    parser.add_argument(
        "--output",
        default=str(PROJECT_ROOT / "output" / "comparisons"),
        help="Output directory for comparison images",
    )
    args = parser.parse_args()
    build_comparison(args.mod, Path(args.output))