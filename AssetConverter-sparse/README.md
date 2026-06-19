# Omni32 Asset Engine

**AssetConverter** is a standalone autonomous asset engine that produces **Omni32** — Minecraft 1.20.1 Forge resource pack(s) with 32× upscaled mod textures. Clone mod sources, upscale pixel art with xBRZ and size-aware policy, assemble the pack, and optionally deploy to a local instance.

This is **not** a modpack-specific tool. Omni32 is the product; any Forge 1.20.1 instance can use the output pack.

## What it does

1. **Source acquisition** — clone public mod repos (or extract closed-source JARs) into `sources/` so textures are versioned in git.
2. **Upscale** — apply per-texture strategy (xBRZ, nearest-neighbor, or copy-as-is) and write results to `output/assets/<namespace>/`.
3. **Pack** — merge all upscaled namespaces into `output/resourcepack/Omni32/`.
4. **Deploy (optional)** — copy the built pack to a CurseForge instance `resourcepacks/` folder when explicitly enabled.

The mod catalog, clone branches, and JAR fallbacks live in `config/registry.py`. Work queue and ATM10 gap analysis live in `docs/MOD_QUEUE.md`. Product vision and autonomy roadmap: `docs/OMNI32.md`.

## Directory structure

```
AssetConverter/
├── SOUL.md                  # Engineering principles (Corwin)
├── ac.py                    # CLI entry point
├── mod_sources.py           # Shim re-exporting config.registry (legacy imports)
├── config/
│   ├── paths.py             # Paths, Omni32 pack name, deploy flags
│   └── registry.py          # MOD_REPOS, CLONE_BRANCHES, jar fallbacks
├── pipeline/
│   ├── engine.py            # Autonomous orchestrator (pull → upscale → commit → build)
│   ├── queue.py             # QUEUE_PRIORITY, completion checks
│   ├── pull_mod_sources.py  # Clone / extract → sources/
│   ├── run_upscale.py       # Upscale one namespace
│   ├── build_resourcepack.py# Package Omni32 (+ optional deploy)
│   ├── texture_policy.py    # Per-texture upscale strategy
│   └── audit_mod.py         # Pre-flight texture audit
├── scripts/
│   ├── git_commit_sources.py
│   ├── upload_sources_batch.py
│   └── _atm10_analyze.py    # Invoked by `ac.py status`
├── sources/                 # Mod source trees (committed to repo)
├── output/
│   ├── assets/              # Upscaled textures per namespace
│   ├── resourcepack/        # Built pack (Omni32/)
│   └── packs/               # Future: multiple Omni32 variants
├── local/                   # Machine-local only (not committed)
│   ├── cache/               # Optional upscale cache
│   └── jars/                # Downloaded Modrinth / fallback JARs
├── data/                    # ATM10 research JSON
├── docs/
│   ├── OMNI32.md            # Product vision, pack structure, roadmap
│   ├── WORKFLOW.md          # Autonomous + manual pipeline guide
│   └── MOD_QUEUE.md         # Upscale priority queue
└── references/
    ├── pipeline-architecture.md
    ├── omni32-engine.md
    └── git-branch-strategy.md
```

**What belongs in the repo vs locally**

| Path | In git? | Notes |
|------|---------|-------|
| `sources/` | Yes | Pulled mod trees; committed after every `pull` |
| `output/assets/` | Yes | Upscaled textures; committed after upscale |
| `output/resourcepack/` | Optional | Rebuilt by `build`; not required in git |
| `local/` | No | Cache and downloaded JARs |
| `tools/` | No | System / machine-specific binaries (xBRZ, waifu2x) |

Sources **never** land at the project root. `ac.py pull` writes only under `sources/<mod>/`.

## Quick start

All commands run from the repo root:

```powershell
cd C:\Users\Bulkl\OneDrive\Desktop\AssetConverter
```

### Autonomous (recommended)

```powershell
# Show queue: done vs pending mods
python ac.py queue

# Process the next pending mod (pull → upscale → git commit)
python ac.py next

# Process 3 mods, rebuild pack after each
python ac.py next --count 3 --build

# Full pipeline for one registry mod_id
python ac.py run relics_mod --build
```

