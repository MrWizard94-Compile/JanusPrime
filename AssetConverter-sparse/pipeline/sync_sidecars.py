"""Copy .png.mcmeta sidecars to output for textures already upscaled."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


import argparse
import os
import sys

from run_upscale import find_source_textures_dir
from texture_policy import copy_sidecar

OUTPUT_ROOT = os.path.join(OUTPUT_ASSETS_DIR)


def sync_mod(mod_name: str) -> tuple[int, int]:
    source_dir = find_source_textures_dir(mod_name)
    output_dir = os.path.join(OUTPUT_ROOT, mod_name, "textures")

    if not os.path.isdir(source_dir):
        print(f"[-] {mod_name}: no source textures")
        return 0, 0

    if not os.path.isdir(output_dir):
        print(f"[-] {mod_name}: no output textures (run upscaler first)")
        return 0, 0

    copied = 0
    missing_output = 0

    for root, _, files in os.walk(source_dir):
        for file in files:
            if not file.endswith(".png"):
                continue
            src_png = os.path.join(root, file)
            rel_path = os.path.relpath(src_png, source_dir)
            dest_png = os.path.join(output_dir, rel_path)
            if not os.path.isfile(dest_png):
                missing_output += 1
                continue
            if copy_sidecar(src_png, dest_png):
                copied += 1

    print(f"[+] {mod_name}: {copied} sidecars synced")
    if missing_output:
        print(f"    {missing_output} source PNGs have no output match (skipped)")
    return copied, missing_output


def main():
    parser = argparse.ArgumentParser(
        description="Backfill .png.mcmeta sidecars without re-upscaling PNGs."
    )
    parser.add_argument(
        "mod",
        nargs="?",
        help="Mod namespace. Omit to sync every mod in output/assets.",
    )
    args = parser.parse_args()

    if args.mod:
        mods = [args.mod]
    else:
        mods = sorted(
            name
            for name in os.listdir(OUTPUT_ROOT)
            if os.path.isdir(os.path.join(OUTPUT_ROOT, name, "textures"))
        )

    total = 0
    for mod in mods:
        copied, _ = sync_mod(mod)
        total += copied

    print(f"[*] Done. {total} sidecars synced across {len(mods)} mods.")
    return 0 if total or not mods else 1


if __name__ == "__main__":
    sys.exit(main())