import subprocess
import sys

PROJECT_ROOT = r"C:\Users\Bulkl\OneDrive\Desktop\AssetConverter"

POPULAR_MODS = [
    "tconstruct",
    "chipped",
    "supplementaries",
    "quark",
    "biomesoplenty",
    "immersiveengineering",
    "iceandfire",
    "alexscaves",
    "apotheosis",
    "irons_spellbooks",
    "mysticalagriculture",
    "aether",
    "another_furniture",
    "rechiseled",
    "mowziesmobs",
    "brewinandchewin",
    "deeperdarker",
]


def main():
    failed = []
    for i, mod in enumerate(POPULAR_MODS, 1):
        print(f"\n{'=' * 60}")
        print(f"[{i}/{len(POPULAR_MODS)}] Upscaling {mod}")
        print("=" * 60)
        result = subprocess.run(
            [sys.executable, "run_upscale.py", mod],
            cwd=PROJECT_ROOT,
        )
        if result.returncode != 0:
            failed.append(mod)

    print(f"\n[*] Upscaled {len(POPULAR_MODS) - len(failed)}/{len(POPULAR_MODS)} popular mods")
    if failed:
        print(f"[-] Failed: {', '.join(failed)}")
        sys.exit(1)

    print("[*] Rebuilding resource pack...")
    pack = subprocess.run(
        [sys.executable, "build_resourcepack.py"],
        cwd=PROJECT_ROOT,
    )
    sys.exit(pack.returncode)


if __name__ == "__main__":
    main()