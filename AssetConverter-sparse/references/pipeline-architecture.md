# Pipeline Architecture

Module map and data flow for the Omni32 asset engine. Product overview: `docs/OMNI32.md`. Workflow steps: `docs/WORKFLOW.md`. Engine orchestration: `references/omni32-engine.md`.

## Data flow

### End-to-end (manual)

```
MOD_REPOS (config/registry.py)
        ↓ pull_mod_sources.py
   sources/<mod>/.../assets/<namespace>/textures/
        ↓ run_upscale.py (xBRZ + texture_policy)
   output/assets/<namespace>/textures/
        ↓ build_resourcepack.py
   output/resourcepack/Omni32/
        ↓ deploy (optional: OMNI32_DEPLOY=1 or --deploy)
   <instance>/resourcepacks/Omni32/
```

### Autonomous (engine)

```
docs/MOD_QUEUE.md  →  QUEUE_PRIORITY (pipeline/queue.py)
        ↓
   ac.py next / ac.py run <mod>
        ↓
   pipeline/engine.py
        ├─ pull_mod_sources.py     → sources/<mod>/
        ├─ git_commit_sources.py   → git (sources + assets paths)
        ├─ run_upscale.py          → output/assets/<namespace>/
        ├─ git_commit_sources.py   → git (assets)
        └─ build_resourcepack.py   → output/resourcepack/Omni32/ [+ optional deploy]
```

## Key modules

| Module | Role |
|--------|------|
| `ac.py` | CLI entry — dispatches to pipeline/scripts or `engine.py` |
| `config/paths.py` | Central paths; `PACK_NAME`, `DEPLOY_ENABLED`, env overrides |
| `config/registry.py` | Mod catalog, `MOD_NAMESPACES`, branches, jar fallbacks |
| `pipeline/queue.py` | `QUEUE_PRIORITY`, `next_mod()`, completion checks |
| `pipeline/engine.py` | Autonomous orchestrator: pull → upscale → commit → build |
| `pipeline/pull_mod_sources.py` | Git clone + Modrinth JAR extract → `sources/` |
| `pipeline/run_upscale.py` | Multi-root discovery + upscale → `output/assets/` |
| `pipeline/texture_policy.py` | Per-texture strategy (xBRZ, copy, nearest) |
| `pipeline/build_resourcepack.py` | Assemble Omni32 pack; optional instance deploy |
| `pipeline/audit_mod.py` | Pre-flight PNG audit and policy preview |
| `scripts/git_commit_sources.py` | Stage `sources/` and `output/assets/` paths; commit |
| `scripts/_atm10_analyze.py` | ATM10 gap analysis (`ac.py status`) |
| `scripts/upload_sources_batch.py` | Create/push sources upload branches (`ac.py upload-batch`) |

## Path resolution (`config/paths.py`)

| Symbol | Default path / value |
|--------|----------------------|
| `PROJECT_ROOT` | Repo root (`ASSETCONVERTER_ROOT` override) |
| `SOURCES_DIR` | `<root>/sources/` |
| `OUTPUT_ASSETS_DIR` | `<root>/output/assets/` |
| `RESOURCEPACK_DIR` | `<root>/output/resourcepack/` |
| `PACK_NAME` | `Omni32` (`OMNI32_PACK_NAME`) |
| `PACK_FORMAT` | `15` (`OMNI32_PACK_FORMAT`) |
| `DEPLOY_ENABLED` | `false` unless `OMNI32_DEPLOY=1` |
| `DEPLOY_DIR` | `<ASSETCONVERTER_INSTANCE>/resourcepacks/` |
| `PACK_VARIANTS_DIR` | `<root>/output/packs/` (future variants) |

## CLI dispatch (`ac.py`)

| Command | Target |
|---------|--------|
| `pull` | `pull_mod_sources.py` → `git_commit_sources.py` |
| `upscale` | `run_upscale.py` → `git_commit_sources.py` (unless `--no-commit`) |
| `build` | `build_resourcepack.py` |
| `run`, `next`, `queue` | `engine.py` |
| `status` | `_atm10_analyze.py` |
| `upload-batch` | `upload_sources_batch.py` |

## Pull stage

`pipeline/pull_mod_sources.py` reads `config/registry.py`:

- **`MOD_REPOS`** — shallow `git clone --depth 1` into `sources/<mod>/`
- **`CLONE_BRANCHES`** — non-default branch for 1.20.1 targets
- **`MODRINTH_JAR_MODS`** — download JAR to `local/jars/`, extract `assets/<namespace>/textures/`
- **`JAR_ONLY_MODS` / `JAR_FALLBACK_MODS`** — extract from instance `mods/` or `local/jars/`
- **Monorepo hosts** — `mekanismgenerators` / `mekanismtools` clone `mekanism` once

Expected source layout:

```
sources/<repo>/.../assets/<namespace>/textures/**/*.png
```

## Upscale stage

`pipeline/run_upscale.py`:

1. `find_source_texture_roots()` — walk `sources/` for all `assets/<namespace>/textures` trees
2. `texture_policy.classify_texture()` — choose xBRZ, copy, or nearest per PNG
3. Write mirrored paths under `output/assets/<namespace>/textures/`
4. Copy `.png.mcmeta` animation sidecars

Namespace resolution: `texture_namespace(mod_id)` from `config/registry.py` `MOD_NAMESPACES`.

Scaler backends: `xbrz_scaler.py`, `pixel_scaler.py` (hq2x), `waifu_scaler.py`.

## Build stage

`pipeline/build_resourcepack.py`:

1. Remove and recreate `output/resourcepack/<PACK_NAME>/`
2. Copy each `output/assets/<namespace>/textures/` → pack `assets/<namespace>/textures/`
3. Write `pack.mcmeta` with `PACK_FORMAT` and `PACK_DESCRIPTION`
4. If `args.deploy` or `DEPLOY_ENABLED` (and not `--no-deploy`): copy pack to `DEPLOY_DIR/<PACK_NAME>/`

## Queue and completion

`pipeline/queue.py` defines `QUEUE_PRIORITY` — ordered mod_ids synced with `docs/MOD_QUEUE.md`.

A mod is **complete** when `output/assets/<namespace>/textures/` contains at least one `.png`, where `namespace = texture_namespace(mod_id)`.

`next_mod()` returns the first incomplete, registered entry in `QUEUE_PRIORITY`.

## Multi-root sources

`find_source_texture_roots()` merges multiple source trees into one namespace:

| Namespace | Source roots |
|-----------|--------------|
| `thermal` | `thermal_core`, `thermal_foundation`, `thermal_expansion`, `thermal_innovation` |
| `mekanismgenerators` / `mekanismtools` | `sources/mekanism/` (monorepo) |
| `enderio` | Multiple `assets/enderio/textures` trees inside one clone |
| `aether` | Builtin resource packs inside clone |

## Git integration

`scripts/git_commit_sources.py` stages:

- `sources/<host>/` — host folder for monorepo mods (`mekanism` for generators/tools)
- `output/assets/<namespace>/` — when upscale output exists

Called automatically by `ac.py pull`, `ac.py upscale` (default), and `pipeline/engine.py` (default).

## Related docs

- `README.md` — CLI summary and quick start
- `docs/OMNI32.md` — Omni32 product vision and pack structure
- `docs/WORKFLOW.md` — autonomous and manual workflows
- `references/omni32-engine.md` — engine API, queue semantics, env vars