"""Push the 11-namespace gap missed between batch A and B."""
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.paths import PROJECT_ROOT

GAP_NAMESPACES = [
    "fluxnetworks",
    "forbidden_arcanus",
    "functionalstorage",
    "handcrafted",
    "iceandfire",
    "immersiveengineering",
    "industrialforegoing",
    "integrateddynamics",
    "integratedterminals",
    "interiors",
    "ironfurnaces",
]

BRANCH = "upload/output-assets-gap"


def clear_lock():
    lock = os.path.join(PROJECT_ROOT, ".git", "index.lock")
    if os.path.isfile(lock):
        os.remove(lock)


def run(cmd, check=True):
    print(f"[*] {' '.join(cmd)}")
    return subprocess.run(cmd, cwd=PROJECT_ROOT, check=check)


def main():
    paths = []
    for ns in GAP_NAMESPACES:
        tex = os.path.join(PROJECT_ROOT, "output", "assets", ns, "textures")
        if os.path.isdir(tex):
            paths.append(f"output/assets/{ns}/")
        else:
            print(f"[!] Missing on disk: {ns}")

    if not paths:
        print("[-] No gap namespaces on disk")
        sys.exit(1)

    clear_lock()
    run(["git", "fetch", "origin"], check=False)
    run(["git", "switch", "main"])
    run(["git", "pull", "origin", "main"], check=False)
    run(["git", "branch", "-D", BRANCH], check=False)
    run(["git", "switch", "-c", BRANCH])
    run(["git", "add", "--", *paths])
    run(["git", "commit", "-m", f"data(output): upscaled assets gap ({len(paths)} namespaces)"])
    run(["git", "push", "-u", "origin", BRANCH])
    print(f"[+] Pushed {BRANCH} with {len(paths)} namespaces")


if __name__ == "__main__":
    main()