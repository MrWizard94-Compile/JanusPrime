# JanusPrime — Unified Autonomous Development System

**Version:** 1.0.0  
**Date:** 2026-06-19  
**Status:** Active integration

## Vision

JanusPrime is a fully autonomous, self-repairing, evolving end-to-end development and asset generation system. It merges three proven subsystems into one token-efficient pipeline where **nothing reaches disk without passing validation and self-review**.

## Component Map

| Component | Source Repo | Role |
|-----------|-------------|------|
| **Orchestrator Core** | Project-Janus (Aether) | Dual-AI task delegation, validation kernel, git worktrees |
| **Memory & Healing** | Smart-Library | Semantic retrieval, sandboxed execution, self-healing write-back |
| **Asset Engine** | AssetConverter (Omni32) | Texture pull → upscale → build pipeline |
| **Cognition (optional)** | REL Codex Variant | Session logging, neural learn, context load via REST bridge |

## Unified Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  JanusPrime Orchestrator (Claude)               │
│  Plans → Delegates → Reviews rollups → Owns large context       │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┬───────────────────┐
         ▼                   ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Executor (Grok) │ │ Memory Service  │ │ Asset Engine    │ │ Cognition (opt) │
│ Minimal briefs  │ │ Smart-Library   │ │ AssetConverter  │ │ REL REST bridge │
│ Validation gate │ │ /query /heal    │ │ ac.py pipeline  │ │ log_session     │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                     │                   │                   │
         └─────────────────────┼───────────────────┴───────────────────┘
                               ▼
                    ┌─────────────────────┐
                    │ Validation Kernel   │
                    │ LSP·AST·Rules·Build │
                    │ (deterministic gate)│
                    └─────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Git Worktrees +   │
                    │ Task Queue State  │
                    └─────────────────────┘
```

## Core Principles

1. **Validation before mutation** — All code and asset changes pass the deterministic validation kernel before persisting.
2. **Self-review before disk writes** — Executor receives validation errors + memory-retrieved fixes; retries until pass or abandon.
3. **Token efficiency** — Claude owns large context; executors get minimal briefs enriched with top-k memory slices only.
4. **Self-evolution** — Successful heals and accepted patches seed the memory store for future retrieval.
5. **Workload abstraction** — Code repos (FramedBlocks) and asset pipelines (Omni32) are workloads, not one-offs.

## Integration Flows

### Code Task Flow

```
1. aether orchestrate plan -f plan.json
2. janus brief -t <taskId>          # minimal brief + memory context slices
3. Grok produces patch
4. aether patch submit --apply
5. On failure → janus repair -t <id>  # structured errors + memory query
6. On accept → janus seed -t <id>     # write-back to memory
```

### Asset Task Flow

```
1. janus assets queue               # show Omni32 backlog
2. janus assets run <mod>           # pull → upscale → commit
3. janus assets audit <mod>         # pre-flight validation
4. janus assets build [--deploy]    # assemble resource pack
```

### Self-Healing Flow (Python snippets)

```
1. janus heal -f script.py          # Smart-Library /execute-heal
2. On heal success → auto-seed to memory
3. Future /query retrieves the fix pattern
```

## Configuration

Root config: `janus.config.json`

| Key | Purpose |
|-----|---------|
| `components.orchestrator.root` | Path to Project-Janus |
| `components.memory.url` | Smart-Library API base URL |
| `components.assets.root` | Path to AssetConverter-sparse |
| `components.cognition.*` | Optional REL REST bridge (`rest_url`, auth env vars, loop logging) |
| `self_repair.*` | Retry limits and seed policies |
| `token_policy.*` | Brief and context size caps |

## Service Topology

```bash
# Start memory service
docker compose up -d          # Smart-Library + Ollama

# Run orchestrator (from Project-Janus)
pnpm aether orchestrate run -t <parentId>

# Unified status
janus status
```

## Validation Profiles

| Profile | Layers | Use Case |
|---------|--------|----------|
| `neoforge-mixin-v1` | lsp, ast, rules, build | Java mixin workloads |
| `typescript-v1` | rules, build | JanusPrime workspace packages |
| `asset-audit-v1` | rules, build | AssetConverter texture audit |
| `python-sandbox-v1` | rules, build | Smart-Library heal verification |

## Directory Layout

```
JanusPrime/                     # Unified workspace root (repo: JanusPrime)
├── janus.config.json           # Root configuration
├── .aether/                    # Unified task queue + receipts
├── references/                 # Architecture + API docs
├── Project-Janus/              # Orchestrator monorepo (Aether)
├── Smart-Library/              # Memory + healing service
├── AssetConverter-sparse/      # Omni32 asset engine
├── workloads/                  # Registered workloads
│   ├── framedblocks/           # Code workload (in Project-Janus)
│   └── omni32/                 # Asset workload manifest
└── docker-compose.yml          # Service orchestration
```

## Token Efficiency Strategy

- **Orchestrator** maintains stable, cache-friendly context (architecture docs, domain rules).
- **Executor briefs** include only: objective, files_in_scope, constraints, last_validation_errors (capped), and ≤3 memory slices (≤2000 chars each).
- **Memory queries** use semantic search — no full doc dumps.
- **Validation feedback** is structured JSON with rule IDs, not prose.

## Roadmap

- [x] Phase 0: Clone and map all three repos
- [x] Phase 1: Unified config + integration package + CLI
- [x] Phase 2: MCP resources for memory + asset status
- [x] Phase 3: Autonomous loop (plan → execute → validate → seed → repeat)
- [x] Phase 3b: Omni32 workload + asset-audit validation profile
- [x] Phase 3c: AssetConverter sparse-checkout setup script
- [ ] Phase 4: Theia IDE integration (from Aether Phase 2)

## Autonomous Loop

```bash
aether orchestrate plan -f examples/orchestration/unified-janus-plan.example.json
janus loop run -t <parentTaskId>
```

The loop provisions children, executes identity/asset tasks through validation, prepares repair
context or executor briefs for manual tasks, seeds accepted patterns to memory, and repeats
until all children are accepted or max rounds exhausted.

## MCP Resources (JanusPrime extensions)

When `JANUS_ROOT` is set (or auto-discovered), the MCP server exposes:

| Resource | URI |
|----------|-----|
| System status | `janus://system/status` |
| Memory health | `janus://memory/health` |
| Asset queue | `janus://assets/queue` |
| Task brief | `janus://task/<id>/brief` |
| Repair context | `janus://task/<id>/repair` |
| REL state summary | `janus://rel/state-summary` (when cognition configured) |

Tools: `janus-memory-query`, `janus-repair-context`

CLI: `janus rel status`, `janus rel context -q <query>`

## Asset Workload Markers

Asset tasks require context refs:

- `asset:mod:<modId>` — target mod namespace
- `asset:action:audit` — pre-flight texture audit only
- `asset:action:run` — audit then run full upscale pipeline