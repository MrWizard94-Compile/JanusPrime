# JanusPrime Audit Remediation TODO

**Source:** [system-audit-2026-06-19.md](./system-audit-2026-06-19.md)  
**Started:** 2026-06-19  
**Last updated:** 2026-06-19 (post-remediation sync)

All tracked items below are **complete** unless noted as deferred (Phase 4 IDE build).

---

## P0 — Critical ✅

| ID | Task | Status |
|----|------|--------|
| C1 | SOUL rules concatenated in `runRulesLayer` + cross-profile test | **done** |
| C2 | `RelClient` sends `{ arguments: args }` | **done** |
| C3 | REL anonymous principal → `service` when auth disabled | **done** |

---

## P1 — High ✅

| ID | Task | Status |
|----|------|--------|
| H1 | REL REST bridge tool allowlist (deny PowerShell / filesystem tools) | **done** |
| H1 MCP | Janus MCP server task-scoped surface only — no REL tool proxy (88-tool surface not exposed) | **done** |
| H2 | `API_KEY` wired from `JANUS_MEMORY_API_KEY` in compose | **done** |
| H3 | HF cache mounted at `/root/.cache/huggingface` | **done** |
| H4 | `steward.py` reads `OLLAMA_BASE_URL` from env | **done** |
| H5 | Duplicate root `workloads/omni32/manifest.json` removed | **done** |
| H6 | `janus` bin + argv shim for `janus status` | **done** |
| H7 | Compose requires `.env`; REL secrets use `${VAR:?}` | **done** |

---

## P2 — Medium ✅

| ID | Task | Status |
|----|------|--------|
| M1 | `enforceBriefBudget` truncates assembled brief to `brief_max_chars` | **done** |
| M2 | `queryContextSlices` LLM fallback gated (`allow_query_llm_fallback`, default `false`) | **done** |
| M3 | Tests for `cli` (`argv`, `program`) and `mcp-server` (`janus-resources`) | **done** |
| M4 | Tests for `doc:rel-state` claude vs grok injection | **done** |
| M5 | Unit tests for `ensureSoulContextRef` | **done** |
| M6 | `python-sandbox-v1` wired in autonomous loop via `PythonSandboxExecutor` | **done** |
| M7–M8 | Doc path sync (SOUL §9, AGENTS.md, `references/unified-architecture.md`) | **done** |
| M9 | Root `.github/workflows/ci.yml` (Project-Janus + Smart-Library) | **done** |
| M10 | REL `pyproject.toml` packaging fix | **done** |
| M11 | Asset strategy documented — vendored pipeline in repo + `scripts/setup-assetconverter.ps1` sparse clone | **done** |

---

## P3 — Low ✅

| ID | Task | Status |
|----|------|--------|
| L1 | Cognition root via `env:REL_COGNITION_ROOT` | **done** |
| L2 | CLI `janus` branding + error prefix | **done** |
| L3 | `pnpm -r --no-bail run test` | **done** |
| L4 | `references/README.md` index | **done** |
| L5 | REL tool count docs (88 tools) | **done** |

---

## Production & Ops ✅

| Item | Task | Status |
|------|------|--------|
| CI | Root `.github/workflows/ci.yml` — build + test both subsystems | **done** |
| Healthchecks | `docker-compose.yml` healthchecks for ollama, memory, cognition | **done** |
| Secrets doc | [secrets-management.md](./secrets-management.md) | **done** |
| Observability | [observability.md](./observability.md) | **done** |
| E2E services | `pnpm run e2e:services` probe (`e2e-services-probe.mjs`) | **done** |
| E2E sandbox | `pnpm run e2e:sandbox` probe (`e2e-sandbox-probe.mjs`) | **done** |
| E2E orchestration | `pnpm run e2e:orchestration` + loop smoke scripts | **done** |
| Windows Docker sandbox | Verified via `e2e:sandbox` against compose `USE_DOCKER_SANDBOX=true` | **done** |

---

## Phase 4 — Theia IDE

| Item | Status |
|------|--------|
| Architecture scaffold | **done** — [phase4-theia-ide.md](./phase4-theia-ide.md) |
| Theia product implementation | **deferred** per SOUL §10 |

---

## Verification Log

| When | Command | Result |
|------|---------|--------|
| 2026-06-19 | `pnpm build && pnpm test` | **PASS** — 131 tests (10 packages) |
| 2026-06-19 | `python -m pytest tests/ -q` (Smart-Library) | **PASS** — 81/81 |
| 2026-06-19 | `pnpm run e2e:services` (with `docker compose up -d`) | **PASS** — memory + cognition healthy, `janus status` + `janus rel status` OK |
| 2026-06-19 | `pnpm run e2e:sandbox` (with memory service up) | **PASS** — `/execute-heal` sandbox probe |
| 2026-06-19 | `janus status` (CLI shim) | **PASS** |