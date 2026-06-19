import subprocess
import sys

PROJECT_ROOT = r"C:\Users\Bulkl\OneDrive\Desktop\AssetConverter"

ATM10_MODS = [
    "actuallyadditions",
    "occultism",
    "draconicevolution",
    "securitycraft",
    "forbidden_arcanus",
    "evilcraft",
    "integrateddynamics",
    "mcwroofs",
    "mcwdoors",
    "mcwfences",
    "mcwwindows",
    "mcwbridges",
    "mcwlights",
    "reliquary",
    "productivebees",
    "cookingforblockheads",
    "aquaculture",
    "mysticalagradditions",
    "waystones",
    "trashcans",
    "ironjetpacks",
    "artifacts",
    "xnet",
    "fluxnetworks",
    "comforts",
]


def main():
    failed = []
    for i, mod in enumerate(ATM10_MODS, 1):
        print(f"\n{'=' * 60}\n[{i}/{len(ATM10_MODS)}] Upscaling {mod}\n{'=' * 60}")
        result = subprocess.run(
            [sys.executable, "run_upscale.py", mod],
            cwd=PROJECT_ROOT,
        )
        if result.returncode != 0:
            failed.append(mod)

    print(f"\n[*] Upscaled {len(ATM10_MODS) - len(failed)}/{len(ATM10_MODS)} ATM10 mods")
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