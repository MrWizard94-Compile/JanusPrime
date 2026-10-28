# CLAUDE.md — JanusPrime Single Source of Truth for project doctrine

**Scope:** Janus product contracts and operating context, not constitutional law.
Load [AGENTS.md](AGENTS.md) and the `wpai-constitution` skill first. The accepted
`main` of [WPAI Constitution](https://github.com/MrWizard94-Compile/Agents-Constitution)
alone owns constitutional law; freeze and verify its source revision. This file
cannot waive that law or the human director's authority.

**Machine contract:** keep `doc:claude`, `janus://doctrine/claude`,
`doctrine.claude_path`, `claude_doctrine` and `resolved_context` stable. Root
`CLAUDE.md` is the project-doctrine home; component entries link here rather than
copying it. A capped excerpt is partial project context, not a verified reading
of the Constitution or the full project doctrine.

**Validation before mutation:** Janus executors require the scoped task id,
approved specification and successful validation receipt before accepting a
workload patch. Staging a proposal is not acceptance. Do not seed unverified
heals. Reading these instructions does not authorize starting agents, loops,
services, memory writes, publication or spending.

## 0. System identity

JanusPrime is designed to combine these components into a validation-gated
development and asset-generation system. This is a product description, not
certification that a live autonomous stack currently works.

| Component | Role |
|-----------|------|
| Project-Janus / Aether | Orchestration, task delegation, validation kernel, Git worktrees |
| Smart-Library | Semantic retrieval, sandboxed execution, verified-heal write-back |
| AssetConverter / Omni32 | Texture pull, upscale, audit and build pipeline |
| Optional REL cognition bridge | Session outcomes and scoped context retrieval |

Corwin is the project's interaction persona: direct, concise and peer-to-peer;
challenge weak architecture with evidence. Persona does not grant authority or
establish a model's capabilities.

## 1. Product operating contracts

Workload acceptance is gated through the validation kernel and the relevant
profile. On failure, executors consume validation errors and retrieved repair
context, retry within configured limits, or abandon rather than accept failure.
The orchestrator owns broad context; executors receive capped briefs, not a
full doctrine, architecture and memory dump. Verified outcomes may be written
back under the configured seed policy and the separately authorized workflow.

General completeness, dependency, research, warning, security and quality law
are owned by the frozen Constitution, not duplicated here. The Janus validation
contracts below are concrete product interfaces, not replacements for that law.

## 2. Agent roles and context references

| Product role | Configured assignee/service | Responsibility |
|--------------|----------------------------|----------------|
| Orchestrator | Claude | Architecture context, decomposition and rollup review |
| Executor | Grok, or an explicitly configured executor | Minimal brief and validation-gated patch proposals |
| Memory | Smart-Library | Retrieval, verified-heal records and project-doctrine storage |
| Asset engine | AssetConverter | Omni32 pipeline under `asset-audit-v1` |

These are project role labels, not permission to spawn agents. Include
`doc:claude` on parent and child tasks. `doc:rel-state` remains orchestrator-only;
do not inject its live REL excerpt into executor briefs. Also use
`arch:janus-unified` and `doc:handoff-protocol` for the relevant work.

## 3. Declared token-policy defaults

Defaults are documented from `Project-Janus/packages/janus-integrations/src/config.ts`;
effective `janus.config.json` may override them. These are character counts,
not measurements of model tokens or guarantees of latency.

| Budget | Default | Config key |
|--------|---------|------------|
| Executor brief | 12,000 chars | `token_policy.brief_max_chars` |
| Memory slice | 2,000 chars | `token_policy.memory_slice_max_chars` |
| Memory slice count | 3 | `components.memory.context_limit` |
| Project-doctrine brief excerpt | 4,000 chars | `doctrine.brief_excerpt_max_chars` |
| Project-doctrine MCP excerpt | 1,500 chars | `doctrine.mcp_instruction_excerpt_max_chars` |
| Resolved catalog documents | 3,000 chars total | `token_policy.resolved_context_max_chars` |
| Validation errors | 20 | `token_policy.validation_error_max` |

## 4. Engineering entry points

Use [unified architecture](references/unified-architecture.md) and current
`references/` before changing behavior. Read [executor instructions](EXECUTOR.md)
and [handoff protocol](Project-Janus/docs/phase0/handoff-protocol.md). Preserve
the declared stack and validation interfaces; a source check is not runtime
acceptance. Component AGENTS entries add their own commands and data boundaries.

## 5. Validation doctrine and stable rule identifiers

| Product rule | Layer | Existing contract |
|--------------|-------|-------------------|
| CLAUDE001 | rules | Reject placeholder markers in submitted patches |
| CLAUDE002 | rules | Reject warning-suppression annotations |
| CLAUDE003 | rules | Reject hardcoded secret patterns |
| CLAUDE004 | rules | Reject dynamic execution / child-process patterns in patches |
| TS001–TS002 | rules | TypeScript scope and no `any` |
| A001–A003 | rules | Asset-task markers and pipeline |
| B001 | build | Required build or audit command passes |
| LSP | lsp | Diagnostics include warnings as failures |

Profiles retain their identifiers: `neoforge-mixin-v1`, `forge-mod-v1`,
`typescript-v1`, `asset-audit-v1`, and `python-sandbox-v1`. Actual rules and
profile code determine enforcement; this table is not proof of complete
security coverage or a successful runtime gate.

## 6. Self-repair and memory

The intended flow is plan, provision, execute, validate, then either repair and
retry or accept. Memory writes are separate consequential operations, not an
automatic instruction to the assistant reading this document.

| Record | Existing product interface / category |
|--------|--------------------------------------|
| Project-doctrine bootstrap | `janus doctrine seed` / `Operational Doctrine` |
| Accepted task | `seed_on_accept` / `Accepted Task Pattern` |
| Verified heal after prior failure | `seed_on_heal` / verified-heal path |
| Post-accept validation repair | `/seed-repair` / repair-pattern path |
| Failed validation | Errors remain repair context; failure is not acceptance |

Honor `self_repair.max_validation_retries`, `self_repair.max_heal_attempts`,
`self_repair.seed_on_accept` and `self_repair.seed_on_heal`. The historical table
said both "accepted task: seed" and "first-attempt success: no seed"; do not use
that ambiguity to override code. `seedAcceptedTask` seeds an accepted task when
enabled and takes the verified-heal path after prior failure when configured.
No memory seeding or freshness against a running service is certified by this
documentation migration.

## 7. Bootstrap references and acceptance limits

Read the entries and architecture first; use the root [AGENTS.md](AGENTS.md)
command table. After the relevant build and explicit operational authorization,
`janus status` and `janus doctrine status` inspect the system, and
`janus doctrine seed` performs memory bootstrap. Do not copy over an existing
`.env` or run seeding, asset writes, loops or REL synchronization during a
governance-only check.

The historical roadmap recorded manual-patch repair, `/seed-repair`, rule-pack
expansion, resolved catalog context, doctrine freshness and REL integration,
with Theia IDE Phase 4 still proposed. Consult current implementation and tests
before treating those dated records as verified installed capabilities.
Source, built-package, installed-consumer and live-service acceptance remain
separate. See [governance adoption](docs/GOVERNANCE-ADOPTION.md).
