# JanusPrime — User Guide

**Practical, day-to-day operating manual.** For architecture and design rationale, see [`JanusPrime-Overview.md`](JanusPrime-Overview.md). For machine doctrine, see [`CLAUDE.md`](CLAUDE.md).

**Workspace root:** `C:\Projects\Janus`
**Last verified:** 2026-06-21 (stack live, all components green)

---

## 0. The 30-Second Mental Model

JanusPrime is one system made of four cooperating parts:

| Part | What it is | Where | Port |
|------|-----------|-------|------|
| **Orchestrator** | The `janus` CLI + task queue + validation gate (Project-Janus / Aether) | `C:\Projects\Janus\Project-Janus` | — |
| **Memory** | Smart-Library — semantic search + sandboxed heal | `C:\Projects\Janus\Smart-Library` | `8000` |
| **Cognition** | REL — session state, neural web, live context | `C:\Projects\REL_Codex_Variant` | `8080` |
| **Assets** | AssetConverter / Omni32 texture pipeline | `C:\Projects\AssetConverter` | — |
| **LLM** | Ollama running `qwen2.5-coder:7b` (shared by Memory + REL) | Docker | `11434` |

Three of these (Memory, Cognition, Ollama) run as Docker containers. The Orchestrator runs on the host as a Node CLI. Assets run as host Python invoked by the CLI.

**Golden rule:** Nothing reaches disk or memory without passing the validation gate. You drive the system through the `janus` CLI.

---

## 1. Running the CLI

The CLI **must be run from inside the workspace** (`C:\Projects\Janus` or any subdirectory) — it walks *up* the tree to find `janus.config.json`. Running it from `C:\Projects` fails with "Could not find janus.config.json".

Three equivalent ways to invoke it, in order of convenience:

```powershell
# 1. Global command (shim fixed 2026-06-21 — works from anywhere inside the workspace)
janus status

# 2. Workspace shim (always correct, survives npm reinstalls)
.\scripts\janus.ps1 status

# 3. Direct node (the ground truth the others wrap)
node C:\Projects\Janus\Project-Janus\packages\cli\dist\bin.js status
```

> The global `janus` shim lives at `C:\Users\Bulkl\AppData\Roaming\npm\janus{,.cmd,.ps1}` and points at `Project-Janus\packages\cli\dist\bin.js`. If you ever move the workspace, repoint those three files or use the workspace shim instead.

This guide writes every command as `janus <cmd>`. All commands also work with the explicit `janus janus <cmd>` namespace form if you hit an ambiguity.

---

## 2. First-Time Setup (already done on this machine)

You only do this once per machine. It's recorded here for rebuilds / new environments.

```powershell
# 1. Build the orchestrator
cd C:\Projects\Janus\Project-Janus
pnpm install
pnpm build

# 2. Configure environment (secrets + paths)
cd C:\Projects\Janus
copy .env.example .env
#   then edit .env — see §6

# 3. Start the Docker stack (memory + cognition + ollama)
docker compose up -d

# 4. Pull the shared model (once — persists in the ollama_data volume)
docker exec janusprime-ollama ollama pull qwen2.5-coder:7b

# 5. Seed doctrine into memory (once per environment)
janus doctrine seed

# 6. Verify
janus status
```

---

## 3. Daily Operations

### Start / stop the stack

```powershell
cd C:\Projects\Janus

docker compose up -d              # start all (memory, cognition, ollama)
docker compose stop              # stop without removing
docker compose down              # stop + remove containers (volumes persist)
docker compose restart cognition # bounce one service
```

### Health checks

```powershell
janus status                     # unified: memory, cognition, assets, task counts
janus memory health              # Smart-Library only
janus rel status                 # REL cognition only (reachability + live state)
janus doctor                     # validation-gate infra: LSP, build scripts, pnpm, profiles
docker ps                        # container health column
```

A healthy `janus status` looks like:

```
memory=ok  cognition=reachable  assets=queue_available  tasks=<n>
```

### Logs

```powershell
docker compose logs -f cognition memory ollama     # follow all three
docker logs --tail 50 janusprime-cognition         # one container
```

### Rebuild a service after code changes

