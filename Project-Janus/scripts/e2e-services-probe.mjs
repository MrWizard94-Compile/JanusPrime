import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectJanusRoot = join(__dirname, "..");
const cli = join(projectJanusRoot, "packages", "cli", "dist", "bin.js");

const MEMORY_HEALTH_URL = "http://localhost:8000/health";
const COGNITION_HEALTH_URL = "http://localhost:8080/health";
const PROBE_TIMEOUT_MS = 5_000;
const CLI_TIMEOUT_MS = 30_000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function probeHealth(label, url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

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
      label,
      url,
      reachable: response.ok,
      status: response.status,
      body: parsed,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      label,
      url,
      reachable: false,
      status: null,
      error: message,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runCli(args, timeoutMs = CLI_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: projectJanusRoot,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`CLI timed out: node ${cli} ${args.join(" ")}`));
        return;
      }
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function formatServiceHint() {
  return [
    "Start services from the JanusPrime workspace root:",
    "  docker compose up -d",
    "Or run manually:",
    "  Smart-Library (memory): port 8000",
    "  REL rest_api.py (cognition): port 8080",
  ].join("\n");
}

async function main() {
  console.log("e2e-services: probing local JanusPrime services...");

  const memory = await probeHealth("memory", MEMORY_HEALTH_URL);
  const cognition = await probeHealth("cognition", COGNITION_HEALTH_URL);

  console.log(
    JSON.stringify(
      {
        memory: {
          url: memory.url,
          reachable: memory.reachable,
          status: memory.status,
          error: memory.error ?? null,
        },
        cognition: {
          url: cognition.url,
          reachable: cognition.reachable,
          status: cognition.status,
          error: cognition.error ?? null,
        },
      },
      null,
      2,
    ),
  );

  if (!memory.reachable || !cognition.reachable) {
    const down = [];
    if (!memory.reachable) down.push("memory (:8000)");
    if (!cognition.reachable) down.push("cognition (:8080)");

    console.error(
      `e2e-services: FAIL — service(s) unreachable: ${down.join(", ")}`,
    );
    console.error(formatServiceHint());
    process.exitCode = 1;
    return;
  }

  console.log("e2e-services: both health endpoints OK — running CLI status checks...");

  const janusStatus = await runCli(["status"]);
  if (janusStatus.code !== 0) {
    console.error("e2e-services: FAIL — `janus status` exited non-zero");
    if (janusStatus.stderr.trim()) console.error(janusStatus.stderr.trim());
    if (janusStatus.stdout.trim()) console.error(janusStatus.stdout.trim());
    process.exitCode = 1;
    return;
  }
  console.log("e2e-services: janus status OK");
  console.log(janusStatus.stdout.trim());

  await delay(250);

  const relStatus = await runCli(["rel", "status"]);
  if (relStatus.code !== 0) {
    console.error("e2e-services: FAIL — `janus rel status` exited non-zero");
    if (relStatus.stderr.trim()) console.error(relStatus.stderr.trim());
    if (relStatus.stdout.trim()) console.error(relStatus.stdout.trim());
    process.exitCode = 1;
    return;
  }
  console.log("e2e-services: janus rel status OK");
  console.log(relStatus.stdout.trim());

  console.log("e2e-services: PASS — memory and cognition reachable");
}

main().catch((error) => {
  console.error(
    `e2e-services: FAIL — ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});