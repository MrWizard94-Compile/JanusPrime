# JanusPrime — System Overview

**Version:** 2.0.0 (documentation)  
**Date:** 2026-06-20  
**Repository:** [github.com/MrWizard94-Compile/JanusPrime](https://github.com/MrWizard94-Compile/JanusPrime)  
**Workspace root:** `C:\Projects\Janus` (canonical clone path; may vary per machine)

---

## Table of Contents

1. [What JanusPrime Is](#1-what-janusprime-is)
2. [What JanusPrime Does](#2-what-janusprime-does)
3. [What JanusPrime Does Not Do](#3-what-janusprime-does-not-do)
4. [Architecture](#4-architecture)
5. [Agent Roles and Responsibilities](#5-agent-roles-and-responsibilities)
6. [Core Principles and Invariants](#6-core-principles-and-invariants)
7. [Configuration](#7-configuration)
8. [How to Use JanusPrime](#8-how-to-use-janusprime)
9. [Workflows in Detail](#9-workflows-in-detail)
10. [Validation System](#10-validation-system)
11. [Workloads](#11-workloads)
12. [Memory and Self-Repair](#12-memory-and-self-repair)
13. [Asset Pipeline (Omni32)](#13-asset-pipeline-omni32)
14. [Cognition Layer (Optional REL Bridge)](#14-cognition-layer-optional-rel-bridge)
15. [MCP Integration](#15-mcp-integration)
16. [Observability and Operations](#16-observability-and-operations)
17. [Planned Improvements and Roadmap](#17-planned-improvements-and-roadmap)
18. [Directory Layout](#18-directory-layout)
19. [Further Reading](#19-further-reading)

---

## 1. What JanusPrime Is

**JanusPrime** is a unified, validation-gated autonomous development platform. It coordinates AI agents, deterministic quality gates, semantic memory, and asset-generation pipelines so that **no code, texture, or configuration change reaches disk without passing automated validation and self-review**.

JanusPrime is not a single application. It is an **integration layer** that merges three proven subsystems into one token-efficient pipeline:

| Subsystem | Path | Role |
|-----------|------|------|
| **Orchestrator** (Project-Janus / Aether) | `Project-Janus/` | Task delegation, validation kernel, git worktrees, CLI, MCP server |
| **Memory** (Smart-Library) | `Smart-Library/` | Semantic retrieval, sandboxed Python execution, verified heal write-back, doctrine storage |
| **Asset Engine** (AssetConverter / Omni32) | `AssetConverter-sparse/` (sparse checkout) + `C:/Projects/AssetConverter` (production) | Minecraft texture pull → upscale → resource-pack build |

An optional fourth layer, **REL Cognition** ([REL Codex Variant](https://github.com/MrWizard94-Compile/REL)), provides session logging, neural learning, and live context retrieval via a REST bridge.

### Design intent

JanusPrime exists to solve a specific problem: **AI agents that edit code directly are fast but unsafe**. Ungated agents dump context, ship placeholders, suppress warnings, and drift from project doctrine. JanusPrime constrains executors to minimal briefs, routes every mutation through a deterministic validation kernel, and seeds only verified successes back into memory so the system improves over time.

The name reflects the two-faced Roman god: one face plans and reviews (orchestrator); the other executes under strict gates (executor). Both operate on the same doctrine (`CLAUDE.md`) but with different context budgets.

### Doctrine

All agents, services, and validation rules derive from **`CLAUDE.md`** at the workspace root. This file is the single source of truth (`doc:claude`). Subproject copies of doctrine files are stubs only — they must not drift from the canonical root file.

---

## 2. What JanusPrime Does

### Orchestration and task management

- Creates **parent/child task hierarchies** from JSON delegation plans (`orchestrate plan`).
- Tracks task state in `.aether/tasks.json` (pending → in_progress → accepted/failed).
- Provisions **git worktrees** (or binds `local` worktrees to registered workload paths) per child task.
- Rolls up child status for parent tasks (`orchestrate status`).
- Runs **autonomous loops** that provision, execute, validate, repair, and seed until all children pass or max rounds exhaust (`janus loop run`).

### Validation-gated code mutation

- Accepts **patch proposals** as JSON (full file contents scoped to `files_in_scope`).
- Runs layered validation: **LSP** (JDT.LS for Java), **AST** (mixin structural analysis), **rules** (CLAUDE001–004 and profile-specific rules), **build** (Gradle, pnpm, pytest, or audit scripts).
- Writes **validation receipts** (SHA-256 hash of canonical patch) to `.aether/receipts/`.
- Applies patches only when validation passes (`patch submit --apply`).
- Reverts failed validation changes to scoped paths only (not whole-repo `git clean`).

### Token-efficient executor briefs

- Builds **capped briefs** for Grok executors: objective, files_in_scope, constraints, last validation errors (max 20), ≤3 memory slices (≤2,000 chars each), CLAUDE excerpt (≤4,000 chars), resolved context refs (≤3,000 chars total).
- Enforces `brief_max_chars` (default 12,000) on assembled output.
- Auto-injects `doc:claude` on every task create.
- Resolves context catalog refs (`arch:janus-unified`, `doc:handoff-protocol`, etc.) into embedded excerpts.

### Semantic memory and self-healing

- Seeds **CLAUDE.md** into Smart-Library on `janus doctrine seed` (once per environment).
- Seeds **accepted task patterns** and **verified heals** after successful validation.
- Seeds **validation repair patterns** via `/seed-repair` after post-accept fixes.
- Provides `janus repair` — structured validation errors plus memory-retrieved fix suggestions.
- Runs Python **heal sandbox** (`janus memory heal`) with Docker isolation and auto-seed on success.

### Asset generation (Omni32)

- Manages a **texture upscale queue** for Minecraft 1.20.1 Forge mods.
- Runs per-mod pipeline: audit → pull sources → upscale (xbrz, hq2x, waifu2x) → optional resource-pack build.
- Validates asset tasks under `asset-audit-v1` profile with rules A001–A003.

### Workload registry

- Registers all code repos under `workloads/registry.json` with validation profiles, local paths, and categories (base-wars, mc-mod, janus-internal, etc.).
- Supports **identity retrofit** — validating rogue work that landed outside the gate by listing every changed file in `files_in_scope`.

### MCP server surface

- Exposes doctrine, task briefs, repair context, system status, asset queue, and REL state as MCP resources.
- Provides `janus-memory-query` and `janus-repair-context` tools for IDE/agent integration.

### Optional cognition bridge

- Connects to REL REST API for session logging, loop outcome recording, steward concept sync into Smart-Library, and token-capped `doc:rel-state` excerpts for orchestrator tasks.

---

## 3. What JanusPrime Does Not Do

Understanding boundaries is as important as understanding capabilities.

### JanusPrime is not a general-purpose IDE

There is no built-in editor UI today. Agents use CLI, MCP, and external IDEs (Cursor, VS Code). **Phase 4 (Theia IDE)** is planned but not implemented.

### JanusPrime does not allow ungated filesystem mutation

Executors must not use direct file writes on workload repos, `mods/`, or instance `config/` without a task ID and validation receipt. Rogue edits require **retrofit orchestration** before they are considered canonical.

### JanusPrime does not dump full context to executors

Grok never receives full `CLAUDE.md` + full architecture + full memory dump in one payload. Orchestrator (Claude) owns large context; executors get `janus brief` output only.

### JanusPrime does not seed unverified work

Failed validations do not write to memory. First-attempt successes do not seed (only accepted tasks and verified heals/repairs seed). Unverified heals are anti-patterns.

### JanusPrime does not suppress warnings

Compiler warnings, LSP warnings, and deprecation warnings are **blocking failures**. The system does not accept `@ts-ignore`, `@SuppressWarnings`, or lint suppression as fixes.

### JanusPrime does not ship incomplete artifacts

No TODOs, FIXMEs, PLACEHOLDER, or "not implemented" stubs pass CLAUDE001. One-shot completeness is required.

### JanusPrime does not manage live game servers

It builds and deploys mod JARs and resource packs to configured instance paths, but it is not a Minecraft server orchestrator, modpack launcher, or CurseForge profile manager.

### JanusPrime does not replace Git workflow decisions

Worktrees isolate task branches, but merge strategy, PR creation, and release tagging remain human/orchestrator responsibilities. Graphite stacks and GitHub PR automation are external (skills like `/pr-babysit` may assist but are not core JanusPrime).

### JanusPrime does not guarantee cloud-scale deployment

Docker Compose runs memory + Ollama + REL locally. There is no production Kubernetes chart, metrics endpoint, or multi-tenant SaaS layer yet (metrics endpoint is a documented placeholder).

### JanusPrime does not auto-fix without validation

`claude-auto-fix` assists manual-patch retries inside the loop, but auto-fix output still passes through the same validation kernel before apply.

### REL cognition is not required

The system runs fully without REL. Cognition enhances loop logging and orchestrator context but is optional.

---

## 4. Architecture

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
                    │ LSP · AST · Rules   │
                    │ · Build (determin.) │
                    └─────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Git Worktrees +     │
                    │ Task Queue (.aether)│
                    └─────────────────────┘
```

### Package map (Project-Janus monorepo)

| Package | Responsibility |
|---------|----------------|
| `@aether/cli` | Commander-based CLI (`aether` + `janus` namespaces) |
| `@aether/orchestrator` | Plan creation, child provisioning, rollup, identity-patch runs |
| `@aether/task-queue` | Task CRUD, state transitions, `.aether/tasks.json` persistence |
| `@aether/validation-kernel` | Layer runners, handoff service, receipt management |
| `@aether/shared` | Task schemas, validation profiles, patch proposal types |
| `@janus/integrations` | Unified briefs, autonomous loop, memory/asset/REL clients |
| `@aether/mcp-server` | MCP resources and tools for IDE agents |

### Self-repair contract

```
Plan → Provision → Execute → Validate → [fail → Repair context → Retry] → Accept → Seed memory
```

---

## 5. Agent Roles and Responsibilities

| Role | Assignee | Context budget | Responsibilities |
|------|----------|----------------|------------------|
| **Orchestrator** | Claude | Large (architecture, doctrine, REL state, rollups) | Decompose work, author delegation plans, review child outcomes, create tasks, decide abandon/retry |
| **Executor** | Grok | Minimal (`janus brief` only) | Implement patches, submit through gate, deploy artifacts when task spec requires |
| **Memory** | Smart-Library (service) | N/A (retrieval capped per query) | Semantic search, heal verification, doctrine storage |
| **Asset Engine** | AssetConverter (scripts) | Task-scoped mod context | Texture audit, upscale, pack build |

**Executor pre-flight:** Grok must read `EXECUTOR.md` before any mutation. No task ID → no coding.

**Persona (Corwin):** Sharp, peer-to-peer, no fluff. Fix problems; challenge weak architecture. Defined in `CLAUDE.md` §0.

---

## 6. Core Principles and Invariants

From `CLAUDE.md` §1 — non-negotiable for every mutation (code, assets, memory, disk):

1. **Validation before mutation**
2. **Self-review before write** (validation errors + memory fixes → retry)
3. **Token efficiency** (orchestrator owns large context)
4. **Self-evolution** (verified heals and accepted tasks seed memory)
5. **Research over guesswork** (read docs before assuming API behavior)
6. **One-shot completeness** (no stubs or deferred implementation)
7. **Zero-tolerance for warnings** (fix root cause; never suppress)
8. **Security and defensive mindset** (untrusted input, config, network)

### Anti-patterns (do not do these)

- Shipping without validation gate
- Dumping full context to executors
- Seeding unverified heals
- Duplicate `CLAUDE.md` copies that can drift
- Suppressing warnings instead of fixing
- Placeholder code in patch proposals
- Direct writes to workload repos outside the gate

---

## 7. Configuration

Root config: **`janus.config.json`**

| Key | Purpose |
|-----|---------|
| `components.orchestrator.root` | Path to Project-Janus (`Project-Janus`) |
| `components.orchestrator.state_dir` | Runtime state directory (`.aether`) |
| `components.memory.url` | Smart-Library API (`http://localhost:8000`) |
| `components.memory.api_key_env` | Env var for write endpoint auth |
| `components.memory.context_limit` | Max memory slices per brief (default 3) |
| `components.assets.root` | Path to AssetConverter production checkout |
| `components.assets.entry` | Pipeline entry script (`ac.py`) |
| `components.cognition.*` | Optional REL REST bridge settings |
| `self_repair.max_validation_retries` | Max retry rounds (default 5) |
| `self_repair.seed_on_accept` | Seed accepted tasks to memory (default true) |
| `self_repair.seed_on_heal` | Seed verified heals (default true) |
| `token_policy.*` | Brief, slice, and error caps |
| `doctrine.claude_path` | Doctrine file path (`CLAUDE.md`) |
| `doctrine.brief_excerpt_max_chars` | CLAUDE excerpt in briefs (4000) |

### Environment

Copy `.env.example` → `.env` and set:

- `REL_COGNITION_ROOT` or `REL_BUILD_CONTEXT` — path to REL checkout (if using cognition)
- `JANUS_MEMORY_API_KEY` — Smart-Library write auth (if enabled)
- `JANUS_REL_API_KEY` / `JANUS_REL_BEARER_TOKEN` — REL auth (if required)

### Workload registry

`workloads/registry.json` maps workload IDs to local paths, validation profiles, and categories. Sync manifests via:

```powershell
node Project-Janus/scripts/sync-workload-manifests.mjs
```

---

## 8. How to Use JanusPrime

### Initial setup

```powershell
# 1. Clone JanusPrime
cd C:\Projects\Janus

# 2. Install orchestrator dependencies
cd Project-Janus
pnpm install
pnpm build

# 3. Start services (memory + optional cognition + Ollama)
cd ..
copy .env.example .env
docker compose up -d

# 4. Bootstrap doctrine into memory (once per environment)
node Project-Janus\packages\cli\dist\bin.js doctrine seed

# 5. Verify health
node Project-Janus\packages\cli\dist\bin.js status
```

### Canonical CLI

Prefer the workspace shim or explicit node path (global `janus` npm shim may be stale):

```powershell
# From JanusPrime root
.\scripts\janus.ps1 status

# Or set once per session
$env:JANUS_CLI = "node C:\Projects\Janus\Project-Janus\packages\cli\dist\bin.js"
& $env:JANUS_CLI status
```

### Command reference

#### System health and doctrine

| Command | Purpose |
|---------|---------|
| `janus status` | Unified health: memory, cognition, assets, task counts |
| `janus doctrine seed` | Bootstrap CLAUDE.md into Smart-Library |
| `janus doctrine status` | Compare CLAUDE hash vs memory; exit 1 if stale |
| `janus doctrine status --reseed` | Re-seed when stale |

#### Executor surface

| Command | Purpose |
|---------|---------|
| `janus brief -t <taskId>` | Token-efficient executor brief JSON |
| `janus repair -t <taskId>` | Validation errors + memory fix retrieval |
| `janus seed -t <taskId>` | Seed accepted task pattern to memory |

#### Orchestration (Aether namespace)

| Command | Purpose |
|---------|---------|
| `orchestrate plan -f <plan.json>` | Create parent + child tasks from delegation plan |
| `orchestrate provision -t <parentId>` | Provision worktrees for children |
| `orchestrate status -t <parentId>` | Roll up child statuses |
| `orchestrate run -t <parentId>` | Run identity-patch children through gate |

#### Patch gate

| Command | Purpose |
|---------|---------|
| `patch submit -f patch.json` | Dry-run validate patch proposal |
| `patch submit -f patch.json --apply` | Validate and apply; transition to accepted |
| `patch apply -f patch.json` | Apply with existing receipt |

#### Autonomous loop

| Command | Purpose |
|---------|---------|
| `janus loop run -t <parentId>` | Plan→execute→validate→seed until complete |
| `janus loop run -t <parentId> --max-rounds 10` | Custom retry cap |
| `janus loop run -t <parentId> --no-seed` | Skip memory seeding |

#### Memory

| Command | Purpose |
|---------|---------|
| `janus memory health` | Smart-Library health check |
| `janus memory query -q "<text>"` | Semantic memory search |
| `janus memory heal -f script.py` | Sandboxed Python heal + auto-seed |

#### Assets (Omni32)

| Command | Purpose |
|---------|---------|
| `janus assets queue` | Show texture processing backlog |
| `janus assets audit <modId>` | Pre-flight texture audit |
| `janus assets run <modId> [--method xbrz] [--build]` | Full upscale pipeline |
| `janus assets build [--deploy]` | Assemble resource pack |

#### Cognition (optional)

| Command | Purpose |
|---------|---------|
| `janus rel status` | REL reachability and state summary |
| `janus rel sync [-q "<query>"]` | Sync steward concepts to Smart-Library |
| `janus rel context -q "<query>"` | Load REL context for orchestrator queries |

#### Task and worktree management

| Command | Purpose |
|---------|---------|
| `task create` / `task list` / `task show` | Task CRUD |
| `worktree create -t <id> --workload <name>` | Provision isolated worktree |
| `worktree prepare -t <id>` | Build dependencies in worktree |
| `context resolve -t <id>` | Resolve context refs for a task |
| `context catalog` | List available context refs |

---

## 9. Workflows in Detail

### A. Standard code task (manual patch)

Used for Forge mods, TypeScript packages, and any workload requiring Grok implementation.

```
1. Orchestrator authors plan JSON → orchestrate plan -f plan.json
2. orchestrate provision -t <parentId>        # bind worktrees
3. Executor: janus brief -t <childId>         # load scoped brief
4. Executor implements; writes patch.json     # full file contents
5. patch submit -f patch.json                 # dry-run validate
6. On fail: janus repair -t <childId> → revise → resubmit
7. patch submit -f patch.json --apply         # apply with receipt
8. janus seed -t <childId>                    # seed accepted pattern
9. Deploy artifacts if acceptance criteria require (JAR, etc.)
10. Orchestrator: orchestrate status -t <parentId>
```

**Patch proposal format:**

```json
{
  "task_id": "task-<uuid>",
  "allow_overwrite": true,
  "files": [
    { "path": "src/.../MyClass.java", "content": "full file content" }
  ]
}
```

### B. Identity retrofit (rogue work already on disk)

When code landed outside the gate:

```
1. Orchestrator lists every changed file in files_in_scope
2. orchestrate plan -f retrofit-plan.json
3. orchestrate run -t <parentId>              # identity validation
4. janus seed -t <childId> per accepted child
```

### C. Autonomous loop

For batch work with mixed identity and manual children:

```powershell
orchestrate plan -f examples/orchestration/unified-janus-plan.example.json
janus loop run -t <parentTaskId>
```

The loop:

- Provisions children missing worktrees
- Runs identity/asset/python-sandbox executors automatically
- Prepares briefs for manual-patch children
- Applies claude-auto-fix on validation failures (up to max rounds)
- Seeds accepted patterns
- Logs outcomes to REL when configured

### D. Asset task

```
1. Task created with context refs: asset:mod:<modId>, asset:action:run
2. janus assets audit <modId>                 # pre-flight
3. janus assets run <modId> --build           # pull → upscale → pack
4. Validation under asset-audit-v1
5. Deploy pack to instance per orchestrator pack task
```

### E. Python heal

```
1. janus memory heal -f broken_script.py
2. Smart-Library sandbox executes + LLM repair loop
3. On verified success → auto-seed as Self-Healing Patch
4. Future janus memory query retrieves fix pattern
```

### F. Delegation plan structure

```json
{
  "parent": {
    "assignee": "claude",
    "validation_profile": "typescript-v1",
    "context_refs": ["doc:claude", "arch:janus-unified", "doc:handoff-protocol"],
    "spec": { "objective": "...", "acceptance_criteria": ["..."] }
  },
  "children": [
    {
      "assignee": "grok",
      "patch_mode": "manual",
      "task": {
        "workload": "nodecore",
        "validation_profile": "forge-mod-v1",
        "spec": {
          "files_in_scope": ["src/..."],
          "acceptance_criteria": ["gradlew build exits 0"]
        }
      }
    }
  ],
  "provision": { "auto_worktree": true, "auto_prepare": true }
}
```

`patch_mode` values: `manual` (Grok submits patches), `identity` (validate existing files).

---

## 10. Validation System

### Layers

| Layer | Purpose | When active |
|-------|---------|-------------|
| `lsp` | JDT.LS diagnostics | Java workloads with JDTLS configured |
| `ast` | Mixin structural analysis | `neoforge-mixin-v1` |
| `rules` | CLAUDE001–004 + profile rules | All profiles |
| `build` | Profile build command | All profiles except dry-run |

### Profiles

| Profile | Layers | Build command | Use case |
|---------|--------|---------------|----------|
| `neoforge-mixin-v1` | lsp, ast, rules, build | `./gradlew compileJava` | NeoForge mixin mods |
| `forge-mod-v1` | lsp, rules, build | `./gradlew build` | Forge mods (Node Core, Omni32 Loader) |
| `typescript-v1` | rules, build | `pnpm typecheck` | JanusPrime monorepo packages |
| `asset-audit-v1` | rules, build | `python pipeline/audit_mod.py` | Omni32 texture audit |
| `python-sandbox-v1` | rules, build | `python -m pytest tests/ -q` | Smart-Library |

### CLAUDE rules (cross-profile)

| Rule ID | Enforcement |
|---------|-------------|
| CLAUDE001 | No TODO/FIXME/PLACEHOLDER/not implemented |
| CLAUDE002 | No @ts-ignore / @SuppressWarnings |
| CLAUDE003 | No hardcoded secrets |
| CLAUDE004 | No eval(), new Function(), child_process in patches |
| TS001–TS002 | TypeScript scope, no `any` |
| A001–A003 | Asset task markers and pipeline |
| B001 | Build/audit command must pass |
| LSP | Warnings treated as errors |

### Receipts

Passing validation writes `.aether/receipts/<task-id>.json`. Apply refuses patches whose hash does not match the receipt.

---

## 11. Workloads

Workloads are registered repositories — not one-off folders. Each has a validation profile and `local_root` path.

### Active Base Wars workloads (examples)

| ID | Path | Profile |
|----|------|---------|
| `nodecore` | `C:/Projects/Node Core` | `forge-mod-v1` |
| `omni32-loader` | `C:/Projects/Omni32_Loader` | `forge-mod-v1` |
| `omni32` | `C:/Projects/AssetConverter` | `asset-audit-v1` |
| `vs2-ship-systems` | `C:/Projects/VS2 Ship Systems` | `neoforge-mixin-v1` |
| `valkyrien-portals` | `C:/Projects/Valkyrien Portals` | `neoforge-mixin-v1` |

### Janus-internal workloads

| ID | Path | Profile |
|----|------|---------|
| `janus-orchestrator` | `Project-Janus` | `typescript-v1` |
| `janus-memory` | `Smart-Library` | `python-sandbox-v1` |

Instance config overrides (CurseForge `config/`, `mods/`) are **reference-only** under `packs/base-wars-instance-overrides/`. Deploy via orchestrator pack tasks, not direct executor writes.

---

## 12. Memory and Self-Repair

### Smart-Library endpoints (key)

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Service health |
| `POST /query` | Semantic retrieval |
| `POST /seed` | Index content (doctrine, accepted patterns) |
| `POST /execute-heal` | Sandboxed Python repair |
| `POST /seed-repair` | Validation repair pattern write-back |
| `POST /maintenance/deduplicate` | Manual doctrine dedup |

### Seed policy

| Event | Seeds? | Category |
|-------|--------|----------|
| CLAUDE bootstrap | Yes (once) | Operational Doctrine |
| Accepted task | Yes | Accepted Task Pattern |
| Verified heal (after retry) | Yes | Self-Healing Patch |
| Validation repair (post-accept) | Yes | Validation Repair Pattern |
| First-attempt success | No | — |
| Failed validation | No | Repair context in `task.result` |

### Token caps for memory in briefs

- 3 slices max (`memory.context_limit`)
- 2,000 chars per slice (`token_policy.memory_slice_max_chars`)
- LLM fallback for query gated off by default (`allow_query_llm_fallback: false`)

---

## 13. Asset Pipeline (Omni32)

Omni32 upscales Minecraft mod textures to 32× for the Base Wars Forge 1.20.1 instance.

### Pipeline stages

1. **Audit** — verify source textures, namespace mapping, policy compliance
2. **Pull** — extract textures from mod JARs
3. **Upscale** — xbrz (default), hq2x, or waifu2x
4. **Build** — assemble Omni32 resource pack
5. **Deploy** — copy to instance via orchestrator task (not ad-hoc)

### Sparse checkout

`AssetConverter-sparse/` in the JanusPrime repo is a sparse checkout scaffold. Production pipeline runs at `C:/Projects/AssetConverter`. Setup:

```powershell
pnpm assets:setup
# or scripts/setup-assetconverter.ps1
```

### Asset task context refs

- `asset:mod:<modId>` — target mod namespace
- `asset:action:audit` — audit only
- `asset:action:run` — full pipeline

---

## 14. Cognition Layer (Optional REL Bridge)

When `components.cognition` is configured and REL is running:

- Autonomous loop logs outcomes (`log_loop_outcomes`)
- Steward/neural-web concepts sync to Smart-Library on loop completion (`sync_concepts_to_memory`)
- Orchestrator tasks may include `doc:rel-state` (live REL excerpt, orchestrator-only — never in Grok briefs)
- MCP exposes `janus://rel/state-summary`

REL runs as `cognition` service in `docker-compose.yml` (port 8080), sharing the stack Ollama instance.

```powershell
janus rel status
janus rel sync
janus rel context -q "validation repair patterns for mixin tasks"
```

---

## 15. MCP Integration

Set `JANUS_ROOT` (or auto-discover from cwd). The MCP server (`@aether/mcp-server`) exposes:

| Resource | URI |
|----------|-----|
| System status | `janus://system/status` |
| Memory health | `janus://memory/health` |
| Asset queue | `janus://assets/queue` |
| Doctrine | `janus://doctrine/claude` |
| Task brief | `janus://task/<id>/brief` |
| Repair context | `janus://task/<id>/repair` |
| REL state | `janus://rel/state-summary` |

**Tools:** `janus-memory-query`, `janus-repair-context`

Bind `AETHER_TASK_ID` to scope MCP to a single task in IDE sessions.

---

## 16. Observability and Operations

### Docker logs

```powershell
docker compose logs -f memory cognition ollama
docker compose logs cognition --no-log-prefix | jq .
```

### Health probes

```powershell
# From Project-Janus
pnpm run e2e:services    # memory + cognition + janus status
pnpm run e2e:sandbox     # /execute-heal sandbox probe
pnpm run e2e:orchestration
```

### CI

Root `.github/workflows/ci.yml` runs Project-Janus build+test and Smart-Library pytest.

### Future

Metrics endpoint is documented as a placeholder in `references/observability.md` — not implemented.

---

## 17. Planned Improvements and Roadmap

### Completed (Phase 0–3)

- [x] Phase 0: Clone and map all three repos; handoff protocol
- [x] Phase 1: Unified config + `@janus/integrations` + CLI
- [x] Phase 2: MCP resources for memory + asset status
- [x] Phase 3: Autonomous loop (plan → execute → validate → seed → repeat)
- [x] Phase 3b: Omni32 workload + `asset-audit-v1` profile
- [x] Phase 3c: AssetConverter sparse-checkout setup script
- [x] Autonomous manual-patch loop with claude-auto-fix
- [x] `POST /seed-repair` validation repair patterns
- [x] CLAUDE003 (secrets) + CLAUDE004 (eval/child_process) rules
- [x] Resolved `context_refs` embedded in briefs
- [x] Auto-inject `doc:claude` on task create
- [x] Doctrine freshness check (`janus doctrine status`)
- [x] REL cognition bridge + `doc:rel-state` + steward concept sync
- [x] REL in docker-compose as cognition service
- [x] `forge-mod-v1` profile for Base Wars Forge mods
- [x] Workload registry for all `C:/Projects` repos
- [x] Audit remediation (2026-06-19) — 131+ tests passing

### In progress / near-term

- [ ] Workload picker UX spec (pre-Theia)
- [ ] Scheduled doctrine dedup automation (manual via `/maintenance/deduplicate` today)
- [ ] CLI `JANUS_LOG_LEVEL` verbosity support
- [ ] Metrics endpoint for production observability

### Phase 4 — Theia IDE (deferred)

Architecture scaffold: `references/phase4-theia-ide.md`

| Component | Description |
|-----------|-------------|
| **Ghost Buffer** | Orchestrator staging UI — proposals visible before disk write |
| **Phantom Cursor** | Executor ghost edits held until validation passes |
| **Validation Dashboard** | Live rule results, receipts, repair context, loop rollup |
| **Workload picker** | Open project → bind `AETHER_TASK_ID` → `janus loop run` |

**Prerequisites remaining:**

- [ ] Theia fork / product template repository
- [ ] UX spec for Ghost Buffer ↔ Phantom Cursor handoff
- [ ] Workload picker implementation
- [ ] Theia AI provider wiring (Claude vs Grok role separation)

Phase 4 wraps existing CLI/MCP contracts — it does not change CLAUDE invariants.

### Longer-term evolutions (from CLAUDE §10 and audit notes)

- Embedded terminal complementing (not replacing) `janus` CLI
- LSP proxy hardening beyond current JDTLS worktree integration
- Graphite/GitHub stacked PR automation integration
- Multi-environment config profiles (dev/staging/prod instance targets)
- Automated instance deploy tasks for CurseForge profiles

---

## 18. Directory Layout

```
JanusPrime/                          # Workspace root (C:\Projects\Janus)
├── janus.config.json                # Unified configuration
├── CLAUDE.md                        # Canonical doctrine (single source of truth)
├── AGENTS.md                        # Agent bootstrap checklist
├── EXECUTOR.md                      # Grok pre-flight gate
├── README.md                        # Quick start
├── JanusPrime-Overview.md           # This document
├── docker-compose.yml               # memory + cognition + ollama
├── scripts/
│   └── janus.ps1                    # CLI shim
├── references/                      # Architecture, observability, Phase 4 scaffold
├── packs/                           # Instance override templates (reference-only)
├── workloads/
│   └── registry.json                # All registered code/asset workloads
├── Project-Janus/                   # Orchestrator monorepo
│   ├── .aether/                     # Task queue, receipts, runtime config
│   ├── packages/
│   │   ├── cli/                     # aether + janus commands
│   │   ├── orchestrator/
│   │   ├── task-queue/
│   │   ├── validation-kernel/
│   │   ├── janus-integrations/
│   │   ├── mcp-server/
│   │   └── shared/
│   ├── examples/
│   │   └── orchestration/           # Delegation plan JSON templates
│   └── docs/phase0/
│       └── handoff-protocol.md
├── Smart-Library/                   # Memory + heal service
│   └── smart_code_lib/
├── AssetConverter-sparse/           # Sparse checkout scaffold
└── agent-tools/                     # Staged patches and task artifacts
```

---

## 19. Further Reading

| Document | Content |
|----------|---------|
| [CLAUDE.md](CLAUDE.md) | Canonical doctrine, invariants, roadmap |
| [AGENTS.md](AGENTS.md) | Agent bootstrap and command quick reference |
| [EXECUTOR.md](EXECUTOR.md) | Grok mutation gate and retrofit pattern |
| [references/unified-architecture.md](references/unified-architecture.md) | Component map and integration flows |
| [Project-Janus/docs/phase0/handoff-protocol.md](Project-Janus/docs/phase0/handoff-protocol.md) | Validation gate handoff |
| [references/phase4-theia-ide.md](references/phase4-theia-ide.md) | Phase 4 IDE architecture (deferred) |
| [references/observability.md](references/observability.md) | Logs, health probes, future metrics |
| [references/audit-remediation-todo.md](references/audit-remediation-todo.md) | Audit remediation status |
| [workloads/registry.json](workloads/registry.json) | Registered workload paths and profiles |

---

*This document describes JanusPrime as of 2026-06-20. For machine-loaded doctrine, always prefer `CLAUDE.md` and `janus://doctrine/claude`.*