Cognition (REL) builds from `C:\Projects\REL_Codex_Variant`; Memory builds from `Smart-Library/`. After editing their source:

```powershell
docker compose up -d --build cognition     # rebuild + recreate REL
docker compose up -d --build memory        # rebuild + recreate Smart-Library
```

---

## 4. Command Cheat Sheet

Every command below is verified against the current build.

### System & doctrine

| Command | Purpose |
|---------|---------|
| `janus status` | Unified health + task counts |
| `janus doctor` | Pre-flight the validation gate's own infra |
| `janus doctrine seed` | Bootstrap `CLAUDE.md` into memory (once) |
| `janus doctrine status` | Compare `CLAUDE.md` hash vs stored doctrine |

### Executor surface (token-efficient briefs)

| Command | Purpose |
|---------|---------|
| `janus brief -t <taskId>` | Build a capped executor brief (objective, scope, ≤3 memory slices, doctrine excerpt) |
| `janus repair -t <taskId>` | Validation errors + memory-retrieved fixes |
| `janus seed -t <taskId>` | Seed an accepted task pattern into memory |

### Autonomous loop

| Command | Purpose |
|---------|---------|
| `janus loop run -t <parentId>` | Plan → execute → validate → repair → seed until done |
| `janus loop run -t <parentId> --max-rounds 10` | Custom retry cap |
| `janus loop run -t <parentId> --no-seed` | Skip memory seeding |

### Memory (Smart-Library)

| Command | Purpose |
|---------|---------|
| `janus memory health` | Service health |
| `janus memory query -q "<text>"` | Semantic search |
| `janus memory heal -f <script.py>` | Sandboxed Python execute + LLM self-heal + auto-seed on success |

### Cognition (REL)

| Command | Purpose |
|---------|---------|
| `janus rel status` | Reachability + live state summary |
| `janus rel context -q "<query>"` | Load REL context for a query (token-capped) |
| `janus rel sync [-q "<query>"]` | Push REL steward/neural-web concepts into Smart-Library |

### Assets (Omni32)

| Command | Purpose |
|---------|---------|
| `janus assets queue` | Show texture-processing backlog |
| `janus assets stats` | Asset engine dashboard |
| `janus assets audit <modId>` | Pre-flight texture audit |
| `janus assets run <modId> [--method xbrz] [--build]` | Full pull → upscale → (build) pipeline |
| `janus assets build [--deploy]` | Assemble (and optionally deploy) the resource pack |

### Orchestration & tasks (Aether namespace — top-level commands)

| Command | Purpose |
|---------|---------|
| `task create` / `task list` / `task show` | Task CRUD |
| `orchestrate plan -f <plan.json>` | Create parent + child tasks from a delegation plan |
| `orchestrate provision -t <parentId>` | Provision worktrees for children |
| `orchestrate status -t <parentId>` | Roll up child statuses |
| `orchestrate run -t <parentId>` | Run identity-patch children through the gate |
| `patch submit -f <patch.json>` | Dry-run validate a patch proposal |
| `patch submit -f <patch.json> --apply` | Validate + apply (writes receipt, marks accepted) |
| `worktree create -t <id> --workload <name>` | Provision an isolated worktree |
| `context catalog` / `context resolve -t <id>` | List / resolve context refs |

---

## 5. Core Workflows

### A. Run a coding task end-to-end (manual patch)

```powershell
# 1. Author a delegation plan (JSON) — see examples/orchestration/
janus orchestrate plan -f my-plan.json          # -> prints parentId + child IDs
janus orchestrate provision -t <parentId>       # bind worktrees

# 2. Executor pulls a scoped brief
janus brief -t <childId>

# 3. Executor writes patch.json (full file contents), then:
janus patch submit -f patch.json                # dry-run validate
#    on failure:
janus repair -t <childId>                       # get errors + suggested fixes -> revise
janus patch submit -f patch.json --apply        # apply once green
janus seed -t <childId>                          # seed the accepted pattern

# 4. Roll up
janus orchestrate status -t <parentId>
```

Patch proposal format:

