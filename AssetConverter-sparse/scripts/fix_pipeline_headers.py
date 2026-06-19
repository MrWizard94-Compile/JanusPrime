import os
import re

PIPELINE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "pipeline")
HEADER = (
    "import os\nimport sys\n"
    "sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))\n\n"
)

for name in os.listdir(PIPELINE):
    if not name.endswith(".py"):
        continue
    path = os.path.join(PIPELINE, name)
    text = open(path, encoding="utf-8").read()
    text = re.sub(
        r"^import sys\r?\nimport os\r?\n"
        r"sys\.path\.insert\(0, os\.path\.dirname\(os\.path\.dirname\(os\.path\.abspath\(__file__\)\)\)\)\r?\n\r?\n",
        "",
        text,
        count=1,
    )
    text = re.sub(
        r"^from config\.paths import[^\n]+\r?\n\r?\n",
        "",
        text,
        count=1,
    )
    if not text.startswith("import os\nimport sys"):
        if text.startswith("#!") or text.startswith('"""') or text.startswith("from __future__"):
            lines = text.splitlines(keepends=True)
            insert_at = 0
            if text.startswith("#!"):
                insert_at = 1
            while insert_at < len(lines) and (
                lines[insert_at].startswith('"""') or lines[insert_at].startswith("from __future__")
            ):
                if '"""' in lines[insert_at] and lines[insert_at].count('"""') >= 2:
                    insert_at += 1
                    break
                insert_at += 1
            text = "".join(lines[:insert_at]) + HEADER + "".join(lines[insert_at:])
        else:
            text = HEADER + text
    open(path, "w", encoding="utf-8").write(text)
    print(f"[+] fixed {name}")