### Manual steps

```powershell
python ac.py pull relics_mod
python ac.py upscale relics_mod
python ac.py build
```

### Optional deploy

Deploy is **off by default**. Enable with env var or CLI flag:

```powershell
# One-shot deploy
python ac.py build --deploy

# Or set for the session
$env:OMNI32_DEPLOY = "1"
python ac.py build
```

## CLI reference

| Command | Description |
|---------|-------------|
| `ac.py run <mod>` | Autonomous pipeline: pull → upscale → commit [→ build] |
| `ac.py next [--count N] [--build-last]` | Process next N mods; optional Omni32 rebuild after batch |
| `ac.py stats` | Dashboard: namespaces, PNG count, discovered gaps |
| `ac.py sync-queue` | Refresh `docs/MOD_QUEUE.md` from `output/assets/` |
| `ac.py queue` | Show done vs pending mods and next target |
| `ac.py pull <mods...>` | Clone sources into `sources/` and git commit |
| `ac.py upscale <mod> [--method xbrz\|hq2x\|waifu2x]` | Upscale one namespace; auto-commits unless `--no-commit` |
| `ac.py build [--deploy] [--no-deploy]` | Build `output/resourcepack/Omni32/`; deploy only when requested |
| `ac.py status` | ATM10 gap analysis (registry vs `output/assets/`) |
| `ac.py upload-batch <NN> [--push]` | Create/push sources upload branch (01–11) |

Full step-by-step guide: `docs/WORKFLOW.md`. Engine internals: `references/omni32-engine.md`.

## Output paths

| Artifact | Path |
|----------|------|
| Upscaled textures | `output/assets/<namespace>/textures/` |
| Built resource pack | `output/resourcepack/Omni32/` |
| Deploy target (optional) | `<instance>/resourcepacks/Omni32/` |

Pack name defaults to `Omni32` (`config/paths.py` → `PACK_NAME`). Override with `OMNI32_PACK_NAME`.

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `OMNI32_PACK_NAME` | `Omni32` | Resource pack folder name |
| `OMNI32_PACK_DESCRIPTION` | Omni32 tagline | `pack.mcmeta` description |
| `OMNI32_PACK_FORMAT` | `15` | Minecraft 1.20.1 pack format |
| `OMNI32_DEPLOY` | off | Set `1` / `true` / `yes` to deploy on `build` |
| `ASSETCONVERTER_ROOT` | Repo root | Relocate entire project |
| `ASSETCONVERTER_INSTANCE` | CurseForge instance path | Deploy target when deploy is enabled |

## Configuration reference

- **`config/registry.py`** — `MOD_REPOS` (clone URLs), `MOD_NAMESPACES` (mod_id → asset namespace), `CLONE_BRANCHES`, `JAR_ONLY_MODS`, `JAR_FALLBACK_MODS`, `MODRINTH_JAR_MODS`, `SKIP_MODS`.
- **`config/paths.py`** — `SOURCES_DIR`, `OUTPUT_ASSETS_DIR`, `RESOURCEPACK_DIR`, `PACK_NAME`, `DEPLOY_ENABLED`.
- **`pipeline/queue.py`** — `QUEUE_PRIORITY` list synced with `docs/MOD_QUEUE.md` top section.
- **`docs/MOD_QUEUE.md`** — 89 namespaces done; prioritized ATM10 candidates still to add.

## Status

- **89** namespaces upscaled — see `docs/MOD_QUEUE.md`
- Next queue target: `relics_mod` (see `python ac.py queue`)

## Further reading

- `docs/OMNI32.md` — product vision, pack structure, autonomy roadmap
- `docs/WORKFLOW.md` — autonomous and manual workflows, git flow, mod queue process
- `docs/MOD_QUEUE.md` — ATM10 priority table and registry gaps
- `references/pipeline-architecture.md` — module map and data flow
- `references/omni32-engine.md` — engine design, queue, environment variables
- `SOUL.md` — project engineering standards