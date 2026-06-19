import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectJanusRoot = join(__dirname, "..");
const janusWorkspaceRoot = join(projectJanusRoot, "..");

const MEMORY_HEALTH_URL = "http://localhost:8000/health";
const EXECUTE_HEAL_URL = "http://localhost:8000/execute-heal";
const PROBE_TIMEOUT_MS = 5_000;
const HEAL_TIMEOUT_MS = 180_000;
const SANDBOX_CODE = 'print("janus_sandbox_ok")';

async function loadEnvFile(envPath) {
  try {
    const raw = await readFile(envPath, "utf8");
    const env = { ...process.env };
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (env[key] === undefined) {
        env[key] = value;
      }
    }
    return env;
  } catch {
    return { ...process.env };
  }
}

function resolveMemoryApiKey(env) {
  const janusKey = env.JANUS_MEMORY_API_KEY?.trim();
  if (janusKey) return janusKey;
  const apiKey = env.API_KEY?.trim();
  if (apiKey) return apiKey;
  return undefined;
}

async function probeHealth(url, timeoutMs = PROBE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const body = await response.text();
    let parsed = null;

    if (body.trim()) {
      try {
        parsed = JSON.parse(body);
      } catch {
        parsed = body.trim();
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      body: parsed,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      status: null,
      error: message,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function probeSandboxHeal(apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEAL_TIMEOUT_MS);

  const headers = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }

  try {
    const response = await fetch(EXECUTE_HEAL_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ code: SANDBOX_CODE }),
      signal: controller.signal,
    });

    const bodyText = await response.text();
    let body = null;
    if (bodyText.trim()) {
      try {
        body = JSON.parse(bodyText);
      } catch {
        body = bodyText.trim();
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      body,
      raw: bodyText,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      status: null,
      error: message,
    };
  } finally {
    clearTimeout(timer);
  }
}

function formatServiceHint() {
  return [
    "Start Smart-Library (memory) on port 8000:",
    "  docker compose up -d",
    "Or run manually from Smart-Library/",
  ].join("\n");
}

function isHealSuccess(report) {
  if (!report || typeof report !== "object") return false;
  const status = report.status;
  if (status !== "Success" && status !== "Healed") return false;
  const stdout = typeof report.stdout === "string" ? report.stdout : "";
  return stdout.includes("janus_sandbox_ok");
}

async function main() {
  console.log("e2e-sandbox: probing Smart-Library memory + sandbox...");

  const health = await probeHealth(MEMORY_HEALTH_URL);
  console.log(
    JSON.stringify(
      {
        health: {
          url: MEMORY_HEALTH_URL,
          ok: health.ok,
          status: health.status,
          body: health.body ?? null,
          error: health.error ?? null,
        },
      },
      null,
      2,
    ),
  );

  if (!health.ok) {
    console.error("e2e-sandbox: FAIL — memory /health unreachable");
    if (health.error) console.error(health.error);
    console.error(formatServiceHint());
    process.exitCode = 1;
    return;
  }

  const env = await loadEnvFile(join(janusWorkspaceRoot, ".env"));
  const apiKey = resolveMemoryApiKey(env);

  console.log("e2e-sandbox: POST /execute-heal with sandbox probe code...");
  const heal = await probeSandboxHeal(apiKey);
  console.log(
    JSON.stringify(
      {
        execute_heal: {
          url: EXECUTE_HEAL_URL,
          ok: heal.ok,
          status: heal.status,
          body: heal.body ?? null,
          error: heal.error ?? null,
        },
      },
      null,
      2,
    ),
  );

  if (!heal.ok) {
    const timedOut = heal.error?.includes("aborted");
    console.error(
      timedOut
        ? "e2e-sandbox: FAIL — sandbox unavailable (execute-heal timed out)"
        : `e2e-sandbox: FAIL — /execute-heal returned HTTP ${heal.status ?? "error"}`,
    );
    if (heal.error) console.error(heal.error);
    if (heal.raw?.trim()) console.error(heal.raw.trim());
    if (timedOut) {
      console.error(
        "Docker sandbox may be slow or unavailable on this host; check Smart-Library logs and SANDBOX_* settings.",
      );
    }
    console.error(formatServiceHint());
    process.exitCode = 1;
    return;
  }

  const report = heal.body?.report;
  if (!isHealSuccess(report)) {
    console.error(
      "e2e-sandbox: FAIL — sandbox execution did not return janus_sandbox_ok",
    );
    if (report) {
      console.error(JSON.stringify(report, null, 2));
    }
    console.error(formatServiceHint());
    process.exitCode = 1;
    return;
  }

  console.log("e2e-sandbox: PASS — memory healthy and sandbox executed probe code");
}

main().catch((error) => {
  console.error(
    `e2e-sandbox: FAIL — ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});