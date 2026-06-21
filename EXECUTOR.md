# EXECUTOR.md — Grok Pre-Flight Gate

**Role:** Executor (Grok). **Doctrine:** [CLAUDE.md](CLAUDE.md). **Handoff:** [Project-Janus/docs/phase0/handoff-protocol.md](Project-Janus/docs/phase0/handoff-protocol.md).

This file is the mandatory checklist before any filesystem mutation in JanusPrime workspaces.

---

## Session Start (every conversation)

1. Read `CLAUDE.md` (`doc:claude`) — invariants §1, validation §5, anti-patterns §8.
2. Read `Project-Janus/docs/phase0/handoff-protocol.md` (`doc:handoff-protocol`).
3. Run system health:

```powershell
& "$env:JANUS_CLI" status
& "$env:JANUS_CLI" doctrine status
```

4. If `doctrine.status.fresh` is false, run:

```powershell
& "$env:JANUS_CLI" doctrine seed
```

5. Obtain a **task id** before coding:
   - Orchestrated work: parent already exists; use child task id.
   - Ad-hoc fix: stop — ask orchestrator to create a task, or run `aether task create`.

6. Load executor brief (never full CLAUDE + architecture dump):

```powershell
& "$env:JANUS_CLI" brief -t <taskId>
```

---

## Mutation Gate (non-negotiable)

| Action | Allowed path |
|--------|----------------|
| Mod / Java / TS code | `aether patch submit` → receipt → `--apply` |
| Identity retrofit | `aether orchestrate run` or `aether execute run -t <id>` |
| Omni32 textures | `janus assets audit|run|build` |
| Instance configs (CurseForge) | Reference templates in `packs/` only — deploy via orchestrator pack task |
| Memory writes | `janus seed` after task `accepted` only |

**Never:** direct `Write`/`StrReplace` on workload repos, `mods/`, or instance `config/` without a task id and validation receipt.

---

## Patch Flow (manual children)

```powershell
aether worktree prepare -t <taskId>
aether patch submit -f patch.json          # dry-run validate
aether patch submit -f patch.json --apply  # apply with receipt
& "$env:JANUS_CLI" seed -t <taskId>        # seed accepted pattern
```

On validation failure:

```powershell
& "$env:JANUS_CLI" repair -t <taskId>
```

Revise patch; resubmit until pass or abandon.

---

## Warnings = Failures (CLAUDE §1.7)

Compiler warnings, LSP warnings, and deprecation warnings are **blocking**. Fix root cause before apply.

---

## Canonical CLI

Set once per PowerShell session (or add to your profile):

```powershell
$env:JANUS_CLI = "node C:\Projects\Janus\Project-Janus\packages\cli\dist\bin.js"
```

Shorthand after `$env:JANUS_CLI` is set:

```powershell
& $env:JANUS_CLI status
& $env:JANUS_CLI brief -t task-...
node C:\Projects\Janus\Project-Janus\packages\cli\dist\bin.js orchestrate plan -f examples/orchestration/...
```

Global `janus` npm shim may point at a stale path. Prefer `$env:JANUS_CLI` or `scripts/janus.ps1`.

---

## Workload Map

| Workload | Path | Profile |
|----------|------|---------|
| nodecore | `C:\Projects\Node Core` | neoforge-mixin-v1 |
| omni32-loader | `C:\Projects\Omni32_Loader` | neoforge-mixin-v1 |
| omni32 | `C:\Projects\AssetConverter` | asset-audit-v1 |

Registry: `workloads/registry.json`

---

## Retrofit Pattern (rogue work already on disk)

When code landed outside the gate:

1. Orchestrator authors identity plan with `files_in_scope` listing every changed file.
2. `aether orchestrate plan -f <plan.json>`
3. `aether orchestrate run -t <parentId>`
4. `janus seed -t <childId>` per accepted child.

**Profile:** Base Wars Forge mods (Node Core, Omni32 Loader) use `forge-mod-v1`, not `neoforge-mixin-v1`.

**Revert safety:** Failed validation reverts only patched paths (not whole-repo `git clean`). Commit or stash before gate runs if experimenting outside `files_in_scope`.

---

*Machine refs: `doc:claude`, `doc:handoff-protocol`, `janus://doctrine/claude`, `janus://task/<id>/brief`*