```json
{
  "task_id": "task-<uuid>",
  "allow_overwrite": true,
  "files": [
    { "path": "src/.../MyClass.java", "content": "full file content here" }
  ]
}
```

### B. Let it run itself (autonomous loop)

```powershell
janus orchestrate plan -f plan.json
janus loop run -t <parentId>
```

The loop provisions worktrees, runs identity/asset/python executors automatically, prepares briefs for manual children, applies auto-fix on validation failures (up to `--max-rounds`), seeds accepted patterns, and logs outcomes to REL.

### C. Upscale a mod's textures

```powershell
janus assets audit <modId>           # check sources + namespace mapping
janus assets run <modId> --build     # pull -> upscale -> build pack
janus assets build --deploy          # deploy pack to the instance
```

### D. Heal a broken Python script

```powershell
janus memory heal -f broken_script.py
# Smart-Library sandboxes it, LLM-repairs on failure, retries, and
# auto-seeds the verified fix so future `janus memory query` finds it.
```

### E. Ask memory or cognition a question

```powershell
janus memory query -q "validation repair patterns for mixin tasks"
janus rel context -q "what's the current focus of the astral sorcery port"
```

---

## 6. Configuration

### `.env` (Docker stack) — `C:\Projects\Janus\.env`

The values that matter, as currently set:

```ini
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=qwen2.5-coder:7b                      # single shared model for Memory + REL

REL_BUILD_CONTEXT=C:/Projects/REL_Codex_Variant    # canonical REL source (build context)
REL_COGNITION_ROOT=C:/Projects/REL_Codex_Variant   # REL root the orchestrator reports
REL_DATA_PATH=C:/Projects/REL_Codex_Variant/data   # live state volume (holds CoreState.json)

REL_API_AUTH_REQUIRED=false                        # local dev: anonymous = service role
REL_ADMIN_PASSWORD=change-me-local-dev             # rotate before enabling auth
REL_OAUTH2_SECRET=change-me-local-dev-secret-min-32-chars
JANUS_MEMORY_API_KEY=                              # set to require X-API-Key on memory writes
```

> **These three `REL_*` paths must point at `C:/Projects/REL_Codex_Variant`** — the canonical, git-tracked REL with the live `data/CoreState.json`. Pointing them anywhere else is what caused the original "CoreState.json not found" / disconnected state.

### `janus.config.json` (orchestrator) — `C:\Projects\Janus\janus.config.json`

Component URLs, token budgets, and self-repair policy. Highlights:

- `components.memory.url` = `http://localhost:8000`
- `components.cognition.rest_url` = `http://localhost:8080`, `root` = `env:REL_COGNITION_ROOT`
- `components.assets.root` → `C:/Projects/AssetConverter`, entry `ac.py`
- `token_policy.brief_max_chars` = 12000, `memory.context_limit` = 3
- `self_repair.max_validation_retries` = 5, `seed_on_accept`/`seed_on_heal` = true

### The model

The whole stack runs on **one local model: `qwen2.5-coder:7b`** (4.7 GB, in the `ollama_data` volume). Both Smart-Library query synthesis and the REL steward's concept extraction use it. To change models, set `OLLAMA_MODEL` in `.env`, `docker exec janusprime-ollama ollama pull <model>`, then `docker compose up -d --build`.

---

## 7. Validation Profiles (quick reference)

Every workload validates under a profile. Build command runs as the final gate.

| Profile | Build command | Use case |
|---------|---------------|----------|
| `forge-mod-v1` | `./gradlew build` | Forge 1.20.1 mods (Node Core, Omni32 Loader) |
| `neoforge-mixin-v1` | `./gradlew compileJava` | NeoForge mixin mods (VS2, Valkyrien Portals) |
| `typescript-v1` | `pnpm typecheck` | The JanusPrime monorepo itself |
| `asset-audit-v1` | `python pipeline/audit_mod.py` | Omni32 texture audits |
| `python-sandbox-v1` | `python -m pytest tests/ -q` | Smart-Library |

