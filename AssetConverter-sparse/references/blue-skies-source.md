# Blue Skies — Source Access

Research date: 2026-06-19

## Status: private GitLab

| URL | Result |
|-----|--------|
| `https://gitlab.com/modding-legacy/blue-skies.git` | **403** — not allowed to download |
| `https://github.com/JeremyECruz/Blue-Skies.git` | 404 |
| `https://gitlab.com/JeremyECruz/Blue-Skies.git` | 404 |

Blue Skies cannot be cloned into `sources/` without GitLab credentials.

## Workaround options

1. **Modrinth JAR extract** — **implemented** in `MODRINTH_JAR_MODS` (`blue_skies-1.20.1-1.3.31.jar`). GitLab clone 403 → auto-fallback to Modrinth.
2. **Manual jar** — place Forge 1.20.1 jar in `local/jars/` and use `extract_textures_from_jar()`.
3. **GitLab token** — set `GITLAB_TOKEN` and clone with authenticated URL (not implemented yet).

## ATM10 presence

Blue Skies is a major ATM10 dimension mod with significant texture surface area. Prioritize JAR fallback when expanding Omni32 beyond public GitHub repos.