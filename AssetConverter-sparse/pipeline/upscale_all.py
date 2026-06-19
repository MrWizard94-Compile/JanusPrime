import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import os
import subprocess
import sys

OUTPUT_ASSETS = os.path.join(OUTPUT_ASSETS_DIR)
METHOD = "xbrz"


def discover_mods():
    if not os.path.isdir(OUTPUT_ASSETS):
        return []
    return sorted(
        name
        for name in os.listdir(OUTPUT_ASSETS)
        if os.path.isdir(os.path.join(OUTPUT_ASSETS, name, "textures"))
    )


def main():
    args = [arg for arg in sys.argv[1:] if arg.startswith("-")]
    positional = [arg for arg in sys.argv[1:] if not arg.startswith("-")]
    method = positional[0] if positional else METHOD

    mods = discover_mods()
    if not mods:
        print("[-] No mods found in output/assets")
        sys.exit(1)

    print(f"[*] Force upscaling {len(mods)} mods with method={method}\n")
    failed = []

    for mod in mods:
        print(f"\n{'=' * 60}\n[*] Upscaling {mod}\n{'=' * 60}")
        result = subprocess.run(
            [sys.executable, "run_upscale.py", mod, "--method", method],
            cwd=PROJECT_ROOT,
        )
        if result.returncode != 0:
            failed.append(mod)

    if failed:
        print(f"\n[-] Failed mods: {', '.join(failed)}")
        sys.exit(1)

    print(f"\n[*] All {len(mods)} mods upscaled.")
    print("[*] Rebuilding resource pack...")
    pack = subprocess.run([sys.executable, "build_resourcepack.py"], cwd=PROJECT_ROOT)
    sys.exit(pack.returncode)


if __name__ == "__main__":
    main()