# Git Branch Strategy — AssetConverter

Research date: 2026-06-19  
Workspace: `C:\Users\Bulkl\OneDrive\Desktop\AssetConverter`  
Remote: `https://github.com/MrWizard94-Compile/AssetConverter.git` (private)

This plan splits a **~500k-file / ~1.4 GB** working tree into reviewable, resumable pushes while keeping a single canonical branch: **`main`**.

---

## Decision summary

| Approach | Verdict | Why |
|----------|---------|-----|
| **Stacked topic branches → merge to `main`** | **Use this** | Disjoint paths (`sources/<mod>/`, `output/assets/<ns>/`) merge cleanly; agents can work in parallel; failed pushes are isolated and retryable. |
| **Git subtree** | **Do not use** | Subtree is for vendoring *live* external repos with ongoing history sync. Your `sources/` trees are snapshot copies with `sources/**/.git/` stripped — no nested remotes to track. |
| **Long-lived `data/*` branches** | **Do not use** | Leaves pipeline code and assets on divergent heads; every `git pull` becomes a multi-branch chore; fights the goal of “everything on `main`”. |
| **Git LFS** | **Optional, not required now** | Total PNG payload is ~250 MB; average PNG is small. Plain Git + `*.png binary` in `.gitattributes` is enough unless individual files approach 50–100 MB. |

---

## Current state (verified 2026-06-19)

| Item | Value |
|------|-------|
| Local `main` tip | `1871797` — pipeline reorg (`config/`, `pipeline/`, `docs/`, `scripts/`) |
| `origin/main` | Behind local by **1 commit** (`1871797` not pushed) |
| Staged (not committed) | Legacy root script deletions + `.gitignore` tweak |
| Untracked locally | `sources/` (87 mods, ~364k files, ~1.08 GB), `output/` (~137k files, ~250 MB) |
| `sources/**/.git/` | Ignored — plain trees, **not** submodules |
| Git LFS | Installed (`3.7.1`); **not** tracking PNGs in root `.gitattributes` |

### Inventory

**`sources/`** — 87 mod folders, ~1 079 MB (largest: `mowziesmobs` 142 MB, `minecolonies` 90 MB, `alexscaves` 78 MB).

**`output/assets/`** — 86 namespaces (~69 853 PNGs, ~127 MB). One fewer than `sources/` because `oh_the_biomes_weve_gone` upscales to namespace `biomeswevegone/`.

**`output/resourcepack/`** — ~67 636 files, ~123 MB (reproducible via `python ac.py build`; still versioned if you want in-game parity on clone).

**`output/comparisons/`**, **`output/experiments/`** — small; bundle with assets or omit (see branch table).

---

## Branch naming convention

```
upload/<phase>-<batch>-<short-label>
```

| Branch | Contains | Approx. size |
|--------|----------|--------------|
| *(no branch — commit on `main`)* | Staged pipeline cleanup | ~24 KB diff |
| `upload/sources-01-mowziesmobs` | `sources/mowziesmobs/` | ~142 MB |
| `upload/sources-02-minecolonies-railways` | `sources/minecolonies/`, `sources/railways/` | ~133 MB |
| `upload/sources-03-alexscaves-aether-mcw` | `sources/alexscaves/`, `sources/aether/`, `sources/mcwdoors/`, `sources/mcwbridges/`, `sources/mcwfences/`, `sources/mcwwindows/`, `sources/mcwroofs/`, `sources/mcwlights/` | ~118 MB |
| `upload/sources-04-eternal-rechiseled` | `sources/eternal_starlight/`, `sources/rechiseled/` | ~104 MB |
| `upload/sources-05-twilight-botania` | `sources/twilightforest/`, `sources/botania/` | ~66 MB |
| `upload/sources-06-create-refined` | `sources/create/`, `sources/refinedstorage/` | ~63 MB |
| `upload/sources-07-mekanism-biomes` | `sources/mekanism/`, `sources/biomesoplenty/` | ~55 MB |
| `upload/sources-08-tconstruct-iceandfire-otbwg` | `sources/tconstruct/`, `sources/iceandfire/`, `sources/oh_the_biomes_weve_gone/` | ~72 MB |
| `upload/sources-09-tech-magic-mid` | `sources/quark/`, `sources/pneumaticcraft/`, `sources/immersiveengineering/`, `sources/ars_nouveau/`, `sources/irons_spellbooks/`, `sources/handcrafted/`, `sources/deeperdarker/` | ~116 MB |
| `upload/sources-10-create-ecosystem` | `sources/chipped/`, `sources/supplementaries/`, `sources/createbigcannons/`, `sources/create_connected/`, `sources/createaddition/`, `sources/create_central_kitchen/`, `sources/create_enchantment_industry/`, `sources/create_hypertube/`, `sources/create_new_age/`, `sources/createoreexcavation/`, `sources/create_jetpack/`, `sources/create_sa/`, `sources/createendertransmission/`, `sources/copycats/`, `sources/sliceanddice/`, `sources/trackwork/`, `sources/bellsandwhistles/`, `sources/interiors/`, `sources/createdeco/` | ~95 MB |
| `upload/sources-11-remaining-mods` | All other `sources/<mod>/` not listed above (39 mods — see § Batch manifest) | ~115 MB |
| `upload/output-assets-a` | `output/assets/` namespaces **a–m** (44 dirs) | ~65 MB |
| `upload/output-assets-b` | `output/assets/` namespaces **n–z** (42 dirs) | ~62 MB |
| `upload/output-extras` | `output/comparisons/`, `output/experiments/` | ~1 MB |
| `upload/output-resourcepack` *(optional)* | `output/resourcepack/Base-Wars_32x/` | ~123 MB |

