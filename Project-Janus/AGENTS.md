# Project-Janus orchestrator entry

The accepted `main` of
[WPAI Constitution](https://github.com/MrWizard94-Compile/Agents-Constitution)
alone owns constitutional law. Use `wpai-constitution`: freeze and verify one
accepted commit and read its SKILL, SOURCE manifest, always-load set and
applicable law from that same revision. Generated mirrors are distributions,
not authority. Start with [workspace AGENTS](../AGENTS.md) and
[project doctrine](../CLAUDE.md); component guidance does not copy that law.

Read [unified architecture](../references/unified-architecture.md) and
[handoff protocol](docs/phase0/handoff-protocol.md) before orchestration work.
Keep `doc:claude` on parent and child tasks; prefer the root Janus CLI command
table over a stale global shim or raw Aether brief.

The declared stack is Node >=20, pnpm >=9 and the versions in package.json /
pnpm-lock.yaml. Standard commands are `pnpm build`, `pnpm test`, `pnpm lint`
and `pnpm typecheck` from this directory. Inspect test side effects before
running integration or e2e scripts; do not invoke live memory, asset, REL or
provider services merely to validate governance.

`janus status`, `janus doctrine seed` and `janus loop run` are product
operations, not mandatory automatic setup. Seeding changes memory; loops can
invoke agents and mutate workloads. Preserve task-id / validation-receipt
requirements and obtain the specific operational authority first.
