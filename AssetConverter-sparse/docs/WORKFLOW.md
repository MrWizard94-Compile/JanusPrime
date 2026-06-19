# Workflow

Step-by-step guide for the Omni32 asset engine: autonomous batch processing, manual per-step control, git flow, and mod queue maintenance.

## Principles (SOUL.md)

- **Sources live in the repo** under `sources/` — never at the project root or outside git.
- **Pull commits immediately** — `ac.py pull` runs `git_commit_sources.py` after every clone/extract.
- **Upscale commits by default** — `ac.py upscale` and the engine call `git_commit_sources.py` unless `--no-commit` is passed.
- **Build does not commit** — `output/resourcepack/Omni32/` is a local build artifact; deploy is optional and local.
- **Local-only paths** — `local/cache`, `local/jars`, and `tools/` stay off git; `sources/` and `output/assets/` are versioned artifacts.
- **Registry is the source of truth** — every pullable mod must exist in `config/registry.py` before `ac.py pull` will succeed.

## Pipeline overview

### Autonomous flow (recommended)

```
docs/MOD_QUEUE.md          pipeline/queue.py (QUEUE_PRIORITY)
        │                           │
        └──────── queue pick ───────┘
                    │
                    ▼
         python ac.py next [--build]
         python ac.py run <mod> [--build]
                    │
         pipeline/engine.py
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
 pull           upscale          build (optional)
    │               │               │
sources/<mod>/  output/assets/   output/resourcepack/Omni32/
    │          <namespace>/              │
    └─ git commit ─┴─ git commit ───────┘
                              │
                              ▼ (optional)
              <instance>/resourcepacks/Omni32/
```

### Manual flow

```
docs/MOD_QUEUE.md          config/registry.py
        │                           │
        └──────── pick mod ─────────┘
                    │
                    ▼
         python ac.py pull <mod>
                    │
         sources/<mod>/  ──git commit──►  repo
                    │
                    ▼
         python ac.py upscale <mod>
                    │
         output/assets/<namespace>/  ──git commit──►  repo
                    │
                    ▼
         python ac.py build [--deploy]
                    │
         output/resourcepack/Omni32/
                    │
                    ▼ (optional)
         <instance>/resourcepacks/Omni32/
```

Product context: `docs/OMNI32.md`. Engine internals: `references/omni32-engine.md`.

---

## Autonomous workflow

### Inspect the queue

```powershell
python ac.py queue
```

Shows:

- **Done** — mods in `QUEUE_PRIORITY` with PNGs in `output/assets/<namespace>/textures/`
- **Pending** — `ready` (registered, not complete) or `not_in_registry`
- **Next** — first pending mod that will be processed by `ac.py next`

### Process one or more mods

```powershell
# Next pending mod: pull → upscale → commit
python ac.py next

# Process three mods in priority order
python ac.py next --count 3

# Rebuild Omni32 after each mod
python ac.py next --count 3 --build

# Single mod by registry mod_id (skip pull if sources already present)
python ac.py run relics_mod
python ac.py run relics_mod --no-pull --build
```

### Engine flags

| Flag | Effect |
|------|--------|
| `--method xbrz\|hq2x\|waifu2x` | Upscale algorithm (default: xbrz) |
| `--no-commit` | Skip `git_commit_sources.py` after pull and upscale |
| `--no-pull` | Skip pull step (`run` only) |
| `--build` | Run `build_resourcepack.py` after upscale |

When `--build` is used, deploy follows `OMNI32_DEPLOY` unless the engine sees `OMNI32_DEPLOY=0/false/no` (adds `--no-deploy` to build).

### Typical overnight batch

```powershell
$env:OMNI32_DEPLOY = "1"    # optional: copy pack to instance after each build
python ac.py next --count 10 --build
```

---

## Manual workflow

Use manual steps when debugging registry entries, comparing upscale methods, or handling edge-case mods.

### Step 1 — Pick a mod from the queue

Open `docs/MOD_QUEUE.md`. The **Top 15** table lists ATM10 mods ranked by estimated PNG count, CurseForge popularity, and content weight.

Before pulling, confirm:

1. The namespace is not already listed under **Upscaled namespaces** in `MOD_QUEUE.md`.
2. The mod has a public repo (or is a known JAR-only / Modrinth entry).

If the mod is **not** in `config/registry.py` `MOD_REPOS`, add it first (see Step 2).

Refresh the queue after large batch upscales:

```powershell
python ac.py status
```

This re-runs `scripts/_atm10_analyze.py` and prints gaps between ATM10, `output/assets/`, and `MOD_REPOS`.

### Step 2 — Register the mod (new mods only)

Edit `config/registry.py`:

