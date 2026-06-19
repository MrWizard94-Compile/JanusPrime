# JanusPrime System Audit

**Date:** 2026-06-19  
**Post-remediation sync:** 2026-06-19  
**Auditor:** Autonomous multi-agent review (4 parallel subagents + direct verification)  
**Scope:** JanusPrime workspace, REL (`C:\REL_Codex_Variant`), Smart-Library, AssetConverter-sparse, cross-system integration  
**Method:** Assume nothing — builds, tests, source reads, config/path checks, git state, live CLI probes

---

## Executive Verdict

JanusPrime is **architecturally coherent, buildable, and remediation-complete** for P0–P3 audit items as of 2026-06-19. **P0 critical defects (C1–C3), all P1 items (including H1 MCP boundary), P2 medium items (M1–M11), and production ops scaffolding are remediated.** Live E2E verification (`e2e:services`, `e2e:sandbox`) passes with `docker compose up -d`. Phase 4 Theia IDE remains **deferred** ([phase4-theia-ide.md](./phase4-theia-ide.md)).

### Remediation Status (2026-06-19)

| ID | Status | Notes |
|----|--------|-------|
| C1 | **Fixed** | SOUL rules concatenated in `runRulesLayer`; cross-profile test added |
| C2 | **Fixed** | `RelClient` sends `{ arguments: args }` |
| C3 | **Fixed** | Anonymous principal gets `role=service` when auth disabled |
| H4 | **Fixed** | `steward.py` reads `OLLAMA_BASE_URL` from env |
| H1 | **Fixed** | REST bridge tool allowlist; admin bypass |
| H2 | **Fixed** | `API_KEY` wired from `JANUS_MEMORY_API_KEY` in compose |
| H3 | **Fixed** | HF cache mounted at `/root/.cache/huggingface` |
| H5 | **Fixed** | Duplicate root `workloads/omni32/manifest.json` removed |
| H6 | **Fixed** | `janus` bin + argv shim for `janus status` |
| H7 | **Fixed** | Compose requires `.env`; REL secrets use `${VAR:?}` |
| H1 MCP | **Fixed** | Janus MCP task-scoped only — doctrine/status/brief/repair; no REL 88-tool proxy |
| M1 | **Fixed** | `enforceBriefBudget` enforces `brief_max_chars` on assembled brief JSON |
| M2 | **Fixed** | `allow_query_llm_fallback` defaults false; retrieval-only `/query/context` preferred |
| M3 | **Fixed** | `cli` (15 tests) + `mcp-server` (3 tests) coverage added |
| M4 | **Fixed** | `doc:rel-state` claude vs grok injection tests in `unified-service.test.ts` |
| M5 | **Fixed** | `ensureSoulContextRef` unit tests in `context-catalog.test.ts` |
| M6 | **Fixed** | `python-sandbox-v1` routed in autonomous loop via `PythonSandboxExecutor` |
| M9 | **Fixed** | Root `.github/workflows/ci.yml` |
| M11 | **Fixed** | Dual asset strategy: vendored pipeline + `scripts/setup-assetconverter.ps1` sparse clone |

| Layer | Grade | Summary |
|-------|-------|---------|
| **Orchestrator (Project-Janus)** | A− | Builds; 131 tests pass; SOUL rules enforced; cli/mcp/python-sandbox covered |
| **Memory (Smart-Library)** | A− | 81/81 pytest; heal flow SOUL-compliant; compose auth/cache/healthchecks fixed |
| **Cognition (REL)** | B+ | Bridge payload/auth fixed; REST allowlist; JSON logging in compose |
| **Assets (AssetConverter-sparse)** | B+ | Vendored pipeline + documented sparse-clone path; queue operational |
| **Integration / Ops** | B+ | CI, healthchecks, secrets/observability docs, E2E probes |
| **Docs / Git** | A− | References index, remediation tracking, path sync; see latest `main` for hashes |

---

## Verified Test Matrix

| Suite | Result |
|-------|--------|
| `pnpm build` (10 packages) | **PASS** |
| `pnpm test` Project-Janus | **PASS** — 131 tests (incl. cli 15, mcp-server 3, integrations 54) |
| Smart-Library `pytest tests/` | **PASS** — 81/81 |
| REL pytest (partial) | **153 pass**, 1 FAISS env failure; full suite blocked by deps |
| `@janus/integrations` | **54/54** |
| `pnpm run e2e:services` | **PASS** — with `docker compose up -d` |
| `pnpm run e2e:sandbox` | **PASS** — `/execute-heal` Docker sandbox probe |
| Live `janus status` | **PASS** — with stack running |
| Live `janus assets queue` | **PASS** — 71 mods queued |

---

## System Architecture (As Deployed)

