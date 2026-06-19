# REL State Bridge (`doc:rel-state`)

**Context ref:** `doc:rel-state`  
**Scope:** Orchestrator (Claude) tasks only — never injected into Grok executor briefs.

When a task carries `doc:rel-state`, JanusPrime fetches a live excerpt from REL via `get_state_summary`, capped by `token_policy.rel_context_max_chars`.

REL REST: `http://localhost:8080` (or `components.cognition.rest_url` in `janus.config.json`).

MCP equivalent: `janus://rel/state-summary`