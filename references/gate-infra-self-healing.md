# Gate-Infra Self-Healing — the blind spot this session exposed

**Date:** 2026-06-20 · **Trigger:** 7 validation-harness bugs were fixed *manually by the orchestrator* during the Base Wars build, when a self-healing system should have fixed them itself.

## The bugs (all harness, none executor output)

| # | Bug | Layer | Manual fix |
|---|-----|-------|-----------|
| GATE-1 | root had no `typecheck` script → `typescript-v1` build couldn't run at workspace root | build | root `package.json` delegation |
| GATE-2 | `prepareWorktreeDependencies` installed at worktree root, not nested `Project-Janus/` pnpm workspace | provision | `resolvePnpmRoot` |
| GATE-3 | `worktree create --base` reused a stale worktree instead of rebasing | provision | `--recreate` + branch reset |
| GATE-4 | Windows `git worktree remove` fails on trees with `node_modules`/`build/` | teardown | rm -rf fallback + prune |
| GATE-5 | build layer ran `gradlew.bat` without `.\` (Windows cmd can't find it) | build | `.\gradlew.bat` |
| GATE-6 | `prepare` ran `gradlew.bat` without `.\` (same, different file) | provision | `.\gradlew.bat` |
| GATE-7 | `setup jdtls` tar read `C:\...` as a remote host (`Cannot connect to C:`) | setup | `tar --force-local` |
| (+) | `forge-mod-v1` lacked the `ast` layer; `lsp` no-op'd with no JDT.LS installed | coverage | add `ast`; install JDT.LS |

## Why the self-repair loop didn't catch any of them

JanusPrime's self-repair loop (`autonomous-loop.ts` + `claude-auto-fix.ts` + memory retrieval) heals **executor output** — when an executor's *patch* fails validation (CLAUDE rules, type errors), it retrieves memory fixes, applies regex auto-fixes, and retries the patch.

**Every bug above was a failure of the validation HARNESS ITSELF, not of any patch.** The gate's own tooling (build commands, worktree provisioning, tool setup, profile coverage) was broken. When the harness breaks, the failure surfaces as a *gate failure* — and the loop has **no classifier to distinguish "the executor's patch is bad" from "my own gate is broken."** It would blame the patch and retry, which never fixes a harness bug. So the loop is structurally blind to this class, and it falls to a human/orchestrator.

**The one-line statement of the gap:** *The system can heal what it validates, but not what it validates with. The validator cannot validate itself.*

The irony: the orchestrator ran the self-heal loop seven times by hand — diagnose error → patch the kernel → rebuild → re-validate → (should) seed. That IS the loop; it was just run by a human because the system has no path to repair its own infrastructure.

## The evolution to close it

1. **Infra-failure classifier (kernel).** Tag a layer failure as `harness_infra` (vs `executor_output`) when it matches infra signatures: `ENOENT` / exit 127 / "not recognized", "Cannot connect to", "node_modules missing", `ran:false` (tool not configured), "Directory not empty", build-command-not-found, profile-layer-missing.
2. **Route `harness_infra` to self-heal-the-kernel.** Instead of retrying the executor patch, open a self-repair task on JanusPrime's *own* code (Project-Janus), diagnose, patch the kernel/setup, run it through the TypeScript gate, accept, rebuild. Dogfooded repair of the validator.
3. **Seed `Gate-Infra Repair` patterns to memory.** The 7 fixes above are the seed corpus (e.g. `tar "Cannot connect to C:" → --force-local`). Recurrences auto-match instead of re-deriving.
4. **Harness pre-flight (`janus doctor`).** Before running executor tasks, verify: build commands resolve per-platform, required tools installed (JDT.LS), worktree provisioning round-trips, profiles include intended layers. Catch infra breakage proactively, not via a failed executor task.

## Status
- All 7 fixed manually + committed (PR #1, PR #2). AST layer added to `forge-mod-v1`; JDT.LS install repaired.
- The self-healing capability above is **not yet built** — proposed as the next JanusPrime self-improvement task. This document is its brief.
