"""Patch pipeline scripts to use config.paths SOURCES_DIR."""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.paths import PROJECT_ROOT

PIPELINE = os.path.join(PROJECT_ROOT, "pipeline")
REPLACEMENTS = [
    (r"os\.path\.join\(PROJECT_ROOT, (repo_name|mod_name|host|mod_id|folder)\)",
     r"os.path.join(SOURCES_DIR, \1)"),
    (r"os\.path\.join\(PROJECT_ROOT, \"output\", \"assets\"",
     r"os.path.join(OUTPUT_ASSETS_DIR"),
    (r"PROJECT_ROOT = r\"C:\\\\Users\\\\Bulkl\\\\OneDrive\\\\Desktop\\\\AssetConverter\"",
     ""),
    (r"from mod_sources import", "from config.registry import"),
    (r"import mod_sources", "import config.registry as mod_sources"),
]

HEADER = """import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.paths import OUTPUT_ASSETS_DIR, PROJECT_ROOT, SOURCES_DIR

"""


def patch_file(path):
    with open(path, encoding="utf-8") as f:
        text = f.read()
    if "SOURCES_DIR" in text and "config.paths" in text:
        return False
    text = text.replace("os.path.join(PROJECT_ROOT, repo_name)", "os.path.join(SOURCES_DIR, repo_name)")
    text = text.replace("os.path.join(PROJECT_ROOT, mod_name)", "os.path.join(SOURCES_DIR, mod_name)")
    text = text.replace("os.path.join(PROJECT_ROOT, host)", "os.path.join(SOURCES_DIR, host)")
    text = text.replace('os.path.join(PROJECT_ROOT, "output", "assets"', "os.path.join(OUTPUT_ASSETS_DIR")
    text = text.replace(
        'PROJECT_ROOT = r"C:\\Users\\Bulkl\\OneDrive\\Desktop\\AssetConverter"\n', ""
    )
    text = text.replace("from mod_sources import", "from config.registry import")
    if "config.paths" not in text:
        text = HEADER + text
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    return True


def main():
    os.makedirs(PIPELINE, exist_ok=True)
    root = PROJECT_ROOT
    for name in os.listdir(root):
        if not name.endswith(".py") or name.startswith("_"):
            continue
        src = os.path.join(root, name)
        dest = os.path.join(PIPELINE, name)
        if name in ("ac.py",):
            continue
        if not os.path.exists(dest):
            import shutil
            shutil.copy2(src, dest)
    for name in os.listdir(PIPELINE):
        if name.endswith(".py"):
            if patch_file(os.path.join(PIPELINE, name)):
                print(f"[+] patched pipeline/{name}")


if __name__ == "__main__":
    main()