All 87 `sources/` mods appear in exactly one `upload/sources-*` branch.

---

## Merge order back to `main`

Merge **sequentially** in phase order. Within a phase, order is flexible because paths do not overlap, but sequential merges keep `main` predictable and make “resume from batch N” obvious.

```text
main (1871797 + pipeline cleanup commit)
  │
  ├─► merge upload/sources-01-mowziesmobs
  ├─► merge upload/sources-02-minecolonies-railways
  ├─► merge upload/sources-03-alexscaves-aether-mcw
  ├─► merge upload/sources-04-eternal-rechiseled
  ├─► merge upload/sources-05-twilight-botania
  ├─► merge upload/sources-06-create-refined
  ├─► merge upload/sources-07-mekanism-biomes
  ├─► merge upload/sources-08-tconstruct-iceandfire-otbwg
  ├─► merge upload/sources-09-tech-magic-mid
  ├─► merge upload/sources-10-create-ecosystem
  ├─► merge upload/sources-11-remaining-mods
  ├─► merge upload/output-assets-a
  ├─► merge upload/output-assets-b
  ├─► merge upload/output-extras
  └─► merge upload/output-resourcepack   (optional last)
```

After each merge: `git push origin main`.

You may **delete local and remote upload branches** after their merge to reduce clutter:

```powershell
git branch -d upload/sources-01-mowziesmobs
git push origin --delete upload/sources-01-mowziesmobs
```

---

## Agent parallelism model

Up to **11 agents** can work on `upload/sources-*` branches **at the same time** if each agent:

1. Starts from the same `main` baseline (after Phase 0 push).
2. Only `git add`s paths assigned to their branch (never `git add sources/` wholesale).
3. Pushes only their branch: `git push -u origin upload/sources-NN-...`.
4. Does **not** merge — a coordinator (or you) merges to `main` in § order.

Hand-off template for an agent:

```text
Branch: upload/sources-09-tech-magic-mid
Paths: sources/quark/ sources/pneumaticcraft/ … (full list in table)
Do: git switch -c <branch> main → git add <paths> → commit → push origin <branch>
Do NOT: merge to main, add other sources/, or change pipeline files
```

Output batches (`upload/output-*`) should run **after all sources branches are merged**, because `docs/WORKFLOW.md` treats upscaled assets as a separate commit phase.

---

## Pre-flight (run once)

```powershell
Set-Location "C:\Users\Bulkl\OneDrive\Desktop\AssetConverter"

# Windows long paths (sources trees are deep)
git config core.longpaths true

# Large HTTPS pushes
git config http.postBuffer 524288000

# Confirm clean baseline for data branches
git fetch origin
git status

# Optional: verify no accidental nested .git in sources
Get-ChildItem sources -Recurse -Directory -Filter ".git" -ErrorAction SilentlyContinue
# Expect: no output (ignored by .gitignore anyway)
```

---

## Phase 0 — Land pipeline on `main`

