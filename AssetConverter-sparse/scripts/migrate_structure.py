"""One-time migration: move mod clones to sources/, data files to data/, strip nested .git."""
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.paths import DATA_DIR, PROJECT_ROOT, SOURCES_DIR

KEEP_DIRS = {
    "config",
    "pipeline",
    "scripts",
    "sources",
    "output",
    "data",
    "docs",
    "references",
    "local",
    ".git",
}

KEEP_FILES = {
    ".gitignore",
    ".gitattributes",
    "SOUL.md",
    "README.md",
}

MOVE_TO_DATA = {
    "_atm10_mods_raw.json": "atm10_mods_raw.json",
    "_atm10_research.md": "atm10_research.md",
}

JUNK = [
    "tools",
    "terminals",
    "models",
    "_tmp_apo",
    "create_reconnected",
    "waifu2x-ncnn-vulkan-20250915-windows",
    "xbrz",
    "__pycache__",
    "input.jpg",
    "input2.jpg",
    "onepiece_demo.mp4",
    "minecolonies.zip",
    "realesrgan-ncnn-vulkan-20220424-windows.zip",
    "ScalerTest_1.1.zip",
    "ScalerTest_1.1_real.zip",
    "waifu2x-ncnn-vulkan-20250915-windows.zip",
    "realesrgan-ncnn-vulkan.exe",
    "libgcc_s_seh-1.dll",
    "libstdc++-6.dll",
    "libwinpthread-1.dll",
    "vcomp140.dll",
    "vcomp140d.dll",
    "_xbrz.cp310-win_amd64.pyd",
    "README_windows.md",
]


def strip_nested_git(path):
    git_dir = os.path.join(path, ".git")
    if os.path.isdir(git_dir):
        shutil.rmtree(git_dir, ignore_errors=True)
        if not os.path.exists(git_dir):
            print(f"  [-] stripped .git from {path}")
        else:
            print(f"  [!] could not fully strip .git from {path} (ignored)")


def main():
    os.makedirs(SOURCES_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)

    for src, dest in MOVE_TO_DATA.items():
        src_path = os.path.join(PROJECT_ROOT, src)
        if os.path.isfile(src_path):
            shutil.move(src_path, os.path.join(DATA_DIR, dest))
            print(f"[+] data/{dest}")

    for name in sorted(os.listdir(PROJECT_ROOT)):
        path = os.path.join(PROJECT_ROOT, name)
        if name in KEEP_DIRS or name in KEEP_FILES:
            continue
        if name in JUNK:
            try:
                if os.path.isdir(path):
                    shutil.rmtree(path, ignore_errors=True)
                elif os.path.isfile(path):
                    os.remove(path)
                print(f"[-] deleted {name}")
            except OSError as exc:
                print(f"[!] could not delete {name}: {exc}")
            continue
        if name.endswith(".py") and not name.startswith("_"):
            continue  # handled separately
        if name.startswith("_") and name.endswith(".py"):
            continue
        if os.path.isdir(path):
            dest = os.path.join(SOURCES_DIR, name)
            if os.path.exists(dest):
                print(f"[!] skip {name} — already in sources/")
                continue
            shutil.move(path, dest)
            strip_nested_git(dest)
            print(f"[+] sources/{name}")

    for script in [
        f
        for f in os.listdir(PROJECT_ROOT)
        if f.startswith("_") and f.endswith(".py")
    ]:
        src = os.path.join(PROJECT_ROOT, script)
        dest = os.path.join(PROJECT_ROOT, "scripts", script)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        if not os.path.exists(dest):
            shutil.move(src, dest)
            print(f"[+] scripts/{script}")

    print("[*] Migration complete.")


if __name__ == "__main__":
    main()