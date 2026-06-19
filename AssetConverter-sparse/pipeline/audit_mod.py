"""Pre-flight texture audit for a mod namespace."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


import argparse
import os
from collections import Counter

from run_upscale import find_source_textures_dir
from texture_policy import Strategy, UI_MODS, classify_texture



def audit_mod(mod_name: str) -> int:
    source_dir = find_source_textures_dir(mod_name)
    if not os.path.isdir(source_dir):
        print(f"[-] No textures found for {mod_name}")
        print(f"    Expected under: {source_dir}")
        return 1

    strategies: Counter[str] = Counter()
    sizes: Counter[tuple[int, int]] = Counter()
    png_count = 0
    mcmeta_count = 0

    for root, _, files in os.walk(source_dir):
        for file in files:
            if file.endswith(".png.mcmeta"):
                mcmeta_count += 1
                continue
            if not file.endswith(".png"):
                continue

            png_count += 1
            path = os.path.join(root, file)
            from PIL import Image

            with Image.open(path) as image:
                size = image.size
                sizes[size] += 1
                strategy = classify_texture(size[0], size[1], mod_name)
                strategies[strategy.value] += 1

    print(f"[*] Audit: {mod_name}")
    print(f"    Source: {source_dir}")
    print(f"    PNGs: {png_count}")
    print(f"    .mcmeta sidecars: {mcmeta_count}")
    if mod_name in UI_MODS:
        print(f"    UI mod: nearest-neighbor strategy forced")

    print("    Strategies:")
    for name in (Strategy.PIXEL_ART.value, Strategy.NEAREST.value, Strategy.COPY.value):
        count = strategies.get(name, 0)
        if count:
            print(f"      {name}: {count}")

    print("    Top dimensions:")
    for size, count in sizes.most_common(8):
        print(f"      {size[0]}x{size[1]}: {count}")

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Audit mod textures before upscaling.")
    parser.add_argument("mod", help="Mod namespace, e.g. mekanism")
    args = parser.parse_args()
    raise SystemExit(audit_mod(args.mod))