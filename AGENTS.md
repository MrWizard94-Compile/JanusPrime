# AGENTS.md — JanusPrime Workspace Bootstrap

**Repository:** [github.com/MrWizard94-Compile/JanusPrime](https://github.com/MrWizard94-Compile/JanusPrime)

All agents operating in this workspace **must** load doctrine from **[SOUL.md](SOUL.md)** first. That file is the single source of truth.

## Before Any Work

1. Read `SOUL.md` — invariants, token policy, validation doctrine
2. Read `references/unified-architecture.md` — component map and flows
3. Run `janus status` from `Project-Janus/` after build
4. Run `janus doctrine seed` once per environment (memory bootstrap)

## Commands (prefer Janus over raw Aether)

| Intent | Command |
|--------|---------|
| System health | `janus status` |
| Executor brief (SOUL + memory) | `janus brief -t <taskId>` |
| Repair context | `janus repair -t <taskId>` |
| Autonomous loop | `janus loop run -t <parentId>` |
| Doctrine → memory | `janus doctrine seed` |
| Asset queue | `janus assets queue` |

Use `aether execute brief` only when Janus config is unavailable — it now auto-upgrades to unified brief when possible.

## Context Refs (always include `doc:soul`)

| Ref | Content |
|-----|---------|
| `doc:soul` | SOUL.md |
| `arch:janus-unified` | Unified architecture |
| `doc:handoff-protocol` | Validation gate protocol |

MCP resources: `janus://doctrine/soul`, `janus://task/<id>/brief`, `janus://task/<id>/repair`

## Component Roots

| Component | Path |
|-----------|------|
| Orchestrator | `Project-Janus/` |
| Memory | `Smart-Library/` |
| Assets | `AssetConverter-sparse/` |
| Config | `janus.config.json` |

## Subproject AGENTS

- Smart-Library: `Smart-Library/AGENTS.md` (memory service specifics)
- Project-Janus: `Project-Janus/AGENTS.md` (orchestrator bootstrap)
- AssetConverter: `AssetConverter-sparse/AGENTS.md` (Omni32 asset engine)