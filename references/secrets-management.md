# Secrets Management

How JanusPrime handles credentials across local development and production.

---

## Local Development (`.env`)

Copy the template before starting the stack:

```powershell
copy .env.example .env
```

| Secret / variable | Service | Purpose |
|-------------------|---------|---------|
| `REL_ADMIN_PASSWORD` | cognition | REL admin login (required by compose) |
| `REL_OAUTH2_SECRET` | cognition | REL OAuth2 signing secret (min 32 chars) |
| `REL_ADMIN_USERNAME` | cognition | Admin username (default `admin`) |
| `JANUS_MEMORY_API_KEY` | memory | Write API key for Smart-Library (`/seed`, `/execute-heal`, etc.) |
| `JANUS_REL_API_KEY` | orchestrator | REL REST bridge key when auth is enabled |
| `JANUS_REL_BEARER_TOKEN` | orchestrator | Alternative REL bearer token |

Compose maps `JANUS_MEMORY_API_KEY` → memory service `API_KEY`. Leave `JANUS_MEMORY_API_KEY` unset for frictionless local writes; set it when testing auth flows.

**Never commit `.env`.** It is listed in `.gitignore`. Use `.env.example` as the committed template with placeholder values only.

---

## Production

1. **Use a secret manager** — inject values at deploy time (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault, Docker/Kubernetes secrets). Do not bake secrets into images or compose files checked into git.
2. **Rotate keys** on a schedule and immediately after any suspected leak (`JANUS_MEMORY_API_KEY`, `JANUS_REL_API_KEY`, `REL_OAUTH2_SECRET`, `REL_ADMIN_PASSWORD`).
3. **Enable auth in production:**
   - `REL_API_AUTH_REQUIRED=true` on the cognition service
   - `JANUS_MEMORY_API_KEY` set (memory `API_KEY` enforced on write endpoints)
   - `JANUS_REL_API_KEY` or `JANUS_REL_BEARER_TOKEN` set in the orchestrator environment
4. **Restrict network exposure** — bind services to internal networks; terminate TLS at a reverse proxy; never expose the Docker socket (`/var/run/docker.sock`) to untrusted hosts.

---

## Checklist

| Environment | `REL_API_AUTH_REQUIRED` | `JANUS_MEMORY_API_KEY` | Secret store |
|-------------|-------------------------|--------------------------|--------------|
| Local dev | `false` (default) | optional | `.env` file |
| Production | `true` | required | secret manager |

See also: [Smart-Library security](../Smart-Library/references/security.md) for memory endpoint protection details.