"""Omni32 autonomous asset engine — pull, upscale, commit, build in one pass."""
import argparse
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.paths import PROJECT_ROOT
from config.registry import texture_namespace
from pipeline.queue import next_mod, pending_mods, queue_status


def _run(script, *args, check=True):
    for folder in ("pipeline", "scripts"):
        path = os.path.join(PROJECT_ROOT, folder, script)
        if os.path.isfile(path):
            break
    else:
        raise FileNotFoundError(script)
    print(f"[*] engine: {script} {' '.join(args)}")
    result = subprocess.run([sys.executable, path, *args], cwd=PROJECT_ROOT)
    if check and result.returncode != 0:
        raise SystemExit(result.returncode)
    return result.returncode


def process_mod(
    mod_id,
    *,
    method="xbrz",
    commit=True,
    build=False,
    pull=True,
):
    namespace = texture_namespace(mod_id)
    print(f"[*] Omni32 engine: {mod_id} → namespace `{namespace}`")

    if pull:
        _run("pull_mod_sources.py", mod_id)
        if commit:
            _run("git_commit_sources.py", mod_id)

    _run("run_upscale.py", mod_id, "--method", method)
    if commit:
        _run("git_commit_sources.py", mod_id)

    if build:
        build_args = []
        if os.environ.get("OMNI32_DEPLOY", "").lower() in ("0", "false", "no"):
            build_args.append("--no-deploy")
        _run("build_resourcepack.py", *build_args)

    _run("sync_mod_queue.py", mod_id, check=False)

    print(f"[+] Engine finished: {mod_id} → output/assets/{namespace}/")
    return mod_id


def process_queue(count=1, **kwargs):
    build_last = kwargs.pop("build_last", False)
    build_each = kwargs.pop("build", False)
    skip_errors = kwargs.pop("skip_errors", True)
    processed = []
    failed = []
    skipped = set()
    for _ in range(count):
        mod_id = None
        for candidate in pending_mods():
            if candidate not in skipped:
                mod_id = candidate
                break
        if not mod_id:
            print("[*] Queue empty — nothing to process")
            break
        try:
            process_mod(mod_id, build=build_each, **kwargs)
            processed.append(mod_id)
        except SystemExit:
            skipped.add(mod_id)
            failed.append(mod_id)
            print(f"[-] Engine skipped {mod_id} after failure")
            if not skip_errors:
                raise
    if build_last and processed and not build_each:
        _run("build_resourcepack.py", "--no-deploy", check=False)
    if failed:
        print(f"[!] Failed mods: {', '.join(failed)}")
    return processed


def main():
    parser = argparse.ArgumentParser(description="Omni32 autonomous asset engine")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_one = sub.add_parser("run", help="Full pipeline for one mod")
    p_one.add_argument("mod")
    p_one.add_argument("--method", default="xbrz", choices=["xbrz", "hq2x", "waifu2x"])
    p_one.add_argument("--no-commit", action="store_true")
    p_one.add_argument("--build", action="store_true", help="Rebuild Omni32 pack after upscale")
    p_one.add_argument("--no-pull", action="store_true")

    p_next = sub.add_parser("next", help="Process next pending mod from queue")
    p_next.add_argument("--count", type=int, default=1)
    p_next.add_argument("--method", default="xbrz", choices=["xbrz", "hq2x", "waifu2x"])
    p_next.add_argument("--no-commit", action="store_true")
    p_next.add_argument("--build", action="store_true")
    p_next.add_argument(
        "--build-last",
        action="store_true",
        help="Rebuild Omni32 once after the batch (no deploy)",
    )

    sub.add_parser("queue", help="Show queue status")

    args = parser.parse_args()
    if args.cmd == "run":
        process_mod(
            args.mod,
            method=args.method,
            commit=not args.no_commit,
            build=args.build,
            pull=not args.no_pull,
        )
    elif args.cmd == "next":
        process_queue(
            args.count,
            method=args.method,
            commit=not args.no_commit,
            build=args.build,
            build_last=args.build_last,
        )
    elif args.cmd == "queue":
        done, pending = queue_status()
        print(f"[*] Done ({len(done)}): {', '.join(done) or '(none)'}")
        print(f"[*] Pending ({len(pending)}):")
        for item in pending:
            if isinstance(item, tuple):
                mod_id, state = item
                print(f"    {mod_id}: {state}")
            else:
                print(f"    {item}")
        nxt = next_mod()
        if nxt:
            print(f"[*] Next: {nxt}")


if __name__ == "__main__":
    main()