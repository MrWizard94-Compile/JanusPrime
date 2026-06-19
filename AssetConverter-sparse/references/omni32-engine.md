# Omni32 Engine

Design reference for the autonomous asset engine: `pipeline/engine.py`, `pipeline/queue.py`, and the `ac.py run` / `ac.py next` / `ac.py queue` CLI surface.

Product context: `docs/OMNI32.md`. Step-by-step usage: `docs/WORKFLOW.md`. Full module map: `references/pipeline-architecture.md`.

## Mission

AssetConverter is an **autonomous asset engine** that produces **Omni32** — standalone Minecraft 1.20.1 Forge resource pack(s) with 32× upscaled mod textures. The engine eliminates manual chaining of pull, upscale, commit, and build scripts.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  ac.py                                                  │
│    run <mod>  │  next [--count N]  │  queue              │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  pipeline/engine.py                                     │
│    process_mod()  │  process_queue()  │  queue status   │
└──────────────────────────┬──────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
  pull_mod_sources   run_upscale      build_resourcepack
         │                 │                 │
         ▼                 ▼                 ▼
    sources/<mod>   output/assets/    output/resourcepack/
                    <namespace>/         Omni32/
         │                 │
         └──── git_commit_sources.py ────┘
```

## Queue module (`pipeline/queue.py`)

### `QUEUE_PRIORITY`

Ordered list of registry `mod_id` values. The engine processes mods in this order. Keep synchronized with the **Top 15** section of `docs/MOD_QUEUE.md`.

Current head (first incomplete mod drives `ac.py next`):

```
relics_mod → modern_industrialization → storage_delight → …
```

Mods marked **DONE** in `MOD_QUEUE.md` are omitted from active processing once `output/assets/<namespace>/textures/` contains PNGs.

### Completion check

```python
is_complete(mod_id)  # True if output/assets/<namespace>/textures/ has ≥1 .png
```

`namespace` resolved via `texture_namespace(mod_id)` from `config/registry.py` `MOD_NAMESPACES`.

### API

| Function | Returns |
|----------|---------|
| `pending_mods()` | List of incomplete, registered mod_ids in priority order |
| `next_mod()` | First pending mod_id, or `None` if queue empty |
| `queue_status()` | `(done_list, pending_list)` where pending entries are `(mod_id, state)` tuples |
| `parse_done_from_mod_queue(path)` | Parse `**DONE**` rows from `docs/MOD_QUEUE.md` (utility; not used by engine loop) |

### Pending states

| State | Meaning |
|-------|---------|
| `ready` | In `MOD_REPOS`, not yet complete — eligible for `ac.py next` |
| `not_in_registry` | In `QUEUE_PRIORITY` but missing from `MOD_REPOS` — skipped until registered |

## Engine module (`pipeline/engine.py`)

### `process_mod(mod_id, *, method, commit, build, pull)`

Runs the full pipeline for one registry mod:

| Step | Condition | Script |
|------|-----------|--------|
| 1. Pull | `pull=True` (default) | `pull_mod_sources.py <mod_id>` |
| 2. Commit sources | `commit=True` and pulled | `git_commit_sources.py <mod_id>` |
| 3. Upscale | always | `run_upscale.py <mod_id> --method <method>` |
| 4. Commit assets | `commit=True` | `git_commit_sources.py <mod_id>` |
| 5. Build | `build=True` | `build_resourcepack.py [flags]` |

Prints namespace mapping at start: `mod_id → namespace`.

On subprocess failure (`returncode != 0`), engine exits with that code.

### `process_queue(count=1, **kwargs)`

Calls `next_mod()` up to `count` times, running `process_mod()` for each. Stops early if queue is empty.

### Build deploy logic in engine

When `build=True`:

- If `OMNI32_DEPLOY` is `0`, `false`, or `no` → passes `--no-deploy` to `build_resourcepack.py`
- Otherwise → no extra flags; build script uses `DEPLOY_ENABLED` from env and its own `--deploy` default

To force deploy from engine runs: set `OMNI32_DEPLOY=1` before `ac.py next --build` or `ac.py run <mod> --build`.

### CLI entry (`python pipeline/engine.py`)

| Subcommand | Maps to |
|------------|---------|
| `run <mod>` | `process_mod()` |
| `next [--count N]` | `process_queue()` |
| `queue` | Print done, pending, and next mod |

`ac.py` wraps these subcommands — prefer `ac.py run` / `ac.py next` / `ac.py queue` at the repo root.

## CLI surface (`ac.py`)

| Command | Engine args | Notes |
|---------|-------------|-------|
| `ac.py run <mod>` | `--method`, `--no-commit`, `--build`, `--no-pull` | Ad-hoc single mod |
| `ac.py next` | `--count`, `--method`, `--no-commit`, `--build` | Drain queue head |
| `ac.py queue` | — | Read-only status |
| `ac.py pull` | — | Manual; bypasses engine |
| `ac.py upscale` | `--method`, `--no-commit` | Manual; auto-commits by default |
| `ac.py build` | `--deploy`, `--no-deploy` | Manual; no git side effects |
| `ac.py status` | — | ATM10 gap report, not queue status |
| `ac.py upload-batch` | — | Sources branch upload; unrelated to engine loop |

### Examples

```powershell
# Status only
python ac.py queue

