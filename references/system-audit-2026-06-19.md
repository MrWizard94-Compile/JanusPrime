# JanusPrime System Audit

**Date:** 2026-06-19  
**Auditor:** Autonomous multi-agent review (4 parallel subagents + direct verification)  
**Scope:** JanusPrime workspace, REL (`C:\REL_Codex_Variant`), Smart-Library, AssetConverter-sparse, cross-system integration  
**Method:** Assume nothing — builds, tests, source reads, config/path checks, git state, live CLI probes

---

## Executive Verdict

JanusPrime is **architecturally coherent and buildable**. **P0 critical defects (C1–C3) and most P1 items are remediated** as of 2026-06-19. The full stack has **not** been verified end-to-end with all Docker services running.

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

| Layer | Grade | Summary |
|-------|-------|---------|
| **Orchestrator (Project-Janus)** | B− | Builds; 85 tests pass; SOUL rules silently dropped at validation |
| **Memory (Smart-Library)** | B+ | 81/81 pytest; heal flow SOUL-compliant; compose gaps |
| **Cognition (REL)** | C+ | 153 unit tests pass; bridge has contract bugs |
| **Assets (AssetConverter-sparse)** | B | Pipeline vendored; sources local-only |
| **Integration / Ops** | D+ | Services offline; docker/auth/payload issues |
| **Docs / Git** | B | Both repos pushed and clean; path drift in docs |

---

## Verified Test Matrix

| Suite | Result |
|-------|--------|
| `pnpm build` (10 packages) | **PASS** |
| `pnpm test` Project-Janus | **PASS** — 85 tests |
| Smart-Library `pytest tests/` | **PASS** — 81/81 |
| REL pytest (partial) | **153 pass**, 1 FAISS env failure; full suite blocked by deps |
| `@janus/integrations` | **31/31** |
| Live `janus status` | Memory + cognition **unreachable** (Docker not running) |
| Live `janus assets queue` | **PASS** — 71 mods queued |

---

## System Architecture (As Deployed)

```
┌─────────────────────────────────────────────────────────────┐
│ REL (Cognition) — :8080 — sessions, neural web, steward      │
│   ⚠️ Bridge broken: payload + auth + steward Ollama URL      │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST (intended)
┌──────────────────────────▼──────────────────────────────────┐
│ JanusPrime Orchestrator — Project-Janus                      │
│   ⚠️ SOUL rules dropped at validation                         │
│   ✅ Loop, brief, repair, manual patch, MCP                   │
└──────┬─────────────────────────────┬────────────────────────┘
       │                             │
       ▼                             ▼
┌──────────────┐            ┌──────────────────┐
│ Smart-Library│            │ AssetConverter   │
│ :8000        │            │ (local pipeline) │
│ ⚠️ compose   │            │ ✅ queue works    │
│   auth/cache │            └──────────────────┘
└──────────────┘
       │
       ▼
┌──────────────┐
│ Ollama :11434│  (shared — not running during audit)
└──────────────┘
```

---

## Critical Findings

### C1 — SOUL001–004 Never Enforced on Real Profiles

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

### C2 — REL REST Payload Mismatch

**File:** `Project-Janus/packages/janus-integrations/src/rel-client.ts`

REL REST expects `{"arguments": {...}}` per `ToolInvocationRequest` in `rest_api.py`. Janus sends flat JSON: `JSON.stringify(args)`.

**Impact:** `log_session`, `load_context`, `neural_learn`, and concept sync receive empty arguments. Loop logging and steward→memory sync are effectively broken.

**Fix:** `JSON.stringify({ arguments: args })`.

---

### C3 — REL Auth-Disabled Mode Returns 403 on Tools

When `REL_API_AUTH_REQUIRED=false`, principal is `role=anonymous`, but tool routes require `admin|manager|member|service`. Janus `.env.example` recommends auth off for local dev.

**Impact:** Docker cognition service with default compose settings cannot serve tool calls.

**Fix:** Grant anonymous→service on tool routes when auth disabled, or require `JANUS_REL_API_KEY` in compose and update docs.

---

## High Severity

| ID | Area | Finding |
|----|------|---------|
| H1 | Security | REL `PowerShell`, filesystem, desktop tools exposed via REST/MCP — orchestrator-only is doc policy only |
| H2 | Security | Smart-Library writes unauthenticated in compose; `JANUS_MEMORY_API_KEY` vs `API_KEY` env mismatch |
| H3 | Docker | HF cache volume misconfigured (`/app/.hf_cache` vs `/root/.cache/huggingface`) |
| H4 | Docker | `steward.py` hardcodes `localhost:11434`; ignores compose `OLLAMA_BASE_URL` |
| H5 | Config | Duplicate `workloads/omni32/manifest.json` at workspace root missing `local_root` |
| H6 | CLI | SOUL §9 says `janus status`; requires `aether janus status` or `node .../bin.js janus status` |
| H7 | Security | REL compose defaults: weak passwords, auth disabled |

