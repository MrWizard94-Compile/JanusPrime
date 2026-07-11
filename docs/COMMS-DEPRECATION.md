# Deprecate Janus COMMS for studio ops (PR-16)

**Canonical studio multi-agent channel:** HellForge Council bus + Protocol v2  
**Path:** `C:\WPAI\Workspace\.hellforge\bus.jsonl`  
**CLI:** `C:\WPAI\Software\StudioOps\cli\hf-bus.ps1` and `wpai.ps1`

## Prefer

| Use case | Tool |
|----------|------|
| Short control telegrams | `hf-say` / bus types (`task`, `handoff`, `approve_*`, …) |
| Long payloads | `.hellforge/handoffs/*` |
| Human board | `.hellforge/STATUS.md` |
| Machine gates | `.wpai/BLACKBOARD.json` via `wpai` |
| Code mutation | Janus only (`janus loop`, validation kernel) |

## Do not use for new studio work

| Legacy | Why |
|--------|-----|
| `Janus/COMMS-CLAUDE-GROK.md` | Dual board drift |
| Janus `comms.jsonl` / ad-hoc comms without Protocol v2 | No HITL ticket types, no 400-char contract |

## Migration

1. Dot-source `hf-bus.ps1` with `$env:HF_ROLE`.
2. Put design dumps in handoffs; bus only carries pointer.
3. Approvals via `wpai approve` + `approve_request` bus type.

Janus internal package comms may remain for monorepo experiments; **studio Director workflows use HellForge + wpai only.**