Cross-profile rules always enforced: **CLAUDE001** (no TODO/FIXME/placeholder), **CLAUDE002** (no `@ts-ignore`/`@SuppressWarnings`), **CLAUDE003** (no hardcoded secrets), **CLAUDE004** (no `eval`/`new Function`/`child_process`). LSP warnings are treated as errors.

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Could not find janus.config.json walking up from ...` | Running `janus` outside the workspace | `cd C:\Projects\Janus` first |
| `janus` errors with `MODULE_NOT_FOUND` | Global shim points at a stale path | Use `.\scripts\janus.ps1`, or repoint the three shims in `AppData\Roaming\npm` (already fixed 2026-06-21) |
| `janusprime-cognition` shows **(unhealthy)** but `/health` returns 200 | Healthcheck used `curl`/`wget`, absent in `python:3.11-slim` | Healthcheck now uses `python urllib` (fixed in `docker-compose.yml`); `docker compose up -d --build cognition` |
| REL logs `CoreState.json not found!` | `REL_DATA_PATH` pointed at an empty dir | Point it at `C:/Projects/REL_Codex_Variant/data` in `.env`, then recreate cognition |
| REL log: `Ollama running but model '<x>' not found ... using naive extraction` | Steward model not pulled / mismatched | Stack standardized on `qwen2.5-coder:7b`; ensure it's pulled and `OLLAMA_MODEL` matches |
| `cognition.reachable=false` in `janus status` | Container down or wrong port | `docker ps`; `docker compose up -d cognition`; confirm `:8080` |
| Memory writes rejected (401/403) | `JANUS_MEMORY_API_KEY` set but not sent | Match the key, or clear it for local dev |
| Patch `apply` refused | Patch hash ≠ receipt | Re-run `patch submit` to regenerate the receipt, then apply |

### Quick full-stack reset

```powershell
cd C:\Projects\Janus
docker compose down
docker compose up -d --build
janus status
```

---

## 9. What Lives Where

```
C:\Projects\Janus\                    # workspace root — run janus from here
├── janus.config.json                 # component URLs, token budgets, self-repair
├── .env                              # Docker secrets + paths (qwen2.5-coder:7b, REL paths)
├── CLAUDE.md                         # canonical doctrine (single source of truth)
├── JanusPrime-Overview.md            # architecture reference
├── USER_GUIDE.md                     # this file
├── docker-compose.yml                # ollama + memory + cognition
├── scripts\janus.ps1                 # workspace CLI shim
├── workloads\registry.json           # registered repos + profiles
├── Project-Janus\                    # orchestrator (CLI, queue, validation kernel, MCP)
│   ├── .aether\                      # task queue, receipts, runtime state
│   └── packages\cli\dist\bin.js      # the actual CLI entrypoint
├── Smart-Library\                    # memory service (:8000) — Docker build context
└── AssetConverter-sparse\            # sparse asset scaffold

C:\Projects\REL_Codex_Variant\        # canonical REL cognition (:8080) — Docker build context
├── data\CoreState.json               # live cognition state
├── steward.py                        # concept extraction (qwen2.5-coder:7b)
├── skills\poe-build-builder\         # salvaged 2026-06-21 from the retired C:\REL
└── archive\rel-legacy-improvement-plan\   # historical phase docs (archived)

C:\Projects\AssetConverter\           # production Omni32 pipeline (ac.py)
```

> Retired 2026-06-21: `C:\REL` (dead snapshot) and `C:\REL_Codex_Variant` (empty mount husk). The one true REL is `C:\Projects\REL_Codex_Variant`.

---

## 10. MCP Integration (for IDE / agent use)

The orchestrator exposes an MCP server (`@aether/mcp-server`). Useful resources:

| Resource | URI |
|----------|-----|
| System status | `janus://system/status` |
| Doctrine | `janus://doctrine/claude` |
| Task brief | `janus://task/<id>/brief` |
| Repair context | `janus://task/<id>/repair` |
| REL state | `janus://rel/state-summary` |

Tools: `janus-memory-query`, `janus-repair-context`. Set `AETHER_TASK_ID` to scope MCP to one task in an IDE session. MCP config lives in `C:\Projects\Janus\.mcp.json`.

---

*Generated 2026-06-21. Commands verified against the live build. For doctrine, always defer to `CLAUDE.md`.*
