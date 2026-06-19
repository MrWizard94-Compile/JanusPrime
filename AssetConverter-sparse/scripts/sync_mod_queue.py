"""Sync docs/MOD_QUEUE.md done-state and namespace list from output/assets/."""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.paths import OUTPUT_ASSETS_DIR, PROJECT_ROOT
from config.registry import MOD_REPOS, texture_namespace
from pipeline.queue import QUEUE_PRIORITY

MOD_QUEUE_PATH = os.path.join(PROJECT_ROOT, "docs", "MOD_QUEUE.md")


def list_upscaled_namespaces():
    if not os.path.isdir(OUTPUT_ASSETS_DIR):
        return []
    namespaces = []
    for name in sorted(os.listdir(OUTPUT_ASSETS_DIR)):
        tex = os.path.join(OUTPUT_ASSETS_DIR, name, "textures")
        if not os.path.isdir(tex):
            continue
        count = sum(
            1
            for _, _, files in os.walk(tex)
            for f in files
            if f.endswith(".png")
        )
        if count:
            namespaces.append((name, count))
    return namespaces


def count_mod_textures(mod_id):
    ns = texture_namespace(mod_id)
    tex = os.path.join(OUTPUT_ASSETS_DIR, ns, "textures")
    if not os.path.isdir(tex):
        return 0, ns
    count = sum(
        1
        for _, _, files in os.walk(tex)
        for f in files
        if f.endswith(".png")
    )
    return count, ns


def sync_namespace_block(text, namespaces):
    count = len(namespaces)
    names = ", ".join(n for n, _ in namespaces)
    text = re.sub(
        r"\*\*\d+\*\* namespaces already processed:",
        f"**{count}** namespaces already processed:",
        text,
        count=1,
    )
    text = re.sub(
        r"```\n[\s\S]*?\n```",
        f"```\n{names}\n```",
        text,
        count=1,
    )
    text = re.sub(
        r"\| Already upscaled \(namespace match\) \| \d+ \|",
        f"| Already upscaled (namespace match) | {count} |",
        text,
        count=1,
    )
    mod_repos_count = len(MOD_REPOS)
    text = re.sub(
        r"\| `MOD_REPOS` entries \| \d+ \|",
        f"| `MOD_REPOS` entries | {mod_repos_count} |",
        text,
        count=1,
    )
    return text


def mark_mod_done(text, mod_id):
    count, ns = count_mod_textures(mod_id)
    if count == 0:
        return text, False

    pattern = rf"(\| \d+ \| `{re.escape(mod_id)}`)([^|]*\|)([^|]*\|)([^|]*\|)([^|]*\|)([^|\n]*)"
    match = re.search(pattern, text)
    if not match:
        return text, False
    if "**DONE**" in match.group(0):
        return text, False

    replacement = (
        f"| {match.group(0).split('|')[1].strip()} | `{mod_id}` **DONE** |"
        f"{match.group(2)}{match.group(3)}{match.group(4)}"
        f" {count} | **DONE** — namespace `{ns}`, {count} PNG upscaled |"
    )
    # Simpler line replace
    old_line = match.group(0)
    parts = [p.strip() for p in old_line.split("|")]
    if len(parts) >= 7:
        priority = parts[1]
        new_line = (
            f"| {priority} | `{mod_id}` **DONE** | {parts[3]} | {parts[4]} | {count} | "
            f"**DONE** — namespace `{ns}`, {count} PNG upscaled |"
        )
        text = text.replace(old_line, new_line, 1)
        return text, True
    return text, False


def main():
    mods = sys.argv[1:] if len(sys.argv) > 1 else QUEUE_PRIORITY
    if not os.path.isfile(MOD_QUEUE_PATH):
        print(f"[-] Missing {MOD_QUEUE_PATH}")
        sys.exit(1)

    with open(MOD_QUEUE_PATH, encoding="utf-8") as handle:
        text = handle.read()

    namespaces = list_upscaled_namespaces()
    text = sync_namespace_block(text, namespaces)

    updated = []
    for mod_id in mods:
        text, changed = mark_mod_done(text, mod_id)
        if changed:
            updated.append(mod_id)

    with open(MOD_QUEUE_PATH, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(text)

    print(f"[+] Synced MOD_QUEUE: {len(namespaces)} namespaces, marked {len(updated)} mods DONE")
    if updated:
        for mod_id in updated:
            c, ns = count_mod_textures(mod_id)
            print(f"    {mod_id} → {ns} ({c} PNG)")


if __name__ == "__main__":
    main()