**Goal:** Remote `main` = reorganized pipeline **without** `sources/` or `output/`.

```powershell
Set-Location "C:\Users\Bulkl\OneDrive\Desktop\AssetConverter"

# Commit already-staged legacy cleanup
git commit -m "chore: remove legacy root scripts; finalize pipeline layout"

# Push pipeline reorg (1871797) + cleanup
git push -u origin main
```

Verify on GitHub: `config/`, `pipeline/`, `docs/`, `scripts/` present; **no** `sources/`, **no** `output/`.

---

## Phase 1 — Sources upload branches

### Helper: create one sources branch

Replace `<BRANCH>`, `<PATHS>`, and `<MSG>` per batch.

```powershell
Set-Location "C:\Users\Bulkl\OneDrive\Desktop\AssetConverter"
git switch main
git pull origin main

git switch -c <BRANCH>

git add -- <PATHS>
git commit -m "<MSG>"

git push -u origin <BRANCH>

# Coordinator merges when ready:
git switch main
git pull origin main
git merge --no-ff <BRANCH> -m "merge <BRANCH>: add mod sources"
git push origin main
```

### Batch commands (copy/paste per branch)

**01 — `upload/sources-01-mowziesmobs`**

```powershell
git switch -c upload/sources-01-mowziesmobs main
git add -- sources/mowziesmobs/
git commit -m "data(sources): add mowziesmobs (~142 MB)"
git push -u origin upload/sources-01-mowziesmobs
```

**02 — `upload/sources-02-minecolonies-railways`**

```powershell
git switch -c upload/sources-02-minecolonies-railways main
git add -- sources/minecolonies/ sources/railways/
git commit -m "data(sources): add minecolonies, railways"
git push -u origin upload/sources-02-minecolonies-railways
```

**03 — `upload/sources-03-alexscaves-aether-mcw`**

```powershell
git switch -c upload/sources-03-alexscaves-aether-mcw main
git add -- sources/alexscaves/ sources/aether/ sources/mcwdoors/ sources/mcwbridges/ sources/mcwfences/ sources/mcwwindows/ sources/mcwroofs/ sources/mcwlights/
git commit -m "data(sources): add alexscaves, aether, mcw* set"
git push -u origin upload/sources-03-alexscaves-aether-mcw
```

**04 — `upload/sources-04-eternal-rechiseled`**

```powershell
git switch -c upload/sources-04-eternal-rechiseled main
git add -- sources/eternal_starlight/ sources/rechiseled/
git commit -m "data(sources): add eternal_starlight, rechiseled"
git push -u origin upload/sources-04-eternal-rechiseled
```

**05 — `upload/sources-05-twilight-botania`**

```powershell
git switch -c upload/sources-05-twilight-botania main
git add -- sources/twilightforest/ sources/botania/
git commit -m "data(sources): add twilightforest, botania"
git push -u origin upload/sources-05-twilight-botania
```

**06 — `upload/sources-06-create-refined`**

```powershell
git switch -c upload/sources-06-create-refined main
git add -- sources/create/ sources/refinedstorage/
git commit -m "data(sources): add create, refinedstorage"
git push -u origin upload/sources-06-create-refined
```

**07 — `upload/sources-07-mekanism-biomes`**

```powershell
git switch -c upload/sources-07-mekanism-biomes main
git add -- sources/mekanism/ sources/biomesoplenty/
git commit -m "data(sources): add mekanism, biomesoplenty"
git push -u origin upload/sources-07-mekanism-biomes
```

**08 — `upload/sources-08-tconstruct-iceandfire-otbwg`**

```powershell
git switch -c upload/sources-08-tconstruct-iceandfire-otbwg main
git add -- sources/tconstruct/ sources/iceandfire/ sources/oh_the_biomes_weve_gone/
git commit -m "data(sources): add tconstruct, iceandfire, oh_the_biomes_weve_gone"
git push -u origin upload/sources-08-tconstruct-iceandfire-otbwg
```

**09 — `upload/sources-09-tech-magic-mid`**

```powershell
git switch -c upload/sources-09-tech-magic-mid main
git add -- sources/quark/ sources/pneumaticcraft/ sources/immersiveengineering/ sources/ars_nouveau/ sources/irons_spellbooks/ sources/handcrafted/ sources/deeperdarker/
git commit -m "data(sources): add quark, pneumaticcraft, IE, ars, irons, handcrafted, deeperdarker"
git push -u origin upload/sources-09-tech-magic-mid
```

