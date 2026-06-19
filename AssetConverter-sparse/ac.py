#!/usr/bin/env python3
"""Omni32 Asset Engine CLI — autonomous mod texture upscaling and pack building."""
import argparse
import os
import subprocess
import sys

from config.paths import PROJECT_ROOT


def run(script, *args):
    path = None

    candidates = [
        os.path.join(PROJECT_ROOT, "pipeline", script),
        os.path.join(PROJECT_ROOT, "scripts", script),
    ]
    for candidate in candidates:
        if os.path.isfile(candidate):
            path = candidate
            break
    if not path:
        print(f"[-] Script not found: {script}")
        sys.exit(1)
    result = subprocess.run([sys.executable, path, *args], cwd=PROJECT_ROOT)
    sys.exit(result.returncode)


def main():
    parser = argparse.ArgumentParser(description="Omni32 Asset Engine (AssetConverter)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_pull = sub.add_parser("pull", help="Clone mod sources into sources/ and git commit")
    p_pull.add_argument("mods", nargs="+", help="Mod IDs")

    p_up = sub.add_parser("upscale", help="Upscale mod textures")
    p_up.add_argument("mod", help="Mod namespace")
    p_up.add_argument("--method", default="xbrz", choices=["xbrz", "hq2x", "waifu2x"])
    p_up.add_argument("--no-commit", action="store_true", help="Skip git commit of upscaled assets")

    p_build = sub.add_parser("build", help="Build Omni32 resource pack")
    p_build.add_argument("--deploy", action="store_true", help="Deploy to Minecraft instance")
    p_build.add_argument("--no-deploy", action="store_true", help="Skip instance deploy")

    sub.add_parser("status", help="Show mod queue status")

    p_run = sub.add_parser("run", help="Autonomous pipeline: pull → upscale → commit [→ build]")
    p_run.add_argument("mod", help="Registry mod_id")
    p_run.add_argument("--method", default="xbrz", choices=["xbrz", "hq2x", "waifu2x"])
    p_run.add_argument("--no-commit", action="store_true")
    p_run.add_argument("--build", action="store_true", help="Rebuild Omni32 after upscale")
    p_run.add_argument("--no-pull", action="store_true")

    p_next = sub.add_parser("next", help="Process next pending mod from queue")
    p_next.add_argument("--count", type=int, default=1)
    p_next.add_argument("--method", default="xbrz", choices=["xbrz", "hq2x", "waifu2x"])
    p_next.add_argument("--no-commit", action="store_true")
    p_next.add_argument("--build", action="store_true")
    p_next.add_argument(
        "--build-last",
        action="store_true",
        help="Rebuild Omni32 once after batch completes",
    )

    sub.add_parser("queue", help="Show engine queue status")
    sub.add_parser("sync-queue", help="Refresh MOD_QUEUE.md from output/assets")
    sub.add_parser("stats", help="Engine statistics dashboard")

    p_upload = sub.add_parser("upload-batch", help="Push a sources upload branch (01-11)")
    p_upload.add_argument("batch", help="Batch number, e.g. 04")
    p_upload.add_argument("--push", action="store_true", help="Push branch to origin")

    args = parser.parse_args()
    if args.cmd == "pull":
        run("pull_mod_sources.py", *args.mods)
        run("git_commit_sources.py", *args.mods)
    elif args.cmd == "upscale":
        run("run_upscale.py", args.mod, "--method", args.method)
        if not args.no_commit:
            run("git_commit_sources.py", args.mod)
    elif args.cmd == "build":
        build_args = []
        if getattr(args, "deploy", False):
            build_args.append("--deploy")
        if getattr(args, "no_deploy", False):
            build_args.append("--no-deploy")
        run("build_resourcepack.py", *build_args)
    elif args.cmd == "run":
        run_args = ["run", args.mod, "--method", args.method]
        if args.no_commit:
            run_args.append("--no-commit")
        if args.build:
            run_args.append("--build")
        if args.no_pull:
            run_args.append("--no-pull")
        run("engine.py", *run_args)
    elif args.cmd == "next":
        next_args = ["next", "--count", str(args.count), "--method", args.method]
        if args.no_commit:
            next_args.append("--no-commit")
        if args.build:
            next_args.append("--build")
        if getattr(args, "build_last", False):
            next_args.append("--build-last")
        run("engine.py", *next_args)
    elif args.cmd == "queue":
        run("engine.py", "queue")
    elif args.cmd == "sync-queue":
        run("sync_mod_queue.py")
    elif args.cmd == "stats":
        run("engine_stats.py")
    elif args.cmd == "status":
        run("_atm10_analyze.py")
    elif args.cmd == "upload-batch":
        upload_args = [args.batch]
        if args.push:
            upload_args.append("--push")
        run("upload_sources_batch.py", *upload_args)


if __name__ == "__main__":
    main()