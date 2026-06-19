# Observability

How to inspect JanusPrime service health and logs today, plus planned metrics.

---

## Docker Logs

From the workspace root:

```powershell
docker compose logs -f memory cognition ollama
```

| Service | Log format | Notes |
|---------|------------|-------|
| **cognition** (REL) | JSON (`REL_LOG_FORMAT=json`) | Structured lines suitable for `jq` or log aggregators |
| **memory** (Smart-Library) | Uvicorn default | Request/access lines on stdout |
| **ollama** | Plain text | Model pull and inference messages |

Filter cognition JSON:

```powershell
docker compose logs cognition --no-log-prefix | jq .
```

Compose healthchecks (see `docker-compose.yml`) gate `memory` and `cognition` startup on a healthy Ollama instance.

---

## CLI Health

Unified status across memory, cognition, assets, and doctrine:

```powershell
cd Project-Janus
node packages/cli/dist/bin.js janus status
```

Component-specific probes:

| Command | What it checks |
|---------|----------------|
| `janus status` | Memory, cognition, asset queue rollup |
| `janus rel status` | REL reachability and state summary |
| `janus doctrine status` | SOUL.md freshness in memory |

---

## E2E Services Probe

Automated probe for CI and post-deploy verification (from `Project-Janus/`):

```powershell
pnpm run e2e:services
```

The script:

1. `GET http://localhost:8000/health` (memory)
2. `GET http://localhost:8080/health` (cognition)
3. Runs `janus status` and fails if any step is unreachable

Start the stack first: `docker compose up -d` from the workspace root.

---

## Log Level

| Variable | Scope | Default | Notes |
|----------|-------|---------|-------|
| `REL_LOG_LEVEL` | cognition | `INFO` | Set in `docker-compose.yml` |
| `JANUS_LOG_LEVEL` | orchestrator CLI | *(unset → info)* | Reserved for future CLI verbosity; set in `.env` when supported |

---

## Future: Metrics Endpoint

> **Placeholder** — not implemented yet.

Planned: a `GET /metrics` (or `janus://system/metrics` MCP resource) exposing:

- Service reachability counters
- Validation pass/fail rates
- Memory query latency histograms
- Asset queue depth

Until then, use `janus status`, compose healthchecks, and `pnpm run e2e:services` as the operational surface.