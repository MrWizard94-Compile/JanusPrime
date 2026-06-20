# Phase 4 — Theia IDE Integration (Scaffold)

**Status:** Deferred — architecture outline only; no IDE implementation in this repo yet.  
**Source:** [SOUL.md §10](../SOUL.md) (Proposed Evolutions), [AETHER_ARCHITECTURE.md](../Project-Janus/AETHER_ARCHITECTURE.md) (Phase 2 — Theia Integration)

---

## Purpose

Move the JanusPrime workflow from CLI + MCP stdio into a **custom Theia product** that surfaces orchestration, execution, and validation in one IDE shell. Phases 0–3 (orchestrator, memory, assets, autonomous loop) remain the backend; Phase 4 is the **human-facing control plane**.

Today, agents use:

- `janus` CLI for status, briefs, loops, and doctrine
- Task-scoped MCP (`@aether/mcp-server`) for doctrine, brief, repair, and memory query
- Validation Kernel receipts in `Project-Janus/.aether/`

Phase 4 wraps those same contracts in Theia views and editors without changing SOUL invariants.

---

## Architecture Outline

```
┌─────────────────────────────────────────────────────────────┐
│                 Theia Custom IDE (JanusPrime)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Ghost Buffer │  │ Phantom      │  │ Validation       │  │
│  │ (Claude /    │  │ Cursor       │  │ Dashboard        │  │
│  │ orchestrator)│  │ (Grok / exec)│  │                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ MCP + REST (existing Janus APIs)
┌──────────────────────────▼──────────────────────────────────┐
│ Project-Janus orchestrator │ Smart-Library │ AssetConverter  │
│ Validation Kernel        │ REL cognition (optional)         │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Role in Phase 4 |
|-------|-----------------|
| **Theia shell** | Workbench, editors, LSP proxy, AI chat panels |
| **Ghost Buffer** | Orchestrator-side staging — proposals visible before disk write |
| **Phantom Cursor** | Executor-side ghost edits — Grok output held until validation passes |
| **Validation Dashboard** | Live rule results, receipts, repair context, loop rollup |
| **Backend** | Unchanged: task queue, `janus brief`, MCP resources, heal sandbox |

---

## Ghost Buffer (Orchestrator Staging)

**Concept:** A read/write staging surface where Claude (or the orchestrator agent) assembles plans, task specs, and patch proposals **without mutating the workspace** until the Validation Kernel accepts them.

| Behavior | Today (pre-Theia) | Phase 4 target |
|----------|-------------------|----------------|
| Patch proposals | `patch submit` → kernel → accept/reject | Same pipeline; UI shows diff + rule IDs before apply |
| Task context | `janus brief`, `doc:soul`, `doc:rel-state` | Side panel bound to `janus://task/<id>/brief` |
| Doctrine | `janus://doctrine/soul` MCP resource | Pinned SOUL excerpt with freshness indicator |
| Acceptance | Orchestrator `accepted` status in queue | Explicit “release to filesystem” action in Ghost Buffer |

**Invariant (SOUL §1, §5):** Nothing reaches disk without passing validation — Ghost Buffer is a **UI affordance** over the existing gate, not a bypass.

---

## Phantom Cursor (Executor Ghost Edits)

**Concept:** Grok (or executor agents) edit a **phantom layer** — proposed file content shown in the editor — while the Validation Kernel runs on the proposal. On pass, changes merge to the real buffer/worktree; on fail, structured errors feed repair context.

| Behavior | Today | Phase 4 target |
|----------|-------|----------------|
| Executor input | Token-capped `janus brief` | Inline brief + files_in_scope in editor chrome |
| Validation feedback | `janus repair`, `task.result.validation_errors` | Inline markers + Validation Dashboard |
| Parallel work | Git worktrees per task | Theia multi-root / worktree-aware file tree |
| MCP binding | `AETHER_TASK_ID` scopes MCP server | Theia session binds one task id per executor panel |

**Invariant (SOUL §3):** Executors never receive full SOUL + architecture dumps — Phantom Cursor panels consume the same capped brief JSON the CLI produces today.

---

## Validation Dashboard

**Concept:** A dedicated Theia view for **deterministic validation state** — rule pack results, layer timing, heal attempts, and loop round rollup.

| Data source | URI / command |
|-------------|---------------|
| Last validation receipt | Task record in `.aether/` |
| Repair context | `janus://task/<id>/repair` |
| Profile rules | `neoforge-mixin-v1`, `typescript-v1`, `asset-audit-v1`, `python-sandbox-v1` |
| System health | `janus://system/status`, `janus status` |
| Memory heal trail | Smart-Library `/execute-heal` reports (python-sandbox path) |

Planned widgets:

1. **Rule timeline** — SOUL001–004 + profile rules with pass/fail and suggestions  
2. **Receipt inspector** — JSON receipt linked to git worktree path  
3. **Loop progress** — parent/child rollup from autonomous loop  
4. **Asset gate** — Omni32 queue status via `janus://assets/queue`

---

## Deferred Implementation

The following are **explicitly out of scope** until Phase 4 engineering starts:

- Theia product packaging, extensions, and branding
- LSP proxy hardening beyond current JDTLS worktree integration
- Ghost Buffer / Phantom Cursor editor plugins
- Validation Dashboard UI components
- Theia AI provider wiring (Claude vs Grok role separation in-panel)
- Embedded terminal replacing `janus` CLI (CLI remains supported)

**Prerequisites before build:**

- [x] Stable MCP resource surface (`janus-resources.ts`)
- [x] Autonomous loop + validation kernel in production use
- [x] `e2e:services` / `e2e:sandbox` probes for backend health
- [x] **Workload registry** — all `C:\Projects` repos + Janus internals registered in `workloads/registry.json` (sync via `node Project-Janus/scripts/sync-workload-manifests.mjs`)
- [ ] Theia fork / product template repository
- [ ] UX spec for Ghost Buffer ↔ Phantom Cursor handoff
- [ ] **Workload picker** — open project → bind `AETHER_TASK_ID` → terminal runs `janus loop run` against registered `local_root`

---

## References

| Doc | Relevance |
|-----|-----------|
| [SOUL.md §10](../SOUL.md) | Roadmap checkbox — Phase 4 Theia IDE |
| [unified-architecture.md](./unified-architecture.md) | Component map and MCP resource table |
| [AETHER_ARCHITECTURE.md](../Project-Janus/AETHER_ARCHITECTURE.md) | Original Ghost Buffer / Phantom Cursor diagram |
| [observability.md](./observability.md) | Operational probes until Dashboard exists |

---

*This scaffold satisfies audit Phase 4 documentation debt. Implementation remains deferred per SOUL §10.*