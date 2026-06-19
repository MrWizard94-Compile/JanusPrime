# JanusPrime Audit Remediation TODO

**Source:** [system-audit-2026-06-19.md](./system-audit-2026-06-19.md)  
**Started:** 2026-06-19  
**Last updated:** 2026-06-19

## P0 — Critical ✅

| ID | Task | Status |
|----|------|--------|
| C1–C3 | SOUL rules, RelClient payload, REL auth | **done** |

## P1 — High ✅

| ID | Task | Status |
|----|------|--------|
| H1–H7 | Allowlist, compose, CLI shim, secrets | **done** |

## P2 — Medium ✅

| ID | Task | Status |
|----|------|--------|
| M1–M10 | Token policy, tests, docs, CI, pyproject | **done** |

## P3 — Low ✅

| ID | Task | Status |
|----|------|--------|
| L1 | Cognition root via `env:REL_COGNITION_ROOT` | **done** |
| L2 | CLI `janus` branding + error prefix | **done** |
| L3 | `pnpm -r --no-bail run test` | **done** |
| L4 | `references/README.md` index | **done** |
| L5 | REL tool count docs (88 tools) | **done** |
| — | `e2e:services` probe script | **done** |
| — | Phase 4 Theia IDE | deferred |

## Verification Log

| When | Command | Result |
|------|---------|--------|
| 2026-06-19 | `pnpm build && pnpm test` | **107+ tests pass** |
| 2026-06-19 | `pnpm run e2e:services` | **exit 1** — memory/cognition offline (expected) |
| 2026-06-19 | `janus status` (CLI shim) | **works** — assets queue OK, services unreachable |