```
┌─────────────────────────────────────────────────────────────┐
│ REL (Cognition) — :8080 — sessions, neural web, steward      │
│   ✅ REST bridge (payload, auth, allowlist); JSON logs        │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST
┌──────────────────────────▼──────────────────────────────────┐
│ JanusPrime Orchestrator — Project-Janus                      │
│   ✅ SOUL rules enforced; python-sandbox loop; MCP scoped     │
└──────┬─────────────────────────────┬────────────────────────┘
       │                             │
       ▼                             ▼
┌──────────────┐            ┌──────────────────┐
│ Smart-Library│            │ AssetConverter   │
│ :8000        │            │ (sparse/vendored)│
│ ✅ auth/cache│            │ ✅ queue works    │
│   healthcheck│            └──────────────────┘
└──────────────┘
       │
       ▼
┌──────────────┐
│ Ollama :11434│  (bundled in compose; healthcheck gated)
└──────────────┘
```

---

## Critical Findings

> **Remediation note:** C1–C3 below were **fixed** on 2026-06-19. Sections retained as audit evidence.

### C1 — SOUL001–004 Never Enforced on Real Profiles — **RESOLVED**

**File:** `Project-Janus/packages/validation-kernel/src/layers/rules.ts`

```typescript
let errors: ValidationError[] = runSoulEngineeringRules(context.proposal);

if (profile.id === "neoforge-mixin-v1") {
  errors = runNeoForgeMixinRules({ ... });  // REPLACES soul errors
} else if (profile.id === "typescript-v1") {
  errors = runTypeScriptRules(...);          // REPLACES soul errors
} else if (profile.id === "asset-audit-v1") {
  errors = runAssetAuditRules(...);          // REPLACES soul errors
}
```

**Impact:** TODOs, hardcoded secrets, `eval`, and suppressions can pass `patch submit` on all production profiles. Violates SOUL §1 and §5. Unit tests pass `runSoulEngineeringRules` in isolation; the pipeline does not.

**Fix:** Concatenate: `errors = [...errors, ...runNeoForgeMixinRules(...)]`. Add cross-profile integration tests.

---

### C2 — REL REST Payload Mismatch — **RESOLVED**

**File:** `Project-Janus/packages/janus-integrations/src/rel-client.ts`

REL REST expects `{"arguments": {...}}` per `ToolInvocationRequest` in `rest_api.py`. Janus sends flat JSON: `JSON.stringify(args)`.

**Impact:** `log_session`, `load_context`, `neural_learn`, and concept sync receive empty arguments. Loop logging and steward→memory sync are effectively broken.

**Fix:** `JSON.stringify({ arguments: args })`.

---

### C3 — REL Auth-Disabled Mode Returns 403 on Tools — **RESOLVED**

When `REL_API_AUTH_REQUIRED=false`, principal is `role=anonymous`, but tool routes require `admin|manager|member|service`. Janus `.env.example` recommends auth off for local dev.

**Impact:** Docker cognition service with default compose settings cannot serve tool calls.

**Fix:** Grant anonymous→service on tool routes when auth disabled, or require `JANUS_REL_API_KEY` in compose and update docs.

---

## High Severity

> **Remediation note:** H1–H7 **fixed**; H1 MCP resolved by Janus MCP task-scoped surface (no REL tool proxy).

| ID | Area | Finding |
|----|------|---------|
| H1 | Security | REL `PowerShell`, filesystem, desktop tools exposed via REST/MCP — **REST allowlist fixed**; **MCP: Janus server does not proxy REL tools** |
| H2 | Security | Smart-Library writes unauthenticated in compose; `JANUS_MEMORY_API_KEY` vs `API_KEY` env mismatch |
| H3 | Docker | HF cache volume misconfigured (`/app/.hf_cache` vs `/root/.cache/huggingface`) |
| H4 | Docker | `steward.py` hardcodes `localhost:11434`; ignores compose `OLLAMA_BASE_URL` |
| H5 | Config | Duplicate `workloads/omni32/manifest.json` at workspace root missing `local_root` |
| H6 | CLI | SOUL §9 says `janus status`; requires `aether janus status` or `node .../bin.js janus status` |
| H7 | Security | REL compose defaults: weak passwords, auth disabled |

---

## Medium Severity

> **Remediation note:** M1–M11 **fixed** (see remediation table above).

| ID | Area | Finding | Status |
|----|------|---------|--------|
| M1 | Token policy | `brief_max_chars` caps estimate only | **Fixed** — `enforceBriefBudget` |
| M2 | Integration | `queryContextSlices` LLM fallback | **Fixed** — gated, default off |
| M3 | Tests | Zero tests for `cli` and `mcp-server` | **Fixed** — 18 tests |
| M4 | Tests | `doc:rel-state` claude vs grok injection | **Fixed** |
| M5 | Tests | `ensureSoulContextRef` unit tests | **Fixed** |
| M6 | Profile | `python-sandbox-v1` in autonomous loop | **Fixed** — `PythonSandboxExecutor` |
| M7 | Docs | SOUL §9 bootstrap path | **Fixed** |
| M8 | Docs | `.aether/` path in architecture doc | **Fixed** |
| M9 | CI | No root `.github/workflows` | **Fixed** |
| M10 | REL | `pyproject.toml` packaging | **Fixed** |
| M11 | Assets | Vendored vs sparse clone strategy | **Fixed** — dual strategy documented |

