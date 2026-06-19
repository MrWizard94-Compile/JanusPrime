# JanusPrime

**JanusPrime** is a fully autonomous, self-repairing, token-efficient development and asset generation platform. It unifies orchestration (Aether), semantic memory (Smart-Library), and the Omni32 asset pipeline into one validation-gated system.

**Repository:** [github.com/MrWizard94-Compile/JanusPrime](https://github.com/MrWizard94-Compile/JanusPrime)

## Components

| Component | Path | Role |
|-----------|------|------|
| Orchestrator | `Project-Janus/` | Task delegation, validation kernel, git worktrees |
| Memory | `Smart-Library/` | Semantic retrieval, sandboxed heal, doctrine storage |
| Assets | `AssetConverter-sparse/` | Texture pull → upscale → build (Omni32) |
| Doctrine | `SOUL.md` | Single source of truth for all agents and gates |
| Cognition (optional) | [REL Codex Variant](https://github.com/MrWizard94-Compile/REL) | Session logging, neural learn, context load via REST bridge |
| Config | `janus.config.json` | Unified workspace configuration |

## Quick Start

```powershell
# Install orchestrator dependencies
cd Project-Janus
pnpm install
pnpm build

# Start memory + cognition (REL) + Ollama
cd ..
copy .env.example .env   # set REL_BUILD_CONTEXT / REL_DATA_PATH if needed
docker compose up -d

# Bootstrap doctrine into memory (once per environment)
cd Project-Janus
node packages/cli/dist/bin.js janus doctrine seed
node packages/cli/dist/bin.js janus status

# Asset pipeline (sparse clone — mod sources are local-only, not in this repo)
cd ..
pnpm assets:setup
```

## CLI

The `janus` command namespace is the unified entry point (built on the Aether CLI):

| Command | Purpose |
|---------|---------|
| `janus status` | System health across all components |
| `janus brief -t <id>` | Token-efficient executor brief |
| `janus repair -t <id>` | Validation repair context |
| `janus loop run -t <id>` | Autonomous plan→execute→validate→seed |
| `janus doctrine seed` | Bootstrap SOUL.md into memory |
| `janus doctrine status` | Check doctrine freshness |
| `janus assets queue` | Asset pipeline queue |
| `janus rel status` | REL cognition service health and state summary |
| `janus rel sync` | Sync REL steward/neural-web concepts into Smart-Library |
| `janus rel context -q <query>` | Load cognition context from REL for a query |

From the workspace root you can also run `pnpm janus <subcommand>`.

## REL Cognition Layer (optional)

JanusPrime can bridge to **[REL Codex Variant](https://github.com/MrWizard94-Compile/REL)** for session logging, neural learn, and semantic context retrieval. `docker-compose.yml` includes a `cognition` service (port `8080`) that shares the stack Ollama instance — copy `.env.example` to `.env` and set `REL_BUILD_CONTEXT` / `REL_DATA_PATH` to your local REL checkout. JanusPrime connects through `components.cognition` in `janus.config.json`:

```json
"cognition": {
  "root": "C:/REL_Codex_Variant",
  "rest_url": "http://localhost:8080",
  "api_key_env": "JANUS_REL_API_KEY",
  "bearer_token_env": "JANUS_REL_BEARER_TOKEN",
  "log_loop_outcomes": true,
  "sync_concepts_to_memory": true,
  "concept_sync_max_chars": 2000
}
```

Set the auth env vars when REL requires them, start the stack (`docker compose up -d`) or a standalone REL REST server, then:

```powershell
janus rel status
janus rel sync
janus rel context -q "validation repair patterns for mixin tasks"
```

When cognition is configured:

- The autonomous loop logs outcomes to REL (`log_loop_outcomes`) and can auto-sync steward concepts into Smart-Library on loop completion (`sync_concepts_to_memory`).
- Orchestrator tasks may include context ref **`doc:rel-state`** — a token-capped live REL state excerpt (orchestrator/Claude only; never injected into Grok executor briefs). See [references/rel-state-bridge.md](references/rel-state-bridge.md).
- The MCP server exposes `janus://rel/state-summary`.

## Agent Bootstrap

All agents must read **[SOUL.md](SOUL.md)** and **[AGENTS.md](AGENTS.md)** before work. Context ref `doc:soul` is auto-injected on task create; orchestrator tasks may also request live REL state via `doc:rel-state`.

## License

Private — see repository owner for terms.