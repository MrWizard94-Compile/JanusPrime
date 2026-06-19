import path from "node:path";

/** Direct `janus` subcommands (not shared with top-level `aether` commands). */
const JANUS_SUBCOMMANDS = new Set([
  "status",
  "brief",
  "repair",
  "seed",
  "doctrine",
  "loop",
  "memory",
  "rel",
  "assets",
]);

export function getCliName(argv: string[]): "janus" | "aether" {
  const invokedAs = path.basename(argv[1] ?? "").toLowerCase();
  if (invokedAs === "janus" || invokedAs === "janus.cmd") {
    return "janus";
  }

  const firstCmd = argv[2];
  if (firstCmd && firstCmd !== "janus" && JANUS_SUBCOMMANDS.has(firstCmd)) {
    return "janus";
  }

  return "aether";
}

export function normalizeArgv(argv: string[]): string[] {
  if (getCliName(argv) === "janus") {
    return [...argv.slice(0, 2), "janus", ...argv.slice(2)];
  }

  return argv;
}