```python
MOD_REPOS = {
    # ...
    "relics_mod": "https://github.com/SSKirillSS/relics.git",
}

CLONE_BRANCHES = {
    # only if not default branch
    "relics_mod": "main",
}

MOD_NAMESPACES = {
    # when asset namespace differs from mod_id
    "relics_mod": "relics",
}
```

Registry sections:

| Section | Use case |
|---------|----------|
| `MOD_REPOS` | Git clone URL for every pullable mod |
| `CLONE_BRANCHES` | Non-default branch (target **1.20.1 / 1.20.x Forge**) |
| `MOD_NAMESPACES` | mod_id → Minecraft asset namespace when they differ |
| `JAR_ONLY_MODS` | No public source; extract textures from a named JAR |
| `JAR_FALLBACK_MODS` | Repo exists but JAR has more textures — pick richer source |
| `MODRINTH_JAR_MODS` | Closed-source Macaw's mods — download from Modrinth CDN |
| `SKIP_MODS` | Libraries / performance mods with no useful textures |

Jar paths resolve from `local/jars/` first, then the instance `mods/` folder (`config/paths.py` → `MODS_DIR`).

Optional preflight:

```powershell
python pipeline/audit_mod.py relics_mod
```

### Step 3 — Pull sources

```powershell
python ac.py pull relics_mod

# Multiple mods
python ac.py pull relics_mod modern_industrialization storage_delight
```

**What `pull` does:**

1. `pipeline/pull_mod_sources.py` — shallow-clone into `sources/<mod>/`, or JAR extract for closed-source entries.
2. `scripts/git_commit_sources.py` — `git add sources/<mod>/` and commit with message `pull: <mod>`.

### Step 4 — Upscale

```powershell
python ac.py upscale relics_mod

# Alternatives
python ac.py upscale create --method hq2x
python ac.py upscale botania --method waifu2x

# Skip auto-commit
python ac.py upscale relics_mod --no-commit
```

**What `upscale` does:**

`pipeline/run_upscale.py`:

1. Discovers texture roots via `find_source_texture_roots()`.
2. Classifies each PNG with `texture_policy.classify_texture()`.
3. Writes to `output/assets/<namespace>/textures/`, preserving relative paths.
4. Copies `.png.mcmeta` sidecars alongside PNGs.
5. Unless `--no-commit`, runs `git_commit_sources.py` (stages `output/assets/<namespace>/`).

### Upscale policy (`pipeline/texture_policy.py`)

| Condition | Strategy | Result |
|-----------|----------|--------|
| 16×16 | Pixel art | xBRZ / hq2x / waifu2x 2× |
| 32×32 | Copy | No resize |
| Short side ≥ 32, long ≤ 64 | Copy | Already pack-ready |
| Strip / odd aspect (long ≥ 4× short) | Nearest | 2× nearest-neighbor |
| JEI / EMI / REI (`UI_MODS`) | Nearest | Layout-sensitive UI sprites |

Default method is **xbrz**.

### Step 5 — Build pack

```powershell
# Build only (default)
python ac.py build

# Build and deploy to instance
python ac.py build --deploy

# Force skip deploy even when OMNI32_DEPLOY=1
python ac.py build --no-deploy
```

**What `build` does:**

`pipeline/build_resourcepack.py`:

1. Creates `output/resourcepack/Omni32/` with all namespaces from `output/assets/`.
2. Writes `pack.mcmeta` (`pack_format: 15`, description from `OMNI32_PACK_DESCRIPTION`).
3. Deploys to `<ASSETCONVERTER_INSTANCE>/resourcepacks/Omni32/` **only** when `OMNI32_DEPLOY=1` or `--deploy` is passed (and not overridden by `--no-deploy`).

Rebuild after **any** new upscale — `build` packages **all** namespaces under `output/assets/`, not just the last mod.

### In-game verification

1. Ensure pack is in instance `resourcepacks/Omni32/` (manual copy or `--deploy`).
2. Launch a 1.20.1 Forge instance with the underlying mods installed.
3. Options → Resource Packs → enable **Omni32**.
4. Spot-check blocks/items from the mod you just upscaled.

---

## Git commit flow

| Stage | Command | Git action | Message pattern |
|-------|---------|------------|-----------------|
| Pull | `ac.py pull <mod>` | Automatic | `pull: <mod>` |
| Upscale | `ac.py upscale <mod>` | Automatic (unless `--no-commit`) | `pull: <mod>` * |
| Engine | `ac.py run` / `ac.py next` | Automatic (unless `--no-commit`) | `pull: <mod>` per commit call |
| Build | `ac.py build` | None | — |

\* `git_commit_sources.py` uses the message `pull: <mod>` for both source and asset commits. It stages `sources/<host>/` and `output/assets/<namespace>/` when present.

### Single-mod example (manual)

```powershell
# 1. Register in config/registry.py (if new)

# 2. Pull + auto-commit sources
python ac.py pull relics_mod

# 3. Upscale + auto-commit assets
python ac.py upscale relics_mod

# 4. Rebuild pack (deploy optional)
python ac.py build --deploy
```

