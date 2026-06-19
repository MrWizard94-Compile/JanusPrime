"""Remove duplicate root-level .py files now living in pipeline/."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.paths import PROJECT_ROOT

KEEP = {"ac.py", "mod_sources.py"}
PIPELINE = os.path.join(PROJECT_ROOT, "pipeline")

for name in os.listdir(PROJECT_ROOT):
    if not name.endswith(".py") or name in KEEP:
        continue
    root_path = os.path.join(PROJECT_ROOT, name)
    pipe_path = os.path.join(PIPELINE, name)
    if os.path.isfile(pipe_path):
        os.remove(root_path)
        print(f"[-] removed duplicate root/{name}")