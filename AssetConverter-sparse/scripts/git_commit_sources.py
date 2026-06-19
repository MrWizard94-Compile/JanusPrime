"""Stage and commit pulled mod sources to the repo."""
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.paths import OUTPUT_ASSETS_DIR, PROJECT_ROOT
from config.registry import texture_namespace


def main():
    mods = sys.argv[1:]
    if not mods:
        print("[-] No mods specified")
        sys.exit(1)

    paths = []
    for mod in mods:
        host = {"mekanismgenerators": "mekanism", "mekanismtools": "mekanism"}.get(mod, mod)
        paths.append(f"sources/{host}")
        namespace = texture_namespace(mod)
        asset_dir = os.path.join(OUTPUT_ASSETS_DIR, namespace)
        if os.path.isdir(asset_dir):
            paths.append(f"output/assets/{namespace}/")

    subprocess.run(["git", "add", "--", *paths], cwd=PROJECT_ROOT, check=False)
    msg = f"pull: {', '.join(mods)}"
    result = subprocess.run(
        ["git", "commit", "-m", msg],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        print(f"[+] Committed sources for {', '.join(mods)}")
    elif "nothing to commit" in (result.stdout + result.stderr):
        print(f"[=] No changes to commit for {', '.join(mods)}")
    else:
        print(result.stderr or result.stdout)


if __name__ == "__main__":
    main()