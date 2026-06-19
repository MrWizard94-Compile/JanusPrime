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
| Config | `janus.config.json` | Unified workspace configuration |

## Quick Start

```powershell
# Install orchestrator dependencies
cd Project-Janus
pnpm install
pnpm build

# Start memory + Ollama
cd ..
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

From the workspace root you can also run `pnpm janus <subcommand>`.

## Agent Bootstrap

All agents must read **[SOUL.md](SOUL.md)** and **[AGENTS.md](AGENTS.md)** before work. Context ref `doc:soul` is auto-injected on task create.

## License

Private — see repository owner for terms.