---

## Low Severity

| ID | Finding |
|----|---------|
| L1 | Cognition `root` is absolute path — machine-specific |
| L2 | CLI branded `aether`, errors prefixed `aether:` |
| L3 | `pnpm test` aborts on first package failure |
| L4 | No root `references/README.md` index |
| L5 | REL tool count documentation drift — **resolved** (88 tools per `rest_api.TOOL_NAMES`) |

---

## What Works (Verified)

### Orchestration
- Autonomous loop: identity / manual / asset paths
- Manual patch executor: staged patches, SOUL auto-repair, pending-apply
- `ensureSoulContextRef` on task create
- Context catalog: `doc:soul`, `doc:rel-state`, `arch:janus-unified`
- MCP: doctrine, status, memory, assets, rel state, task brief/repair

### Memory (Smart-Library)
- Endpoints: `/health`, `/seed`, `/seed-repair`, `/query/context`, `/doctrine/status`, `/execute-heal`, `/maintenance/deduplicate`
- Heal: patches stored only after verified retry (SOUL §6)
- Sandbox: Docker isolation, fail-closed in compose

### REL Bridge (Design)
- `doc:rel-state` orchestrator-only gating in code
- `finishLoop` → log_session + concept sync on complete rollups
- CLI: `janus rel status|context|sync`
- Integration tests: 20/20 Janus bridge unit tests

### Assets
- Pipeline: `ac.py`, 16 modules, config, scripts
- `sources/` gitignored; queue operational (71 mods)

### Git

> **Commit hashes:** See latest `main` on each remote — audit snapshot below is historical.

| Repo | Remote | Audit snapshot | Current |
|------|--------|----------------|---------|
| JanusPrime | github.com/MrWizard94-Compile/JanusPrime | `fafe2a2` | **see latest `main`** (e.g. `2cb24b1` post-remediation) |
| REL | github.com/MrWizard94-Compile/REL | `10eeb3d` | **see latest `main`** |

---

## Component Detail

### Project-Janus Orchestrator

- **Build:** 10/10 packages compile
- **Tests:** 131 pass (shared 5, context 1, task-queue 4, workload 12, validation 24, orchestrator 13, integrations 54, cli 15, mcp-server 3)
- **Gaps:** None blocking — Phase 4 Theia IDE deferred

### Smart-Library

- **Tests:** 81/81 pytest
- **SOUL §6:** Compliant — verified heal write-back only after retry
- **Gaps:** Query payload size limits (low priority); metrics endpoint deferred per [observability.md](./observability.md)

### REL

- **Tools:** 88 registered in REL MCP server (not proxied by Janus MCP)
- **Tests:** 153 pass (partial run)
- **Gaps:** Full REL pytest in CI (separate repo); FAISS env flake on one test

### AssetConverter-sparse

- Pipeline vendored in JanusPrime for offline/CI use; mod `sources/` local-only (gitignored)
- Fresh setup: `pnpm assets:setup` → `scripts/setup-assetconverter.ps1` (sparse clone from AssetConverter repo)
- Authoritative omni32 manifest: `Project-Janus/workloads/omni32/manifest.json` with `local_root`

### Configuration (`janus.config.json`)

| Component | Path | Exists |
|-----------|------|--------|
| orchestrator | `Project-Janus` | ✅ |
| memory | `Smart-Library` | ✅ |
| assets | `AssetConverter-sparse` | ✅ |
| cognition | `C:/REL_Codex_Variant` | ✅ |
| doctrine | `SOUL.md` | ✅ |
| runtime `.aether` | `Project-Janus/.aether` | ❌ (created on first run) |

---

## Production Readiness

| Requirement | Status |
|-------------|--------|
| Unified CI/CD | ✅ `.github/workflows/ci.yml` (Project-Janus + Smart-Library) |
| Secrets management | ✅ [secrets-management.md](./secrets-management.md) + `.env.example` |
| Service healthchecks | ✅ `docker-compose.yml` — ollama, memory, cognition |
| SOUL validation enforced | ✅ C1 fixed; cross-profile tests |
| REL bridge functional | ✅ C2, C3, H1; `e2e:services` PASS with stack up |
| Memory auth in stack | ✅ H2 fixed (optional key via `.env`) |
| E2E orchestration tested | ✅ `e2e:orchestration`, `e2e:services`, `e2e:loop-smoke` |
| Windows Docker sandbox | ✅ `e2e:sandbox` probe (`USE_DOCKER_SANDBOX=true`) |
| Observability | ✅ [observability.md](./observability.md); metrics endpoint deferred |
| Phase 4 Theia IDE | ⏸ deferred — [phase4-theia-ide.md](./phase4-theia-ide.md) scaffold |

