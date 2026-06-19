"""Merge upload/output-* branches into main."""
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.paths import PROJECT_ROOT

BRANCHES = [
    "upload/output-assets-a",
    "upload/output-assets-b",
    "upload/output-assets-gap",
    "upload/output-extras",
    "upload/output-resourcepack",
]


def clear_lock():
    lock = os.path.join(PROJECT_ROOT, ".git", "index.lock")
    if os.path.isfile(lock):
        os.remove(lock)


def run(cmd, check=True):
    print(f"[*] {' '.join(cmd)}")
    return subprocess.run(cmd, cwd=PROJECT_ROOT, check=check)


def main():
    clear_lock()
    run(["git", "fetch", "origin"])
    run(["git", "switch", "main"])
    run(["git", "pull", "origin", "main"])

    merged = []
    for branch in BRANCHES:
        clear_lock()
        local = subprocess.run(
            ["git", "rev-parse", "--verify", branch],
            cwd=PROJECT_ROOT,
            capture_output=True,
        )
        remote = subprocess.run(
            ["git", "rev-parse", "--verify", f"origin/{branch}"],
            cwd=PROJECT_ROOT,
            capture_output=True,
        )
        ref = branch if local.returncode == 0 else f"origin/{branch}"
        if local.returncode != 0 and remote.returncode != 0:
            print(f"[!] Skip missing {branch}")
            continue
        result = run(["git", "merge", "--no-ff", ref, "-m", f"merge {branch}"], check=False)
        if result.returncode != 0:
            run(["git", "merge", "--abort"], check=False)
            print(f"[-] Failed {branch}")
            sys.exit(1)
        merged.append(branch)

    if merged:
        run(["git", "push", "origin", "main"])
    print(f"[+] Merged {len(merged)} output branches: {', '.join(merged)}")


if __name__ == "__main__":
    main()