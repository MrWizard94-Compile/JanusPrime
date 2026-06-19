import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import os
import subprocess
import sys


MOD_REPOS = {
    "bellsandwhistles": "https://github.com/sudoLev/BellsAndWhistlesMod.git",
    "vs_clockwork": "https://github.com/ValkyrienSkies/Clockwork.git",
    "copycats": "https://github.com/copycats-plus/copycats.git",
    "create": "https://github.com/Creators-of-Create/Create.git",
    "createaddition": "https://github.com/mrh0/createaddition.git",
    "createbigcannons": "https://github.com/Cannoneers-of-Create/CreateBigCannons.git",
    "createdeco": "https://github.com/talrey/CreateDeco.git",
    "createendertransmission": "https://github.com/Forsteri123/CreateEnderTransmission.git",
    "interiors": "https://github.com/sudolev/CreateInteriorsMod.git",
    "railways": "https://github.com/Layers-of-Railways/Railway.git",
    "trackwork": "https://github.com/Endalion/trackwork.git",
    "valkyrienskies": "https://github.com/ValkyrienSkies/Valkyrien-Skies-2.git",
}


def texture_dir(mod_id):
    return os.path.join(
        PROJECT_ROOT, mod_id, "src", "main", "resources", "assets", mod_id, "textures"
    )


def clone_mod(mod_id, repo_url):
    dest = os.path.join(PROJECT_ROOT, mod_id)
    if os.path.isdir(texture_dir(mod_id)):
        print(f"[=] {mod_id}: already cloned with textures")
        return True

    if os.path.isdir(dest):
        print(f"[*] {mod_id}: folder exists, checking out textures...")
    else:
        print(f"[*] {mod_id}: cloning {repo_url}")
        result = subprocess.run(
            ["git", "clone", "--depth", "1", repo_url, dest],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print(f"[-] {mod_id}: clone failed")
            print(result.stderr.strip() or result.stdout.strip())
            return False

    if os.path.isdir(texture_dir(mod_id)):
        print(f"[+] {mod_id}: textures found")
        return True

    print(f"[-] {mod_id}: missing expected path {texture_dir(mod_id)}")
    return False


def upscale_mod(mod_id, method="xbrz"):
    print(f"[*] {mod_id}: starting upscale ({method})")
    result = subprocess.run(
        [sys.executable, "run_upscale.py", mod_id, "--method", method],
        cwd=PROJECT_ROOT,
    )
    return result.returncode == 0


def main():
    method = "xbrz"
    if len(sys.argv) > 1:
        method = sys.argv[1]

    ready = []
    for mod_id, repo_url in MOD_REPOS.items():
        if clone_mod(mod_id, repo_url):
            ready.append(mod_id)

    print(f"\n[*] {len(ready)}/{len(MOD_REPOS)} mods ready for upscaling\n")

    failed = []
    for mod_id in ready:
        if not upscale_mod(mod_id, method):
            failed.append(mod_id)

    if failed:
        print(f"\n[-] Upscale failures: {', '.join(failed)}")
        sys.exit(1)

    print("\n[*] All mods upscaled successfully.")


if __name__ == "__main__":
    main()