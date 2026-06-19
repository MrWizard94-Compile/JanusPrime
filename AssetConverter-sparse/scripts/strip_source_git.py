"""Remove nested .git from sources/* so clones are plain trees, not submodules."""
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.paths import SOURCES_DIR


def main():
    removed = []
    if not os.path.isdir(SOURCES_DIR):
        print("[-] No sources/")
        return
    for name in sorted(os.listdir(SOURCES_DIR)):
        path = os.path.join(SOURCES_DIR, name)
        git_dir = os.path.join(path, ".git")
        if not os.path.isdir(path) or not os.path.exists(git_dir):
            continue
        if os.path.isdir(git_dir):
            shutil.rmtree(git_dir, ignore_errors=True)
        else:
            os.remove(git_dir)
        removed.append(name)
    print(f"[+] Stripped .git from {len(removed)} sources")
    for name in removed:
        print(f"    {name}")


if __name__ == "__main__":
    main()