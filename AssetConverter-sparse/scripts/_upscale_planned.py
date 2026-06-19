import subprocess
import sys

PROJECT_ROOT = r"C:\Users\Bulkl\OneDrive\Desktop\AssetConverter"

PLANNED_MODS = [
    "mekanism",
    "mekanismgenerators",
    "mekanismtools",
    "ae2",
    "refinedstorage",
    "thermal",
    "twilightforest",
    "ars_nouveau",
    "botania",
    "sophisticatedbackpacks",
    "storagedrawers",
    "jei",
]


def main():
    failed = []
    for i, mod in enumerate(PLANNED_MODS, 1):
        print(f"\n{'=' * 60}")
        print(f"[{i}/{len(PLANNED_MODS)}] Upscaling {mod}")
        print("=" * 60)
        result = subprocess.run(
            [sys.executable, "run_upscale.py", mod],
            cwd=PROJECT_ROOT,
        )
        if result.returncode != 0:
            failed.append(mod)

    print(f"\n[*] Upscaled {len(PLANNED_MODS) - len(failed)}/{len(PLANNED_MODS)} planned mods")
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