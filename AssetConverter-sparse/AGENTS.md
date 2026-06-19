# AGENTS.md — Asset Engine Bootstrap

**Janus doctrine:** Load **[../SOUL.md](../SOUL.md)** first — workspace single source of truth. Asset mutations must pass `asset-audit-v1` validation (SOUL §1, §5).

## Before Asset Work

1. Read `../SOUL.md` (`doc:soul`)
2. Read `docs/WORKFLOW.md` — Omni32 pipeline and git rules
3. Run `janus status` from `Project-Janus/` after build
4. Use `janus assets queue` / `janus assets audit <modId>` — prefer Janus CLI over raw `ac.py` when available

## Context Refs

Always include `doc:soul` on asset tasks. Typical refs: `arch:janus-unified`, `asset:mod:<id>`, `asset:action:audit|run`.