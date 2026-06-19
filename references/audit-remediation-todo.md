# JanusPrime Audit Remediation TODO

**Source:** [system-audit-2026-06-19.md](./system-audit-2026-06-19.md)  
**Started:** 2026-06-19  
**Last updated:** 2026-06-19

## P0 — Critical ✅

| ID | Task | Status |
|----|------|--------|
| C1 | Concatenate SOUL errors in `runRulesLayer` + cross-profile tests | **done** |
| C2 | Fix `RelClient` payload `{ arguments }` + tests | **done** |
| C3 | Fix REL anonymous auth when auth disabled | **done** |

## P1 — High ✅

| ID | Task | Status |
|----|------|--------|
| H1 | REL REST Janus bridge tool allowlist | **done** |
| H2 | Memory API_KEY in docker-compose | **done** |
| H3 | HF cache path in docker-compose | **done** |
| H4 | steward.py OLLAMA_BASE_URL from env | **done** |
| H5 | Delete root workloads/omni32 duplicate | **done** |
| H6 | janus bin argv shim | **done** |
| H7 | Compose secrets require .env | **done** |

## P2 — Medium ✅

| ID | Task | Status |
|----|------|--------|
| M1 | Enforce brief_max_chars on content | **done** |
| M2 | Gate queryContextSlices LLM fallback | **done** |
| M4 | doc:rel-state claude/grok tests | **done** |
| M5 | ensureSoulContextRef unit test | **done** |
| M7-M8 | Doc path sync | **done** |
| M9 | Root CI workflow | **done** |
| M10 | REL pyproject fix | **done** |

## P3 — Low (remaining)

| ID | Task | Status |
|----|------|--------|
| L1 | Cognition root absolute path — machine-specific | deferred |
| L2 | CLI branded `aether`, errors prefixed `aether:` | deferred |
| L3 | `pnpm test` aborts on first package failure | deferred |
| L4 | No root `references/README.md` index | deferred |
| L5 | REL tool count documentation drift | deferred |
| — | Phase 4 Theia IDE | deferred |

## Verification Log

| When | Command | Result |
|------|---------|--------|
| 2026-06-19 | `pnpm build && pnpm test` (Project-Janus) | **103 tests pass** |
| 2026-06-19 | `pytest tests/test_rest_api_units.py` (REL) | **20 passed** |
| 2026-06-19 | `pip install -e ".[dev]"` (REL) | **success** |
| 2026-06-19 | Git push JanusPrime `08c53f4` | **pushed** |
| 2026-06-19 | Git push REL `f7f637e` | **pushed** |
| 2026-06-19 | Live `docker compose up` E2E | **not run** |