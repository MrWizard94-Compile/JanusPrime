# Smart-Library component entry

The accepted `main` of
[WPAI Constitution](https://github.com/MrWizard94-Compile/Agents-Constitution)
alone owns constitutional law. Use `wpai-constitution`: freeze and verify one
accepted commit and read its SKILL, SOURCE manifest, always-load set and
applicable law from that same revision. Generated mirrors are distributions,
not authority. Start with [workspace AGENTS](../AGENTS.md) and
[project doctrine](../CLAUDE.md); component guidance does not copy that law.

This is the memory component inside the Janus Git root, not the separately
located Smart Library repository. Memory writes require the authorized Janus
workflow; never seed unverified heals as accepted repairs.

## Project layout

`smart_code_lib/` contains the FastAPI gateway, environment configuration,
Chroma database adapter and sandbox runner. `tests/` contains the mocked
pytest suite; `references/` owns architecture, API, setup and security docs.

## Development and testing

Read [architecture](references/architecture.md) and
[API reference](references/api-reference.md) before changing behavior.
Implement in `smart_code_lib/`; retain the local Ollama / HuggingFace boundary
rather than adding cloud dependencies. Document API and security changes in
`references/`. The component CI contract is `.github/workflows/ci.yml`.

Declared commands from this directory:

```powershell
pip install -r smart_code_lib/requirements-dev.txt
python -m pytest tests/ -v
```

Dependency installation is a separate environment change; prefer the existing
project environment when available. Unit tests mock Ollama, Chroma, Docker and
LLM calls, with no network. Preserve fixtures `client`, `mock_services`,
`client_ollama_down` and `client_startup_failed`; security behavior is covered
in `tests/test_security.py`. Do not substitute a live service for these mocks.

## Data and security boundaries

Write endpoints `/seed`, `/execute-heal` and `/maintenance/deduplicate`
support optional `API_KEY` in the existing product contract. That optional
setting does not establish safe production authentication. Enforce
`MAX_CODE_BYTES` on payloads; prefer the Docker sandbox and respect
`SANDBOX_FAIL_CLOSED` for production-like use.
Read [security](references/security.md) before changing these behaviors.

The supervisor approves specifications and deviations; implementation and
review own code, tests, docs and security alignment within that scope. Running
`uvicorn smart_code_lib.main:app --reload` starts a live API and is not part
of a governance-only test. No real memory, records or sandbox jobs are
authorized by reading this entry.
