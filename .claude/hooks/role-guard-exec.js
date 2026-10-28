#!/usr/bin/env node
/**
 * Orchestrator role guard — gate/build execution.
 *
 * PreToolUse hook for Bash|PowerShell. Blocks the orchestrator from running
 * executor-class commands directly: the validation gate (`janus execute`,
 * `aether execute`), patch apply/submit, and direct Gradle builds (`gradlew`).
 * Those run through the executor. Read-only orchestrator commands (janus status,
 * brief, task show, doctrine, doctor) are unaffected.
 *
 * Exit 2 = block (message on stderr is shown to the model).
 */
const fs = require("fs");

const FORBIDDEN = [
  /\b(janus|aether)\s+execute\b/,
  /\b(janus|aether)\s+patch\s+(submit|apply)\b/,
  // gradlew / ./gradlew / .\gradlew / gradlew.bat as a command token
  /(^|[\s&|;(=])\.?[\\/]?gradlew(\.bat)?\b/,
];

const ROLE_MODE_FILE = "C:/WPAI/AI-Research/Janus/.claude/role-mode.json";

// Executor mode: an explicit sentinel file unlocks the gate/build lock so the
// operator can drive the validation gate directly when also acting as executor.
// Read fresh on every invocation; delete role-mode.json to re-engage the lock.
function executorMode() {
  try {
    const cfg = JSON.parse(fs.readFileSync(ROLE_MODE_FILE, "utf8"));
    return cfg && cfg.role === "executor";
  } catch {
    return false;
  }
}

function decide(raw) {
  let data = {};
  try {
    data = JSON.parse(raw || "{}");
  } catch {
    return 0;
  }

  if (executorMode()) {
    return 0; // executor role authorized — gate/build execution permitted
  }

  const command = (data.tool_input && data.tool_input.command) || "";
  if (!command) {
    return 0;
  }

  const c = String(command).toLowerCase();
  for (const re of FORBIDDEN) {
    if (re.test(c)) {
      process.stderr.write(
        "ORCHESTRATOR ROLE: running the gate/build (janus execute / patch apply / gradlew) " +
          "is executor work. Stay in plan/review; delegate execution.\n" +
          "Blocked command: " +
          command +
          "\n",
      );
      return 2;
    }
  }
  return 0;
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
});
process.stdin.on("end", () => {
  process.exit(decide(raw));
});
