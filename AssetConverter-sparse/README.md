# AssetConverter-sparse (JanusPrime)

Omni32 asset engine vendored inside the **JanusPrime** workspace. This directory is the `components.assets.root` target in `janus.config.json` and the workload anchor for Omni32 orchestration.

## Vendored pipeline strategy (M11)

JanusPrime does **not** require a full clone of the upstream [AssetConverter](https://github.com/MrWizard94-Compile/AssetConverter) repository. Instead:

| Layer | In JanusPrime git? | Purpose |
|-------|-------------------|---------|
| **Pipeline** (`ac.py`, `config/`, `pipeline/`, `scripts/`, `docs/`, `data/`, `references/`) | **Yes** — tracked in this repo | CLI, upscale engine, registry, and docs needed for `janus assets` |
| **Sources** (`sources/`) | **No** — gitignored at workspace root | Mod source trees pulled locally via `ac.py pull`; large and machine-specific |
| **Output** (`output/`) | **No** — gitignored | Upscaled textures and built resource packs |
| **Local cache** (`local/`) | **No** — gitignored | JAR downloads, upscale cache, deploy paths |

**Why sparse/vendored?**

- Keeps the JanusPrime monorepo small while preserving a working asset pipeline.
- Avoids committing tens of thousands of mod source files.
- Lets each developer hydrate `sources/` and `output/` on demand without sparse-checkout gymnastics on every clone.

**Initial setup**

```powershell
# From Janus workspace root — sparse clone when pipeline files are missing
.\scripts\setup-assetconverter.ps1
```

If `ac.py` and `pipeline/engine.py` already exist (as in a normal JanusPrime checkout), the script is a no-op.

## Workload manifest (`local_root`)

Authoritative Omni32 workload metadata lives in Project-Janus, not in this folder:

```
Project-Janus/workloads/omni32/manifest.json
```

The manifest's `local_root` points here (`../AssetConverter-sparse`). Aether/Janus workloads reference that manifest; the asset CLI resolves the same path via `janus.config.json` → `components.assets.root`.

## Janus CLI integration

From `Project-Janus/`:

```powershell
pnpm janus assets queue
pnpm janus assets stats
pnpm janus assets run <modId> --build
pnpm janus assets audit <modId>
pnpm janus assets build
```

Config: `janus.config.json` at the Janus workspace root (`components.assets.entry` = `ac.py`).

## Direct pipeline usage

Run from this directory when not going through Janus:

```powershell
python ac.py queue
python ac.py next
python ac.py run <mod_id> --build
```

## Further reading

| Doc | Topic |
|-----|-------|
| `docs/OMNI32.md` | Product vision and pack structure |
| `docs/WORKFLOW.md` | Autonomous and manual workflows |
| `docs/MOD_QUEUE.md` | Upscale priority queue |
| `references/omni32-engine.md` | Engine internals |
| `AGENTS.md` | Agent context for this component |
| `../Project-Janus/workloads/omni32/manifest.json` | Workload `local_root` binding |

Upstream full-repo README and history: [AssetConverter on GitHub](https://github.com/MrWizard94-Compile/AssetConverter).