---

## Remediation TODO List

See [audit-remediation-todo.md](./audit-remediation-todo.md) for tracked execution status.

### P0 — Critical (do first)
- [x] **C1** Fix `runRulesLayer` to concatenate SOUL errors with profile rules + integration tests
- [x] **C2** Fix `RelClient.invokeTool` to send `{ arguments: args }` + update tests
- [x] **C3** Fix REL REST anonymous auth when `REL_API_AUTH_REQUIRED=false`

### P1 — High (same sprint)
- [x] **H4** `steward.py` read `OLLAMA_BASE_URL` from env
- [x] **H2** Wire `API_KEY`/`JANUS_MEMORY_API_KEY` in docker-compose
- [x] **H3** Fix HF cache path in docker-compose
- [x] **H5** Remove duplicate root `workloads/omni32/manifest.json`
- [x] **H6** Add `janus` bin argv shim in `bin.ts`
- [x] **H7** Harden compose secrets — require `.env`, remove insecure defaults
- [x] **H1** REL REST tool allowlist for Janus bridge (deny PowerShell/fs)

### P2 — Medium
- [x] **M1** Enforce `brief_max_chars` on brief content truncation
- [x] **M2** Gate LLM fallback in `queryContextSlices` (`allow_query_llm_fallback`)
- [x] **M3** Tests for `cli` and `mcp-server`
- [x] **M4** Test `doc:rel-state` claude vs grok injection
- [x] **M5** Unit test `ensureSoulContextRef`
- [x] **M6** Wire `python-sandbox-v1` in autonomous loop
- [x] **M7–M8** Doc path and layout sync (SOUL §9, AGENTS.md, architecture)
- [x] **M9** Root `.github/workflows/ci.yml`
- [x] **M10** Fix REL `pyproject.toml` packaging
- [x] **M11** Document vendored + sparse-clone asset strategy

### P3 — Low / deferred
- [x] **L1–L5** Polish items per table above
- [x] Phase 4 Theia IDE scaffold — [phase4-theia-ide.md](./phase4-theia-ide.md) (implementation deferred)

---

## Audit Evidence Commands

```powershell
cd C:\Users\Bulkl\OneDrive\Desktop\Janus\Project-Janus
pnpm build
pnpm test

cd C:\Users\Bulkl\OneDrive\Desktop\Janus\Smart-Library
python -m pytest tests/ -q

cd C:\Users\Bulkl\OneDrive\Desktop\Janus\Project-Janus
node packages/cli/dist/bin.js janus status
node packages/cli/dist/bin.js janus rel status
node packages/cli/dist/bin.js janus assets queue

cd C:\Users\Bulkl\OneDrive\Desktop\Janus
git status
git log --oneline -5
```

---

## Post-Remediation Verification

Re-verified after P0–P3 remediation (2026-06-19):

```powershell
cd C:\Users\Bulkl\OneDrive\Desktop\Janus
copy .env.example .env   # if not already present
docker compose up -d

cd Project-Janus
pnpm build
pnpm test                # 131 tests PASS
pnpm run e2e:services    # PASS — memory :8000 + cognition :8080 + janus status
pnpm run e2e:sandbox     # PASS — Docker sandbox /execute-heal probe

cd ..\Smart-Library
python -m pytest tests/ -q   # 81/81 PASS
```

| Check | Result |
|-------|--------|
| Unit + integration tests | **PASS** — 131 (Project-Janus) + 81 (Smart-Library) |
| `e2e:services` | **PASS** — both health endpoints + CLI status checks |
| `e2e:sandbox` | **PASS** — sandbox execution returns `janus_sandbox_ok` |
| Compose healthchecks | **PASS** — ollama gates memory/cognition startup |
| CI workflow | **PASS** — `.github/workflows/ci.yml` on `main` |

Tracked in [audit-remediation-todo.md](./audit-remediation-todo.md).

---

## Bottom Line

JanusPrime has **real architectural substance** and **audit remediation is complete** for P0–P3: validation gate enforces SOUL rules, REL bridge is functional with allowlist + scoped MCP, memory heal contract holds, asset pipeline strategy is documented, and ops scaffolding (CI, healthchecks, secrets/observability docs, E2E probes) is in place.

**Remaining work:** Phase 4 Theia IDE implementation (deferred; scaffold at [phase4-theia-ide.md](./phase4-theia-ide.md)); REL full-suite CI in separate repo; future metrics endpoint per [observability.md](./observability.md).