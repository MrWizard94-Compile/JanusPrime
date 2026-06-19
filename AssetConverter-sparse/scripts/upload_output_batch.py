"""Create and push upload/output-* branches for upscaled assets."""
import argparse
import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.paths import OUTPUT_ASSETS_DIR, PROJECT_ROOT, RESOURCEPACK_DIR


def clear_lock():
    lock = os.path.join(PROJECT_ROOT, ".git", "index.lock")
    if not os.path.isfile(lock):
        return
    try:
        os.remove(lock)
    except OSError:
        pass


def run(cmd, check=True, retries=1):
    print(f"[*] {' '.join(cmd)}")
    last = None
    for attempt in range(retries):
        if attempt:
            clear_lock()
            time.sleep(2)
        last = subprocess.run(cmd, cwd=PROJECT_ROOT, check=False)
        if last.returncode == 0:
            if check:
                last.check_returncode()
            return last
    if check:
        last.check_returncode()
    return last


def asset_dirs():
    if not os.path.isdir(OUTPUT_ASSETS_DIR):
        return []
    return sorted(
        d
        for d in os.listdir(OUTPUT_ASSETS_DIR)
        if os.path.isdir(os.path.join(OUTPUT_ASSETS_DIR, d, "textures"))
    )


def branch_exists(name):
    r = subprocess.run(
        ["git", "rev-parse", "--verify", name],
        cwd=PROJECT_ROOT,
        capture_output=True,
    )
    return r.returncode == 0


def remote_exists(name):
    r = subprocess.run(
        ["git", "ls-remote", "--heads", "origin", name],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
    )
    return bool(r.stdout.strip())


def push_batch_a(push):
    names = asset_dirs()
    split = (len(names) + 1) // 2
    batch = names[:split]
    branch = "upload/output-assets-a"
    paths = [f"output/assets/{n}/" for n in batch]
    msg = f"data(output): upscaled assets batch A ({len(batch)} namespaces)"
    return branch, paths, msg, push


def push_batch_b(push):
    names = asset_dirs()
    split = (len(names) + 1) // 2
    batch = names[split:]
    branch = "upload/output-assets-b"
    paths = [f"output/assets/{n}/" for n in batch]
    msg = f"data(output): upscaled assets batch B ({len(batch)} namespaces)"
    return branch, paths, msg, push


def push_extras(push):
    branch = "upload/output-extras"
    paths = []
    for sub in ("comparisons", "experiments"):
        p = os.path.join(PROJECT_ROOT, "output", sub)
        if os.path.isdir(p):
            paths.append(f"output/{sub}/")
    msg = "data(output): comparisons and experiments"
    return branch, paths, msg, push


def push_resourcepack(push):
    branch = "upload/output-resourcepack"
    paths = ["output/resourcepack/"]
    msg = "data(output): Omni32 resource pack"
    return branch, paths, msg, push


BATCHES = {
    "a": push_batch_a,
    "b": push_batch_b,
    "extras": push_extras,
    "resourcepack": push_resourcepack,
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("batch", choices=sorted(BATCHES))
    parser.add_argument("--push", action="store_true")
    args = parser.parse_args()

    branch, paths, msg, _ = BATCHES[args.batch](args.push)
    if not paths:
        print(f"[-] No paths for batch {args.batch}")
        sys.exit(1)

    clear_lock()
    run(["git", "-c", "gc.auto=0", "fetch", "origin"], check=False)
    run(["git", "switch", "main"], check=False)
    run(["git", "-c", "gc.auto=0", "pull", "origin", "main"], check=False)
    time.sleep(3)
    clear_lock()

    if remote_exists(branch) and branch_exists(branch):
        print(f"[=] {branch} already on origin")
        if args.push:
            run(["git", "switch", branch], check=False)
            run(["git", "push", "-u", "origin", branch], check=False)
        return

    if branch_exists(branch):
        run(["git", "branch", "-D", branch], check=False)

    clear_lock()
    run(["git", "switch", "-c", branch])
    for path in paths:
        run(["git", "add", "--", path], retries=5)
    result = run(["git", "commit", "-m", msg], check=False)
    if result.returncode != 0:
        print("[-] Commit failed")
        sys.exit(1)
    if args.push:
        run(["git", "push", "-u", "origin", branch])
    print(f"[+] {branch}: {len(paths)} path groups committed")


if __name__ == "__main__":
    main()