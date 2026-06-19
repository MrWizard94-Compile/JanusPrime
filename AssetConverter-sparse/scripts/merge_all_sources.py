"""Merge all upload/sources-* branches into main sequentially."""
import subprocess
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.paths import PROJECT_ROOT

BRANCHES = [
    f"upload/sources-{n:02d}-" + suffix
    for n, suffix in [
        (1, "mowziesmobs"),
        (2, "minecolonies-railways"),
        (3, "alexscaves-aether-mcw"),
        (4, "eternal-rechiseled"),
        (5, "twilight-botania"),
        (6, "create-refined"),
        (7, "mekanism-biomes"),
        (8, "tconstruct-iceandfire-otbwg"),
        (9, "tech-magic-mid"),
        (10, "create-ecosystem"),
        (11, "remaining-mods"),
    ]
]


def clear_lock():
    lock = os.path.join(PROJECT_ROOT, ".git", "index.lock")
    if os.path.isfile(lock):
        os.remove(lock)


def run(cmd):
    print(f"[*] {' '.join(cmd)}")
    return subprocess.run(cmd, cwd=PROJECT_ROOT)


def main():
    clear_lock()
    run(["git", "fetch", "origin"])
    run(["git", "switch", "main"])
    run(["git", "pull", "origin", "main"])

    merged = []
    failed = []
    for branch in BRANCHES:
        clear_lock()
        r = subprocess.run(
            ["git", "rev-parse", "--verify", branch],
            cwd=PROJECT_ROOT,
            capture_output=True,
        )
        if r.returncode != 0:
            r = subprocess.run(
                ["git", "rev-parse", "--verify", f"origin/{branch}"],
                cwd=PROJECT_ROOT,
                capture_output=True,
            )
            if r.returncode == 0:
                run(["git", "switch", "main"])
                run(["git", "merge", "--no-ff", f"origin/{branch}", "-m", f"merge {branch}"])
            else:
                print(f"[!] Skip missing {branch}")
                continue
        else:
            run(["git", "switch", "main"])
            result = run(["git", "merge", "--no-ff", branch, "-m", f"merge {branch}"])
            if result.returncode != 0:
                failed.append(branch)
                run(["git", "merge", "--abort"], check=False)
                continue
        merged.append(branch)

    if merged:
        run(["git", "push", "origin", "main"])
    print(f"[+] Merged {len(merged)} branches")
    if failed:
        print(f"[-] Failed: {', '.join(failed)}")
        sys.exit(1)


if __name__ == "__main__":
    main()