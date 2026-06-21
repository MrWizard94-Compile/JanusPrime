# AGENTS.md — JanusPrime Workspace Bootstrap

**Repository:** [github.com/MrWizard94-Compile/JanusPrime](https://github.com/MrWizard94-Compile/JanusPrime)

All agents operating in this workspace **must** load doctrine from **[CLAUDE.md](CLAUDE.md)** first. That file is the single source of truth.

**Grok (Executor):** Also read **[EXECUTOR.md](EXECUTOR.md)** — pre-flight gate and mutation rules. Cursor rule: `.cursor/rules/janus-executor.mdc`.

## Before Any Work

1. Read `CLAUDE.md` — invariants, token policy, validation doctrine
2. Read `references/unified-architecture.md` — component map and flows
3. Read `Project-Janus/docs/phase0/handoff-protocol.md` — validation gate (`doc:handoff-protocol`)
4. **Grok:** Read `EXECUTOR.md` — no workload mutation without task id + validation receipt
5. Copy `.env.example` → `.env` and set `REL_COGNITION_ROOT` (or `REL_BUILD_CONTEXT`) for cognition paths
6. Run `scripts/janus.ps1 status` (or `node Project-Janus/packages/cli/dist/bin.js status`) after build
7. Run `janus doctrine seed` once per environment (memory bootstrap)

## Commands (prefer Janus over raw Aether)

Canonical CLI (global `janus` npm shim may be stale):

```powershell
.\scripts\janus.ps1 <subcommand>    # from JanusPrime root
# or: node Project-Janus/packages/cli/dist/bin.js <subcommand>
```

| Intent | Command |
|--------|---------|
| System health | `scripts/janus.ps1 status` |
| Doctrine freshness | `scripts/janus.ps1 doctrine status` |
| Executor brief (CLAUDE + memory) | `scripts/janus.ps1 brief -t <taskId>` |
| Repair context | `scripts/janus.ps1 repair -t <taskId>` |
| Autonomous loop | `scripts/janus.ps1 loop run -t <parentId>` |
| Doctrine → memory | `scripts/janus.ps1 doctrine seed` |
| Seed accepted task | `scripts/janus.ps1 seed -t <taskId>` |
| Asset queue | `scripts/janus.ps1 assets queue` |
| Orchestration | `node Project-Janus/packages/cli/dist/bin.js orchestrate plan -f <plan.json>` |

Use `aether execute brief` only when Janus config is unavailable — it now auto-upgrades to unified brief when possible.

## Context Refs (always include `doc:claude`)

| Ref | Content |
|-----|---------|
| `doc:claude` | CLAUDE.md |
| `doc:rel-state` | Live REL state (orchestrator/Claude only) |
| `arch:janus-unified` | Unified architecture |
| `doc:handoff-protocol` | `Project-Janus/docs/phase0/handoff-protocol.md` |

MCP resources: `janus://doctrine/claude`, `janus://task/<id>/brief`, `janus://task/<id>/repair`

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