**10 — `upload/sources-10-create-ecosystem`**

```powershell
git switch -c upload/sources-10-create-ecosystem main
git add -- sources/chipped/ sources/supplementaries/ sources/createbigcannons/ sources/create_connected/ sources/createaddition/ sources/create_central_kitchen/ sources/create_enchantment_industry/ sources/create_hypertube/ sources/create_new_age/ sources/createoreexcavation/ sources/create_jetpack/ sources/create_sa/ sources/createendertransmission/ sources/copycats/ sources/sliceanddice/ sources/trackwork/ sources/bellsandwhistles/ sources/interiors/ sources/createdeco/
git commit -m "data(sources): add create ecosystem + chipped + supplementaries"
git push -u origin upload/sources-10-create-ecosystem
```

**11 — `upload/sources-11-remaining-mods`**

```powershell
git switch -c upload/sources-11-remaining-mods main
git add -- sources/ae2/ sources/actuallyadditions/ sources/another_furniture/ sources/apotheosis/ sources/aquaculture/ sources/artifacts/ sources/brewinandchewin/ sources/comforts/ sources/cookingforblockheads/ sources/draconicevolution/ sources/enderio/ sources/evilcraft/ sources/farmersdelight/ sources/fluxnetworks/ sources/forbidden_arcanus/ sources/industrialforegoing/ sources/integrateddynamics/ sources/jei/ sources/mysticalagriculture/ sources/mysticalagradditions/ sources/occultism/ sources/powah/ sources/productivebees/ sources/railcraft_reborn/ sources/reliquary/ sources/securitycraft/ sources/sophisticatedbackpacks/ sources/sophisticatedstorage/ sources/storagedrawers/ sources/thermal_core/ sources/thermal_expansion/ sources/thermal_foundation/ sources/thermal_innovation/ sources/trashcans/ sources/valkyrienskies/ sources/vs_clockwork/ sources/waystones/ sources/xnet/ sources/ironjetpacks/
git commit -m "data(sources): add remaining 39 mod trees"
git push -u origin upload/sources-11-remaining-mods
```

### Batch manifest — `upload/sources-11-remaining-mods` (39 of 87 total)

`ae2`, `actuallyadditions`, `another_furniture`, `apotheosis`, `aquaculture`, `artifacts`, `brewinandchewin`, `comforts`, `cookingforblockheads`, `draconicevolution`, `enderio`, `evilcraft`, `farmersdelight`, `fluxnetworks`, `forbidden_arcanus`, `industrialforegoing`, `integrateddynamics`, `jei`, `mysticalagriculture`, `mysticalagradditions`, `occultism`, `powah`, `productivebees`, `railcraft_reborn`, `reliquary`, `securitycraft`, `sophisticatedbackpacks`, `sophisticatedstorage`, `storagedrawers`, `thermal_core`, `thermal_expansion`, `thermal_foundation`, `thermal_innovation`, `trashcans`, `valkyrienskies`, `vs_clockwork`, `waystones`, `xnet`, `ironjetpacks`.

### Verify sources complete

```powershell
$expected = 87
$tracked = (git ls-tree -d --name-only origin/main:sources/ 2>$null | Measure-Object).Count
"main sources dirs: $tracked / $expected"
```

---

## Phase 2 — Output assets (after all sources merged)

Split 86 namespaces alphabetically to keep file count per push under ~35k.

**`upload/output-assets-a`** — namespaces from `actuallyadditions` through `mysticalagriculture` (first 44 alphabetically):

```powershell
git switch -c upload/output-assets-a main
$dirs = Get-ChildItem output/assets -Directory | Sort-Object Name | Select-Object -First 44
git add -- ($dirs | ForEach-Object { "output/assets/$($_.Name)/" })
git commit -m "data(output): upscaled assets batch A (44 namespaces)"
git push -u origin upload/output-assets-a
```

**`upload/output-assets-b`** — remaining namespaces:

```powershell
git switch -c upload/output-assets-b main
$dirs = Get-ChildItem output/assets -Directory | Sort-Object Name | Select-Object -Skip 44
git add -- ($dirs | ForEach-Object { "output/assets/$($_.Name)/" })
git commit -m "data(output): upscaled assets batch B (42 namespaces)"
git push -u origin upload/output-assets-b
```

