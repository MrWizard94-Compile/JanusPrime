# Janus governance adoption — 2026-10-18

Constitutional law comes only from the accepted `main` of
[WPAI Constitution](https://github.com/MrWizard94-Compile/Agents-Constitution).
Use the `wpai-constitution` skill, freezing and verifying one accepted revision
per invocation. The accepted source/tool snapshot used to check this migration
is v6.16.4, `0010a8353b00754fad31a30ed24327d3b6d05425`; it does not retroactively
change an already frozen invocation. Janus does not vendor constitutional law.

## Preserve the product contract

Root `CLAUDE.md` owns Janus project doctrine, not cross-project quality law.
Its existing loader path, `doc:claude`, `janus://doctrine/claude`, rule and profile
IDs, character budgets and brief field names remain stable. Component entries
link to that home. The README now distinguishes the two kinds of authority.

The earlier pointer-only migration displaced useful doctrine into pre-pack
backups. This adoption restores component responsibilities, role labels,
persona, validation/mutation contracts, token-policy defaults, repair and seed
contracts, memory security/test conventions and operational entry points.
General quality law is linked, not copied back as a competing constitution.
Historical first-attempt/accepted-task seed ambiguity is called out against the
current `seedAcceptedTask` implementation, not silently rewritten as new code.

The seven pre-pack guidance backups and duplicate project-doctrine archive are
retired from the working tree only after exact raw recovery outside the project.
The machine-local consolidation ledger records original hashes, paths and a
semantic disposition map. No user research, asset, runtime record or product
source is deleted as governance residue.

## Verification and boundaries

After the normal Project-Janus build has produced its JavaScript doctrine
loader, run the focused documentation/loader contracts from the Janus root.
They use that real built consumer, not a new TypeScript execution requirement
that would exclude the declared Node >=20 stack:

```powershell
python -B -W error -m unittest discover -s governance_tests -v
```

From `Project-Janus`, the existing loader tests are:

```powershell
pnpm exec vitest run packages/janus-integrations/src/claude.test.ts --reporter=verbose
```

Run the accepted source's `tools/check-adoption.py` against the actual Janus Git
root after integration. Its clean static result does not prove that built or
long-running clients, pre-existing memory records, live providers or every agent
have refreshed. Inspect those consumers separately before claiming runtime
acceptance; a capped excerpt is not a full constitutional load.

This governance migration does not run live status probes, seed memory, invoke
models, start services, synchronize REL, build assets or run autonomous loops.
Unpublished product work, the Git index and the primary branch/head are preserved.
No public product publication, full-stack test result, performance acceptance,
deployment or physical acceptance is implied by these documentation checks.
