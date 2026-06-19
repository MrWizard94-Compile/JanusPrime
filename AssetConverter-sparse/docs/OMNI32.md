# Omni32

Omni32 is the standalone product line produced by the AssetConverter autonomous asset engine: **32× upscaled mod textures** packaged as a Minecraft **1.20.1 Forge** resource pack.

## Vision

Omni32 exists to make high-resolution mod textures **systematically obtainable** — not as a one-off modpack patch, but as a durable, repeatable asset pipeline that can cover hundreds of Forge mods with consistent upscale policy and versioned source trees.

**Goals:**

- **Coverage** — ingest textures from public repos and closed-source JARs; track progress in `docs/MOD_QUEUE.md`.
- **Consistency** — one upscale policy (`pipeline/texture_policy.py`) applied across all namespaces.
- **Autonomy** — `ac.py next` and `ac.py run` drive pull → upscale → commit without manual step chaining.
- **Portability** — output is a standard resource pack usable in any 1.20.1 Forge instance; deploy to a local CurseForge folder is optional.
- **Scale** — future support for multiple pack variants (`output/packs/`) and split distributions.

Omni32 is **not** tied to a single modpack. ATM10 research in `data/` informs prioritization; the pack itself is modpack-agnostic.

## Pack structure

A built Omni32 pack lives at:

```
output/resourcepack/Omni32/
├── pack.mcmeta          # pack_format 15, description from OMNI32_PACK_DESCRIPTION
└── assets/
    └── <namespace>/
        └── textures/
            └── **/*.png
            └── **/*.png.mcmeta   # animation sidecars copied alongside PNGs
```

**Intermediate assets** (versioned in git, not shipped as a pack alone):

```
output/assets/<namespace>/textures/
```

Every folder under `output/assets/` with a `textures/` subdirectory is included when `ac.py build` runs. Namespaces are sorted alphabetically at build time.

### Namespace vs mod_id

Registry `mod_id` (used in CLI and `MOD_REPOS`) may differ from the Minecraft asset namespace:

| mod_id | namespace |
|--------|-----------|
| `oh_the_biomes_weve_gone` | `biomeswevegone` |
| `railcraft_reborn` | `railcraft` |
| `relics_mod` | `relics` |
| `extreme_reactors` | `bigreactors` |
| `the_undergarden` | `undergarden` |

Full mapping: `config/registry.py` → `MOD_NAMESPACES`. The engine resolves namespace via `texture_namespace()`.

### pack.mcmeta

Written by `pipeline/build_resourcepack.py`:

| Field | Source |
|-------|--------|
| `pack_format` | `OMNI32_PACK_FORMAT` (default `15` — Minecraft 1.20.1) |
| `description` | `OMNI32_PACK_DESCRIPTION` |

Pack folder name: `OMNI32_PACK_NAME` (default `Omni32`).

## How assets flow into Omni32

```
config/registry.py (MOD_REPOS)
        ↓  ac.py pull / engine pull step
sources/<mod>/.../assets/<namespace>/textures/
        ↓  ac.py upscale / engine upscale step
output/assets/<namespace>/textures/
        ↓  ac.py build
output/resourcepack/Omni32/assets/<namespace>/textures/
        ↓  optional: OMNI32_DEPLOY=1 or --deploy
<instance>/resourcepacks/Omni32/
```

See `references/pipeline-architecture.md` for module-level detail.

## Autonomy model

The autonomous loop is implemented in `pipeline/engine.py` and `pipeline/queue.py`.

### Queue

`QUEUE_PRIORITY` in `pipeline/queue.py` defines processing order. A mod is **complete** when `output/assets/<namespace>/textures/` contains at least one `.png`. Pending mods are those in `QUEUE_PRIORITY` that are registered in `MOD_REPOS` but not yet complete.

```powershell
python ac.py queue      # inspect done / pending / next
python ac.py next       # process one pending mod
python ac.py next --count 5 --build   # process five, rebuild pack each time
python ac.py run relics_mod --build   # ad-hoc single mod
```

### Engine steps per mod

1. **Pull** — `pull_mod_sources.py` → `sources/<mod>/`
2. **Commit sources** — `git_commit_sources.py` (unless `--no-commit`)
3. **Upscale** — `run_upscale.py` → `output/assets/<namespace>/`
4. **Commit assets** — `git_commit_sources.py` (unless `--no-commit`)
5. **Build** (optional `--build`) — `build_resourcepack.py` → `output/resourcepack/Omni32/`

Deploy during build follows `OMNI32_DEPLOY` and `--deploy` / `--no-deploy` rules in `config/paths.py`.

### Manual override

Any step can be run independently: `pull`, `upscale`, `build`. Use manual mode when debugging upscale quality, fixing registry entries, or handling edge-case mods. See `docs/WORKFLOW.md`.

## Deploy policy

**Default: build only, no instance copy.**

| Enable deploy | How |
|---------------|-----|
| Per command | `python ac.py build --deploy` |
| Environment | `$env:OMNI32_DEPLOY = "1"` then `python ac.py build` |
| Engine + build | `python ac.py next --build` with `OMNI32_DEPLOY=1` |

Deploy target: `ASSETCONVERTER_INSTANCE/resourcepacks/Omni32/` (see `config/paths.py`).

Disable explicitly: `python ac.py build --no-deploy` or `OMNI32_DEPLOY=0`.

## Autonomy roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| Queue module | **Done** | `pipeline/queue.py` — priority list, completion checks |
| Engine orchestrator | **Done** | `pipeline/engine.py` — `run`, `next`, `queue` |
| CLI integration | **Done** | `ac.py run`, `ac.py next`, `ac.py queue` |
| Optional deploy | **Done** | Off by default; `OMNI32_DEPLOY` + `--deploy` |
| Scheduled runs | Next | Cron / Task Scheduler: `ac.py next --build` |
| Auto-refresh queue | Next | Regenerate `docs/MOD_QUEUE.md` from `ac.py status` |
| Pack variants | Future | `output/packs/Omni32-Tech`, `Omni32-Decor`, etc. |
| Split distribution | Future | Namespace-count limits for CurseForge upload size |

Detailed engine design: `references/omni32-engine.md`.

## Using Omni32 in-game

1. Build the pack: `python ac.py build`
2. Copy `output/resourcepack/Omni32/` to your instance `resourcepacks/` folder (or use `--deploy`).
3. Launch Minecraft 1.20.1 Forge.
4. Options → Resource Packs → enable **Omni32** at the top of the active list.
5. Ensure the underlying mods are installed — Omni32 overrides textures only; it does not add items or blocks.

## Related docs

- `README.md` — project overview and CLI summary
- `docs/WORKFLOW.md` — autonomous and manual step-by-step workflows
- `docs/MOD_QUEUE.md` — prioritized mod backlog and completion status
- `references/omni32-engine.md` — engine modules, env vars, queue semantics
- `references/pipeline-architecture.md` — data flow and module table