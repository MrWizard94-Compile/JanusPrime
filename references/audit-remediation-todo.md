# JanusPrime Audit Remediation TODO

**Source:** [system-audit-2026-06-19.md](./system-audit-2026-06-19.md)  
**Started:** 2026-06-19  
**Last updated:** 2026-06-19

## P0 — Critical ✅

| ID | Task | Owner | Status |
|----|------|-------|--------|
| C1 | Concatenate SOUL errors in `runRulesLayer` + cross-profile tests | agent | **done** |
| C2 | Fix `RelClient` payload `{ arguments }` + tests | agent | **done** |
| C3 | Fix REL anonymous auth when auth disabled | agent | **done** |

## P1 — High ✅

| ID | Task | Owner | Status |
|----|------|-------|--------|
| H1 | REL REST Janus bridge tool allowlist | agent | **done** |
| H2 | Memory API_KEY in docker-compose | agent | **done** |
| H3 | HF cache path in docker-compose | agent | **done** |
| H4 | steward.py OLLAMA_BASE_URL from env | agent | **done** |
| H5 | Delete root workloads/omni32 duplicate | supervisor | **done** |
| H6 | janus bin argv shim | agent | **done** |
| H7 | Compose secrets require .env | agent | **done** |

## P2 — Medium (next sprint)

| ID | Task | Status |
|----|------|--------|
| M1 | Enforce brief_max_chars on content | pending |
| M2 | Gate queryContextSlices LLM fallback | pending |
| M4 | doc:rel-state claude/grok tests | pending |
| M5 | ensureSoulContextRef unit test | pending |
| M7-M8 | Doc path sync | pending |
| M9 | Root CI workflow | pending |
| M10 | REL pyproject fix | pending |

## P3 — Low

Deferred — see audit report.

## Verification Log

| When | Command | Result |
|------|---------|--------|
| 2026-06-19 | `pnpm build && pnpm test` (Project-Janus) | **90 tests pass** (incl. argv + rules) |
| 2026-06-19 | `pytest tests/test_rest_api_units.py` (REL) | **20 passed** (C3, H1, H4) |
| 2026-06-19 | Live `docker compose up` E2E | **not run** — services offline at audit |