# AGENTS.md — Orchestrator Bootstrap

**Janus doctrine:** Load **[../CLAUDE.md](../CLAUDE.md)** first — workspace single source of truth.

## Before Orchestration Work

1. Read `../CLAUDE.md` (`doc:claude`)
2. Read `references/unified-architecture.md` (`arch:janus-unified`)
3. Run `janus status` and `janus doctrine seed` (once per environment)
4. Prefer `janus brief` / `janus loop run` over raw `aether execute brief`

## Context Refs

Always include `doc:claude` on parent and child tasks. See root `AGENTS.md` for full command table.