### Single-mod example (autonomous)

```powershell
python ac.py run relics_mod --build --deploy
```

Equivalent to pull → commit → upscale → commit → build with deploy enabled.

### Batch example (queue)

```powershell
python ac.py next --count 3 --build
```

Processes the next three pending mods from `QUEUE_PRIORITY` in order.

---

## Mod queue process

`docs/MOD_QUEUE.md` is the working backlog. `pipeline/queue.py` `QUEUE_PRIORITY` should stay aligned with the **Top 15** section.

### 1. Analyze

```powershell
python ac.py status
```

Cross-references:

- `data/atm10_mods_raw.json` — full ATM10 mod list
- `output/assets/` — what's already upscaled (89 namespaces)
- `config/registry.py` `MOD_REPOS` — what's registered for pull

### 2. Prioritize

`MOD_QUEUE.md` ranks candidates by PNG count, CurseForge exposure, and content weight. Mods in `SKIP_MODS` or without textures are excluded.

### 3. Register gaps

Top queue entries not yet in `MOD_REPOS` are listed under **Add to registry** in `MOD_QUEUE.md`. Copy each into `config/registry.py` before pulling.

### 4. Process

Autonomous: `python ac.py next` or `python ac.py next --count N --build`.

Manual: Steps 3–5 above.

Check progress: `python ac.py queue`.

### 5. Edge cases

| Situation | Action |
|-----------|--------|
| ATM10 slug ≠ mod_id (e.g. `the_twilight_forest` → `twilightforest`) | Use `mod_id` / namespace from `MOD_REPOS`, not CurseForge slug |
| mod_id ≠ asset namespace | Add `MOD_NAMESPACES` entry; upscale writes to mapped namespace |
| Mod already upscaled under different folder name | Check **Upscaled namespaces** in `MOD_QUEUE.md` |
| 1.21 NeoForge ATM10 vs 1.20.1 Forge clone | `CLONE_BRANCHES` target 1.20.1; textures usually compatible |
| Macaw's / closed-source | `MODRINTH_JAR_MODS`; pull extracts from JAR |
| Sparse GitHub repo | `JAR_FALLBACK_MODS` with instance JAR filename |

---

## CLI reference

| Command | Script(s) | Input | Output |
|---------|-----------|-------|--------|
| `ac.py run <mod>` | `engine.py` | registry mod_id | full pipeline |
| `ac.py next [--count N]` | `engine.py` | `queue.py` | N mods processed |
| `ac.py queue` | `engine.py` | `queue.py` | console status |
| `ac.py pull <mods...>` | `pull_mod_sources.py`, `git_commit_sources.py` | registry | `sources/<mod>/` + commit |
| `ac.py upscale <mod>` | `run_upscale.py`, `git_commit_sources.py` | `sources/` | `output/assets/<namespace>/` + commit |
| `ac.py build [--deploy]` | `build_resourcepack.py` | `output/assets/` | `output/resourcepack/Omni32/` [+ deploy] |
| `ac.py status` | `_atm10_analyze.py` | `data/`, assets, registry | gap report |
| `ac.py upload-batch <NN>` | `upload_sources_batch.py` | branch tables | upload branch |

---

## Adding a new mod (checklist)

- [ ] Mod listed or prioritized in `docs/MOD_QUEUE.md`
- [ ] `mod_id` + repo URL added to `config/registry.py` `MOD_REPOS`
- [ ] `MOD_NAMESPACES` entry if namespace differs from mod_id
- [ ] Branch added to `CLONE_BRANCHES` if not default
- [ ] JAR fallback configured if repo is sparse or closed-source
- [ ] `mod_id` added to `QUEUE_PRIORITY` in `pipeline/queue.py` (if using autonomous queue)
- [ ] `python ac.py pull <mod_id>` — sources committed
- [ ] `python pipeline/audit_mod.py <mod_id>` — optional preflight
- [ ] `python ac.py upscale <mod_id>` — assets written and committed
- [ ] `python ac.py build` — pack built at `output/resourcepack/Omni32/`
- [ ] Optional: `python ac.py build --deploy` — instance copy
- [ ] In-game visual check
- [ ] `python ac.py status` — refresh queue doc after batches

---

## Related docs

- `docs/OMNI32.md` — product vision, pack structure, autonomy roadmap
- `docs/MOD_QUEUE.md` — ATM10 priority queue and registry gaps
- `config/registry.py` — mod catalog (URLs, branches, JAR maps, namespaces)
- `config/paths.py` — paths, pack name, deploy flags
- `references/pipeline-architecture.md` — module-level data flow
- `references/omni32-engine.md` — engine design and environment variables
- `references/git-branch-strategy.md` — `upload-batch` branch definitions