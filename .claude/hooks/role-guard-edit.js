#!/usr/bin/env node
/**
 * Orchestrator role guard — file edits.
 *
 * PreToolUse hook for Edit|Write|NotebookEdit. Blocks the orchestrator (this
 * Claude session) from hand-editing workload source. Editing workload checkouts
 * is executor work and must be delegated via `janus brief` through the gate.
 *
 * Allowed (orchestrator territory): the Janus workspace itself (harness, gate,
 * config, docs, briefs) and the orchestrator memory dir. Everything else —
 * especially sibling workload repos like Omni32_Loader / Node Core /
 * Astral_Sorcery_Port / AssetConverter — is denied.
 *
 * Exit 2 = block (message on stderr is shown to the model).
 */
const fs = require("fs");

const norm = (s) =>
  String(s).replace(/\\/g, "/").toLowerCase().replace(/\/+$/, "");

const ALLOWED_PREFIXES = [
  "c:/wpai/ai-research/janus",
  "c:/users/bulkl/.claude/projects/c--wpai-ai-research-janus/memory",
];

const ROLE_MODE_FILE = "C:/WPAI/AI-Research/Janus/.claude/role-mode.json";

// Executor mode: when the operator runs as both orchestrator and executor
// (e.g. the executor agent is offline), an explicit sentinel file unlocks the
// guard. Delete role-mode.json (or set role back to "orchestrator") to
// re-engage the lock. Read fresh on every invocation — no session restart.
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
    return 0; // unparseable input — don't block
  }

  if (executorMode()) {
    return 0; // executor role authorized — workload edits permitted
  }

  const input = data.tool_input || {};
  const filePath = input.file_path || input.path || input.notebook_path || "";
  if (!filePath) {
    return 0;
  }

  const target = norm(filePath);
  const allowed = ALLOWED_PREFIXES.some(
    (p) => target === p || target.startsWith(p + "/"),
  );
  if (allowed) {
    return 0;
  }

  process.stderr.write(
    "ORCHESTRATOR ROLE: editing workload source is executor work. " +
      "Delegate via `janus brief` + the validation gate, do not hand-edit.\n" +
      "Blocked path: " +
      filePath +
      "\n",
  );
  return 2;
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
});
process.stdin.on("end", () => {
  process.exit(decide(raw));
});
