import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import os
import shutil
import subprocess
import sys

from config.paths import JARS_DIR, PROJECT_ROOT, SOURCES_DIR
from config.registry import (
    CLONE_BRANCHES,
    MODRINTH_JAR_MODS,
    MOD_REPOS,
    download_modrinth_jar,
    extract_textures_from_jar,
    jar_texture_count,
)
from pipeline.run_upscale import find_source_textures_dir

PLANNED_MOD_REPOS = MOD_REPOS

# Namespaces hosted inside another cloned repo folder.
MONOREPO_HOSTS = {
    "mekanismgenerators": "mekanism",
    "mekanismtools": "mekanism",
}


def count_pngs(path):
    if not os.path.isdir(path):
        return 0
    return sum(
        1
        for root, _, files in os.walk(path)
        for file in files
        if file.endswith(".png")
    )


def pull_from_modrinth_jar(mod_id):
    jar_name = download_modrinth_jar(mod_id)
    if not jar_name:
        return False, 0
    count = extract_textures_from_jar(mod_id, jar_name)
    if count:
        tex_dir = find_source_textures_dir(mod_id)
        print(f"[+] {mod_id}: {count} textures from modrinth jar at {tex_dir}")
        return True, count
    print(f"[-] {mod_id}: modrinth jar extracted but textures not found")
    return False, 0


def prefer_modrinth_jar(mod_id, repo_count):
    if mod_id not in MODRINTH_JAR_MODS:
        return repo_count, False
    jar_name = download_modrinth_jar(mod_id)
    if not jar_name:
        return repo_count, False
    jar_path = os.path.join(JARS_DIR, jar_name)
    if not os.path.isfile(jar_path):
        return repo_count, False
    jar_count = jar_texture_count(mod_id, jar_name)
    if jar_count > repo_count:
        success, count = pull_from_modrinth_jar(mod_id)
        return count if success else repo_count, success
    return repo_count, False


def clone_mod(mod_id, repo_url):
    host = MONOREPO_HOSTS.get(mod_id, mod_id)
    dest = os.path.join(SOURCES_DIR, host)
    tex_dir = find_source_textures_dir(mod_id)
    existing = count_pngs(tex_dir) if os.path.isdir(tex_dir) else 0
    if existing:
        count, upgraded = prefer_modrinth_jar(mod_id, existing)
        if upgraded:
            return True, count
        print(f"[=] {mod_id}: already has {existing} textures at {tex_dir}")
        return True, existing

    if os.path.isdir(dest):
        if mod_id in MONOREPO_HOSTS:
            if existing:
                print(f"[+] {mod_id}: found {existing} textures in {host} monorepo")
                return True, existing
        else:
            print(f"[!] {mod_id}: folder exists, scanning for textures...")
            if existing:
                print(f"[+] {mod_id}: found {existing} textures")
                return True, existing
            if mod_id in MODRINTH_JAR_MODS:
                return pull_from_modrinth_jar(mod_id)
        print(f"[-] {mod_id}: repo present but no textures in expected paths")
        return False, 0

    if mod_id in MONOREPO_HOSTS:
        print(f"[*] {mod_id}: waiting for {host} monorepo clone")
        return False, 0

    branch = CLONE_BRANCHES.get(mod_id)
    clone_cmd = ["git", "clone", "--depth", "1"]
    if branch:
        clone_cmd.extend(["-b", branch])
    clone_cmd.extend([repo_url, dest])
    branch_note = f" (branch {branch})" if branch else ""
    print(f"[*] {mod_id}: cloning{branch_note} {repo_url}")
    result = subprocess.run(
        clone_cmd,
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(result.stderr.strip() or result.stdout.strip())
        if mod_id in MODRINTH_JAR_MODS:
            return pull_from_modrinth_jar(mod_id)
        return False, 0

    nested_git = os.path.join(dest, ".git")
    if os.path.exists(nested_git):
        if os.path.isdir(nested_git):
            shutil.rmtree(nested_git, ignore_errors=True)
        else:
            os.remove(nested_git)

    tex_dir = find_source_textures_dir(mod_id)
    count = count_pngs(tex_dir) if os.path.isdir(tex_dir) else 0
    if count:
        final_count, upgraded = prefer_modrinth_jar(mod_id, count)
        if upgraded:
            return True, final_count
        print(f"[+] {mod_id}: {count} textures at {tex_dir}")
        return True, count

    print(f"[-] {mod_id}: cloned but textures not found (check namespace/layout)")
    if mod_id in MODRINTH_JAR_MODS:
        return pull_from_modrinth_jar(mod_id)
    return False, 0


def main():
    mods = sys.argv[1:] if len(sys.argv) > 1 else list(PLANNED_MOD_REPOS.keys())
    ok = []
    failed = []

    clone_queue = []
    for mod_id in mods:
        if mod_id in MONOREPO_HOSTS:
            host = MONOREPO_HOSTS[mod_id]
            if host not in clone_queue:
                clone_queue.append(host)
            continue
        if mod_id in PLANNED_MOD_REPOS:
            clone_queue.append(mod_id)

    for mod_id in dict.fromkeys(clone_queue):
        clone_mod(mod_id, PLANNED_MOD_REPOS[mod_id])

    if "thermal" in mods:
        for thermal_mod in (
            "thermal_core",
            "thermal_foundation",
            "thermal_expansion",
            "thermal_innovation",
        ):
            if thermal_mod not in clone_queue:
                clone_queue.append(thermal_mod)
        for thermal_mod in (
            "thermal_core",
            "thermal_foundation",
            "thermal_expansion",
            "thermal_innovation",
        ):
            clone_mod(thermal_mod, PLANNED_MOD_REPOS[thermal_mod])

    for mod_id in mods:
        if mod_id == "thermal":
            from pipeline.run_upscale import find_source_texture_roots

            roots = find_source_texture_roots("thermal")
            count = sum(
                sum(
                    1
                    for _, _, files in os.walk(root)
                    for file in files
                    if file.endswith(".png")
                )
                for root in roots
            )
            if roots:
                print(f"[+] thermal: {count} textures across {len(roots)} roots")
                ok.append(("thermal", count))
            else:
                failed.append("thermal")
            continue
        if mod_id in MONOREPO_HOSTS:
            success, count = clone_mod(mod_id, PLANNED_MOD_REPOS[MONOREPO_HOSTS[mod_id]])
        elif mod_id not in PLANNED_MOD_REPOS:
            print(f"[-] {mod_id}: unknown mod id")
            failed.append(mod_id)
            continue
        else:
            success, count = clone_mod(mod_id, PLANNED_MOD_REPOS[mod_id])
        if success:
            ok.append((mod_id, count))
        else:
            failed.append(mod_id)

    print(f"\n[*] Pulled {len(ok)}/{len(mods)} mods")
    for mod_id, count in ok:
        print(f"    {mod_id}: {count} textures")

    if failed:
        print(f"[-] Failed: {', '.join(failed)}")
        sys.exit(1)


if __name__ == "__main__":
    main()