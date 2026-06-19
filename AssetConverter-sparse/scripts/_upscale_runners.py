import subprocess
import sys

PROJECT_ROOT = r"C:\Users\Bulkl\OneDrive\Desktop\AssetConverter"

RUNNER_MODS = [
    "enderio",
    "industrialforegoing",
    "pneumaticcraft",
    "powah",
    "sophisticatedstorage",
    "handcrafted",
]


def main():
    failed = []
    for i, mod in enumerate(RUNNER_MODS, 1):
        print(f"\n{'=' * 60}\n[{i}/{len(RUNNER_MODS)}] Upscaling {mod}\n{'=' * 60}")
        result = subprocess.run(
            [sys.executable, "run_upscale.py", mod],
            cwd=PROJECT_ROOT,
        )
        if result.returncode != 0:
            failed.append(mod)

    print(f"\n[*] Upscaled {len(RUNNER_MODS) - len(failed)}/{len(RUNNER_MODS)} runner-up mods")
    if failed:
        print(f"[-] Failed: {', '.join(failed)}")
        sys.exit(1)


if __name__ == "__main__":
    main()