# Process next mod
python ac.py next

# Three mods, xBRZ, rebuild pack, no git commits
python ac.py next --count 3 --build --no-commit

# One mod, skip pull (sources already present), deploy on build
$env:OMNI32_DEPLOY = "1"
python ac.py run relics_mod --no-pull --build
```

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `OMNI32_PACK_NAME` | `Omni32` | Resource pack folder name under `output/resourcepack/` and deploy path |
| `OMNI32_PACK_DESCRIPTION` | Omni32 tagline | `pack.mcmeta` description field |
| `OMNI32_PACK_FORMAT` | `15` | `pack_format` for Minecraft 1.20.1 |
| `OMNI32_DEPLOY` | off (`""`) | Set `1` / `true` / `yes` to enable deploy on `build`; `0` / `false` / `no` forces `--no-deploy` in engine build step |
| `ASSETCONVERTER_ROOT` | repo root | Relocate project (`config/paths.py` `PROJECT_ROOT`) |
| `ASSETCONVERTER_INSTANCE` | CurseForge instance path | Deploy target root; pack copied to `<instance>/resourcepacks/<PACK_NAME>/` |

Defined in `config/paths.py`:

```python
PACK_NAME = os.environ.get("OMNI32_PACK_NAME", "Omni32")
DEPLOY_ENABLED = os.environ.get("OMNI32_DEPLOY", "").lower() in ("1", "true", "yes")
```

Deploy requires explicit opt-in: `OMNI32_DEPLOY=1` or `ac.py build --deploy`. Default `ac.py build` writes only to `output/resourcepack/Omni32/`.

## Autonomy loop

```text
docs/MOD_QUEUE.md  →  pipeline/queue.py (QUEUE_PRIORITY)
        ↓
   ac.py next / ac.py run <mod>
        ↓
   pipeline/engine.py
        ├─ pull_mod_sources.py  → sources/<mod>/
        ├─ run_upscale.py       → output/assets/<namespace>/
        ├─ git_commit_sources.py (optional)
        └─ build_resourcepack.py (optional) → output/resourcepack/Omni32/
```

### Recommended operating modes

| Mode | Command | Use when |
|------|---------|----------|
| Unattended batch | `ac.py next --count N --build` | Overnight queue drain |
| Single mod verify | `ac.py run <mod>` | First-time registry mod |
| Quality pass | `ac.py run <mod> --no-pull --method hq2x` | Re-upscale without re-clone |
| CI / no git | `ac.py next --no-commit` | Sandbox without repo writes |

## Roadmap (autonomy)

| Phase | Status | Description |
|-------|--------|-------------|
| Queue module | **Done** | `pipeline/queue.py` |
| Engine orchestrator | **Done** | `pipeline/engine.py` |
| CLI `run` / `next` / `queue` | **Done** | `ac.py` integration |
| Optional deploy | **Done** | Off by default; `OMNI32_DEPLOY` + `--deploy` |
| Scheduled runs | Next | Cron / Task Scheduler invoking `ac.py next --build` |
| Auto-refresh MOD_QUEUE | Next | Wire `ac.py status` output into `docs/MOD_QUEUE.md` regeneration |
| Pack variants | Future | `output/packs/Omni32-Tech`, namespace filters |
| Split distribution | Future | Size-limited pack shards for CurseForge |

## Module map (quick reference)

| File | Role |
|------|------|
| `pipeline/queue.py` | `QUEUE_PRIORITY`, `next_mod()`, `is_complete()`, `queue_status()` |
| `pipeline/engine.py` | `process_mod()`, `process_queue()`, subprocess orchestration |
| `config/registry.py` | `MOD_REPOS`, `MOD_NAMESPACES`, `texture_namespace()` |
| `config/paths.py` | `PACK_NAME`, `DEPLOY_ENABLED`, directory constants |
| `pipeline/run_upscale.py` | xBRZ + texture policy execution |
| `pipeline/build_resourcepack.py` | Assemble and optionally deploy Omni32 |
| `scripts/git_commit_sources.py` | Git staging for sources and upscaled assets |

## Related docs

- `README.md` — project overview
- `docs/OMNI32.md` — product vision and pack structure
- `docs/WORKFLOW.md` — autonomous and manual workflows
- `references/pipeline-architecture.md` — full pipeline data flow