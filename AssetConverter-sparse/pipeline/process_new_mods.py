import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import os
import subprocess
import sys

from config.registry import (
    JAR_ONLY_MODS,
    MOD_REPOS,
    PROJECT_ROOT,
    count_mcmeta,
    ensure_best_source,
    extract_textures_from_jar,
    list_instance_mods,
)
from run_upscale import find_source_textures_dir


def clone_mod(mod_id, repo_url):
    dest = os.path.join(PROJECT_ROOT, mod_id)
    if os.path.isdir(find_source_textures_dir(mod_id)):
        print(f"[=] {mod_id}: source textures already available")
        return True

    if os.path.isdir(dest):
        print(f"[!] {mod_id}: repo folder exists but textures missing")
        return False

    print(f"[*] {mod_id}: cloning {repo_url}")
    result = subprocess.run(
        ["git", "clone", "--depth", "1", repo_url, dest],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(result.stderr.strip() or result.stdout.strip())
        return False

    if os.path.isdir(find_source_textures_dir(mod_id)):
        print(f"[+] {mod_id}: textures found")
        return True

    print(f"[-] {mod_id}: textures not found after clone")
    return False


def output_texture_count(mod_id):
    out_dir = os.path.join(OUTPUT_ASSETS_DIR, mod_id, "textures")
    if not os.path.isdir(out_dir):
        return 0
    return sum(
        1
        for root, _, files in os.walk(out_dir)
        for file in files
        if file.endswith(".png")
    )


def source_texture_count(mod_id):
    src_dir = find_source_textures_dir(mod_id)
    if not os.path.isdir(src_dir):
        return 0
    return sum(
        1
        for root, _, files in os.walk(src_dir)
        for file in files
        if file.endswith(".png")
    )


def output_mcmeta_count(mod_id):
    out_dir = os.path.join(OUTPUT_ASSETS_DIR, mod_id, "textures")
    return count_mcmeta(out_dir)


def source_mcmeta_count(mod_id):
    return count_mcmeta(find_source_textures_dir(mod_id))


def needs_upscale(mod_id, force: bool = False):
    src = source_texture_count(mod_id)
    out = output_texture_count(mod_id)
    if force:
        return src > 0
    return src > 0 and out < src


def upscale_mod(mod_id, method="xbrz", force: bool = False):
    if not needs_upscale(mod_id, force=force):
        print(
            f"[=] {mod_id}: up to date "
            f"({output_texture_count(mod_id)} png, {output_mcmeta_count(mod_id)} sidecars)"
        )
        return True

    print(f"[*] {mod_id}: upscaling with {method}")
    return (
        subprocess.run(
            [sys.executable, "run_upscale.py", mod_id, "--method", method],
            cwd=PROJECT_ROOT,
        ).returncode
        == 0
    )


def main():
    args = [arg for arg in sys.argv[1:] if arg.startswith("-")]
    positional = [arg for arg in sys.argv[1:] if not arg.startswith("-")]
    method = positional[0] if positional else "xbrz"
    force = "--force" in args
    instance_mods = list_instance_mods()
    target_mods = sorted(instance_mods)

    if "minecolonies" not in target_mods and os.path.isdir(
        os.path.join(PROJECT_ROOT, "minecolonies")
    ):
        target_mods.append("minecolonies")

    print(f"[*] Instance content mods: {len(target_mods)}")

    ready = []
    for mod_id in target_mods:
        if mod_id in JAR_ONLY_MODS:
            count = extract_textures_from_jar(mod_id, JAR_ONLY_MODS[mod_id])
            if count:
                print(f"[+] {mod_id}: extracted {count} textures from JAR")
                ready.append(mod_id)
            else:
                print(f"[-] {mod_id}: JAR extraction failed")
            continue

        if mod_id in MOD_REPOS:
            clone_mod(mod_id, MOD_REPOS[mod_id])

        count = ensure_best_source(mod_id, MOD_REPOS.get(mod_id))
        if count and os.path.isdir(find_source_textures_dir(mod_id)):
            ready.append(mod_id)
        else:
            print(f"[-] {mod_id}: no usable texture source")

    print(f"\n[*] Ready to upscale: {len(ready)} mods\n")

    failed = []
    for mod_id in ready:
        if not upscale_mod(mod_id, method, force=force):
            failed.append(mod_id)

    if failed:
        print(f"\n[-] Failed: {', '.join(failed)}")
        sys.exit(1)

    print("\n[*] Rebuilding resource pack...")
    pack = subprocess.run([sys.executable, "build_resourcepack.py"], cwd=PROJECT_ROOT)
    if pack.returncode != 0:
        sys.exit(pack.returncode)

    print("\n[*] All instance mods processed.")


if __name__ == "__main__":
    main()