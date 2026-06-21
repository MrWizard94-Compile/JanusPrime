# AGENTS.md — Asset Engine Bootstrap

**Janus doctrine:** Load **[../CLAUDE.md](../CLAUDE.md)** first — workspace single source of truth. Asset mutations must pass `asset-audit-v1` validation (CLAUDE §1, §5).

## Before Asset Work

1. Read `../CLAUDE.md` (`doc:claude`)
2. Read `docs/WORKFLOW.md` — Omni32 pipeline and git rules
3. Run `janus status` from `Project-Janus/` after build
4. Use `janus assets queue` / `janus assets audit <modId>` — prefer Janus CLI over raw `ac.py` when available

## Context Refs

Always include `doc:claude` on asset tasks. Typical refs: `arch:janus-unified`, `asset:mod:<id>`, `asset:action:audit|run`.