# Base Wars Instance Overrides (Reference)

Templates for CurseForge instance config changes. **Executors must not write live instance paths directly.**

Deploy via orchestrator pack task or manual copy after task acceptance.

## Files

| Template | Live target |
|----------|-------------|
| `config/adlods-common.toml` | `Instances/Base wars/config/adlods-common.toml` |
| `config/nodecore-common.toml` | `Instances/Base wars/config/nodecore-common.toml` |
| `config/omni32_loader-client.toml` | `Instances/Base wars/config/omni32_loader-client.toml` |
| `defaultconfigs/dynamictrees-server.toml` | `Instances/Base wars/defaultconfigs/dynamictrees-server.toml` |

New worlds pick up `defaultconfigs/`. Existing saves need matching `serverconfig/` under the save folder.

## Omni32 Loader

When using `omni32_loader` (dynamic asset mount from `assets.root`), **disable** the static `resourcepacks/Omni32` entry in `options.txt` to avoid double-loading textures.