**`upload/output-extras`**

```powershell
git switch -c upload/output-extras main
git add -- output/comparisons/ output/experiments/
git commit -m "data(output): comparisons and experiments"
git push -u origin upload/output-extras
```

Merge all three to `main` in order (a → b → extras), pushing `main` after each.

---

## Phase 3 — Resource pack (optional)

Skip this phase if you only need sources + raw upscaled assets on GitHub; rebuild locally with `python ac.py build`.

```powershell
git switch -c upload/output-resourcepack main
git add -- output/resourcepack/
git commit -m "data(output): Base-Wars_32x resource pack"
git push -u origin upload/output-resourcepack

git switch main
git merge --no-ff upload/output-resourcepack -m "merge upload/output-resourcepack"
git push origin main
```

---

## Phase 4 — Final verification

```powershell
Set-Location "C:\Users\Bulkl\OneDrive\Desktop\AssetConverter"
git fetch origin
git switch main
git pull origin main

# Count top-level sources on remote main
git ls-tree -d --name-only origin/main:sources/ | Measure-Object

# Spot-check a namespace
git ls-tree -d --name-only origin/main:output/assets/ | Select-Object -First 5

# Confirm no legacy root scripts returned
git ls-tree --name-only origin/main | Select-String "run_upscale.py|pull_mod_sources.py"
# Expect: no matches (they live under pipeline/)
```

Expected end state on `origin/main`:

- Full pipeline layout from `1871797` + cleanup commit  
- All **87** `sources/<mod>/` directories  
- All **86** `output/assets/<namespace>/` directories
- Optional `output/resourcepack/`  
- No long-lived `upload/*` branches required (delete after merge)

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `error: RPC failed; HTTP 408` / timeout | Retry push; ensure `http.postBuffer` is 500 MB+; push during off-peak; split batch further. |
| `Filename too long` on Windows | `git config core.longpaths true`; enable Win32 long paths in Group Policy if needed. |
| `nothing to commit` on branch | Paths already on `main` or wrong working directory; run `git status` and confirm branch base is post–Phase 0 `main`. |
| Merge conflict on `main` | Should not happen if batches respect disjoint paths. If it does: `git merge --abort`, rebase batch onto latest `main`, recommit. |
| Accidental `git add sources/` | `git reset HEAD` before commit; never commit whole `sources/` in one shot on `main`. |
| Push rejected (non-fast-forward) | Coordinator merged another batch first; `git pull origin main`, recreate branch from updated `main`, cherry-pick or re-add paths. |
| GitHub “large file” rejection | Single file > 100 MB — add that pattern to Git LFS (see `references/github-private-repo.md`). |

### Resume after a failed push

```powershell
git switch upload/sources-06-create-refined
git push -u origin upload/sources-06-create-refined
# Git resumes where possible; if commit never landed locally, re-run git add + commit only for missing paths
```

---

## Stacked PRs on GitHub (no `gh` CLI)

1. Push each `upload/*` branch (commands above).  
2. On GitHub: **Compare & pull request** → base: `main`, compare: `upload/sources-NN-...`.  
3. Title: `data(sources): batch NN — <label>`.  
4. Merge with **Create a merge commit** (not squash — keeps one commit per batch for easier bisect).  
5. Pull locally: `git pull origin main` before starting the next local merge.

---

## Quick reference — branch list

1. `upload/sources-01-mowziesmobs`  
2. `upload/sources-02-minecolonies-railways`  
3. `upload/sources-03-alexscaves-aether-mcw`  
4. `upload/sources-04-eternal-rechiseled`  
5. `upload/sources-05-twilight-botania`  
6. `upload/sources-06-create-refined`  
7. `upload/sources-07-mekanism-biomes`  
8. `upload/sources-08-tconstruct-iceandfire-otbwg`  
9. `upload/sources-09-tech-magic-mid`  
10. `upload/sources-10-create-ecosystem`  
11. `upload/sources-11-remaining-mods`  
12. `upload/output-assets-a`  
13. `upload/output-assets-b`  
14. `upload/output-extras`  
15. `upload/output-resourcepack` *(optional)*

**Strategy:** stacked topic branches, sequential merge to `main`, parallel agent pushes on disjoint `sources/` paths, no subtree, no permanent data branches.