---

## Medium Severity

| ID | Area | Finding |
|----|------|---------|
| M1 | Token policy | `brief_max_chars` caps estimate only — actual brief JSON can exceed SOUL §3 |
| M2 | Integration | `queryContextSlices` falls back to `POST /query` (LLM) on failure |
| M3 | Tests | Zero tests for `cli` and `mcp-server` |
| M4 | Tests | No test for `doc:rel-state` claude vs grok injection |
| M5 | Tests | `ensureSoulContextRef` not directly unit-tested |
| M6 | Profile | `python-sandbox-v1` declared but not wired in autonomous loop |
| M7 | Docs | SOUL §9 bootstrap path wrong from workspace root |
| M8 | Docs | Architecture doc shows `.aether/` at workspace root; actual path is `Project-Janus/.aether` |
| M9 | CI | No root `.github/workflows` for monorepo |
| M10 | REL | `pyproject.toml` packaging blocks `pip install -e ".[dev]"` |
| M11 | Assets | Pipeline vendored vs docs claiming sparse clone — strategy unclear |

---

## Low Severity

| ID | Finding |
|----|---------|
| L1 | Cognition `root` is absolute path — machine-specific |
| L2 | CLI branded `aether`, errors prefixed `aether:` |
| L3 | `pnpm test` aborts on first package failure |
| L4 | No root `references/README.md` index |
| L5 | REL tool count documentation drift (45/59/88) |

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
| Repo | Remote | Latest |
|------|--------|--------|
| JanusPrime | github.com/MrWizard94-Compile/JanusPrime | `fafe2a2` on `main`, clean |
| REL | github.com/MrWizard94-Compile/REL | `10eeb3d` on `main`, clean |

---

## Component Detail

### Project-Janus Orchestrator

- **Build:** 10/10 packages compile
- **Tests:** 85 pass (shared 1, context 1, task-queue 4, workload 12, validation 23, orchestrator 13, integrations 31)
- **Gaps:** SOUL rules dropped (C1); `janus` bin routing (H6); brief char cap not enforced (M1); no cli/mcp tests (M3)

### Smart-Library

- **Tests:** 81/81 pytest
- **SOUL §6:** Compliant — verified heal write-back only after retry
- **Gaps:** Compose auth (H2), HF cache (H3), `/seed-repair` auth untested, query payload size limits

### REL

- **Tools:** 88 registered in MCP server
- **Tests:** 153 pass (partial run)
- **Gaps:** Payload (C2), auth (C3), steward Ollama (H4), PowerShell not restricted (H1), pyproject packaging (M10)

### AssetConverter-sparse

- 57 files tracked in JanusPrime (vendored pipeline)
- `sources/` present locally, gitignored
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
| Unified CI/CD | ❌ |
| Secrets management | ❌ |
| Service healthchecks | ❌ |
| SOUL validation enforced | ✅ C1 fixed |
| REL bridge functional | ✅ C2, C3 fixed (live E2E pending) |
| Memory auth in stack | ✅ H2 fixed (optional key via `.env`) |
| E2E orchestration tested | ❌ |
| Windows Docker sandbox | ❌ unverified |
| Observability | ❌ |
| Phase 4 Theia IDE | ❌ deferred |

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
- [ ] **M1** Enforce `brief_max_chars` on brief content truncation
- [ ] **M2** Remove or gate LLM fallback in `queryContextSlices`
- [ ] **M4** Test `doc:rel-state` claude vs grok injection
- [ ] **M5** Unit test `ensureSoulContextRef`
- [ ] **M7–M8** Doc path and layout sync (SOUL §9, AGENTS.md, architecture)
- [ ] **M9** Root `.github/workflows/ci.yml`
- [ ] **M10** Fix REL `pyproject.toml` packaging

### P3 — Low / deferred
- [ ] **L1–L5** Polish items per table above
- [ ] Phase 4 Theia IDE

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

## Bottom Line

JanusPrime has **real architectural substance**: validation gate, memory heal contract, REL cognition layering, asset pipeline, and dual GitHub repos. The **stated invariants currently exceed enforced behavior**. SOUL rule pack and REL bridge — two design pillars — have implementation bugs that make them **mostly decorative** until P0 is fixed.

**Next action:** Commit and push P0+P1 fixes to JanusPrime and REL repos; run live E2E with `docker compose up`; tackle P2 (M1–M10).