#!/usr/bin/env python3
"""Watch COMMS-CLAUDE-GROK.md for new Claude entries."""
from __future__ import annotations

import hashlib
import json
import re
import time
from datetime import datetime, timezone
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COMMS = ROOT / "COMMS-CLAUDE-GROK.md"
STATE_DIR = ROOT / "agent-tools" / "comms-watcher"
STATE_FILE = STATE_DIR / "state.json"
LOG_FILE = STATE_DIR / "watcher.log"
POLL_SECONDS = 15

CLAUDE_HEADER = re.compile(r"^### \[[\d-]+", re.MULTILINE)


def log(msg: str) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}\n")


def tail_hash(content: str) -> str:
    tail = "\n".join(content.splitlines()[-80:])
    return hashlib.sha256(tail.encode("utf-8")).hexdigest()


def is_claude_to_grok(header: str) -> bool:
    return (
        header.startswith("### [")
        and "Claude" in header
        and "Grok" in header
        and "Grok" not in header.split("Claude", 1)[0]
    )


def latest_claude_entry(content: str) -> str | None:
    entries: list[str] = []
    current: list[str] = []
    for line in content.splitlines():
        if line.startswith("### "):
            if current and is_claude_to_grok(current[0]):
                entries.append("\n".join(current))
            current = [line]
        elif current:
            current.append(line)
    if current and is_claude_to_grok(current[0]):
        entries.append("\n".join(current))
    return entries[-1] if entries else None


def needs_grok_reply(entry: str | None) -> bool:
    if not entry:
        return False
    return (
        "[ASK]" in entry
        or "Post result here" in entry
        or "Ping me" in entry
    )


def write_state(content: str, h: str, force: bool, last_hash: str | None) -> str:
    if not force and h == last_hash:
        return last_hash or h

    entry = latest_claude_entry(content)
    state = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "tail_hash": h,
        "file": str(COMMS),
        "changed": True,
        "needs_grok_reply": needs_grok_reply(entry),
        "latest_claude_title": entry.splitlines()[0] if entry else None,
        "latest_claude_entry": entry,
        "line_count": len(content.splitlines()),
        "watcher": "watch-comms.py",
    }
    STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")
    log(
        f"STATE needs_reply={state['needs_grok_reply']} "
        f"title={state['latest_claude_title']!r}"
    )
    return h


def acquire_lock() -> bool:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    lock = STATE_DIR / "watcher.pid"
    if lock.exists():
        try:
            old = int(lock.read_text(encoding="utf-8").strip())
            os.kill(old, 0)
            log(f"Already running (pid={old}); exiting")
            return False
        except (OSError, ValueError):
            pass
    lock.write_text(str(os.getpid()), encoding="utf-8")
    return True


def main() -> None:
    if not acquire_lock():
        return
    log(f"COMMS watcher started (python, pid={os.getpid()})")
    last_hash: str | None = None
    if STATE_FILE.exists():
        try:
            last_hash = json.loads(STATE_FILE.read_text(encoding="utf-8")).get("tail_hash")
        except json.JSONDecodeError:
            pass

    bootstrapped = False
    while True:
        try:
            if COMMS.exists():
                content = COMMS.read_text(encoding="utf-8-sig")
                h = tail_hash(content)
                force = not bootstrapped
                new_hash = write_state(content, h, force, last_hash)
                if new_hash != last_hash:
                    if bootstrapped:
                        log("CHANGE detected")
                    bootstrapped = True
                    last_hash = new_hash
            else:
                log(f"WARN missing {COMMS}")
        except Exception as exc:
            log(f"ERROR {exc}")
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()