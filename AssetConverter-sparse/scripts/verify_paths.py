import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.paths import OUTPUT_ASSETS_DIR, SOURCES_DIR
from pipeline.run_upscale import find_source_textures_dir

assert os.path.isdir(SOURCES_DIR), SOURCES_DIR
assert os.path.isdir(OUTPUT_ASSETS_DIR), OUTPUT_ASSETS_DIR
jei = find_source_textures_dir("jei")
assert "sources" in jei and jei.endswith("textures"), jei
print("[+] paths OK:", jei)