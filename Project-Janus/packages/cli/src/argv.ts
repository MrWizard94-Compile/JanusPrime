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

export function normalizeArgv(argv: string[]): string[] {
  const invokedAs = path.basename(argv[1] ?? "").toLowerCase();
  if (invokedAs === "janus" || invokedAs === "janus.cmd") {
    return [...argv.slice(0, 2), "janus", ...argv.slice(2)];
  }

  const firstCmd = argv[2];
  if (firstCmd && firstCmd !== "janus" && JANUS_SUBCOMMANDS.has(firstCmd)) {
    return [...argv.slice(0, 2), "janus", ...argv.slice(2)];
  }

  return argv;
}