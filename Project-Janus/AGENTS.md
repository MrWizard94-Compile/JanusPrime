# AGENTS.md — Orchestrator Bootstrap

**Janus doctrine:** Load **[../SOUL.md](../SOUL.md)** first — workspace single source of truth.

## Before Orchestration Work

1. Read `../SOUL.md` (`doc:soul`)
2. Read `references/unified-architecture.md` (`arch:janus-unified`)
3. Run `janus status` and `janus doctrine seed` (once per environment)
4. Prefer `janus brief` / `janus loop run` over raw `aether execute brief`

## Context Refs

Always include `doc:soul` on parent and child tasks. See root `AGENTS.md` for full command table.