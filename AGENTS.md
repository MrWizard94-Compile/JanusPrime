# JanusPrime project entry

The accepted `main` of
[WPAI Constitution](https://github.com/MrWizard94-Compile/Agents-Constitution)
is the single editable source of constitutional law. Use `wpai-constitution`:
freeze and verify one accepted commit, then read its SKILL, SOURCE manifest,
always-load set and applicable law from that same revision. Generated mirrors
are distributions, not independent authority. Do not vendor law in this project.

Janus product doctrine lives in [CLAUDE.md](CLAUDE.md), machine-loaded through
`doc:claude` and `janus://doctrine/claude`. It owns product contracts, not a
second constitution. Read [unified architecture](references/unified-architecture.md),
[handoff protocol](Project-Janus/docs/phase0/handoff-protocol.md), and
[executor instructions](EXECUTOR.md) before using those flows.

Preserve task-id and validation-receipt requirements on workload mutations.
Reading this entry does not authorize agent delegation, autonomous loops,
memory seeding, service startup, publishing or spending. Those commands below
are operational references, not a bootstrap script to run during governance QA.
Never overwrite an existing `.env` while following setup instructions.

Project code, configuration and tests define current behavior. Product role
names and historical roadmap claims are not evidence of live provider readiness.
See [governance adoption](docs/GOVERNANCE-ADOPTION.md) for this migration's scope,
preservation record and acceptance limits.

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