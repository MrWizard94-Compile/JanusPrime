"""Merge an upload/* branch into main and push."""
import argparse
import subprocess
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.paths import PROJECT_ROOT


def clear_index_lock():
    lock = os.path.join(PROJECT_ROOT, ".git", "index.lock")
    if os.path.isfile(lock):
        os.remove(lock)
        print("[!] Removed stale .git/index.lock")


def run(cmd, check=True):
    print(f"[*] {' '.join(cmd)}")
    return subprocess.run(cmd, cwd=PROJECT_ROOT, check=check)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("branch", help="upload/sources-... or upload/output-...")
    args = parser.parse_args()

    clear_index_lock()
    run(["git", "fetch", "origin"])
    run(["git", "switch", "main"])
    run(["git", "pull", "origin", "main"])
    run(["git", "merge", "--no-ff", args.branch, "-m", f"merge {args.branch}"])
    run(["git", "push", "origin", "main"])
    print(f"[+] Merged {args.branch} into main")


if __name__ == "__main__":
    main()