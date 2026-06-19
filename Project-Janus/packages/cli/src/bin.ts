#!/usr/bin/env node

import { getCliName, normalizeArgv } from "./argv.js";
import { buildProgram } from "./program.js";

async function main(): Promise<void> {
  const cliName = getCliName(process.argv);
  const program = buildProgram(cliName);
  await program.parseAsync(normalizeArgv(process.argv));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const cliName = getCliName(process.argv);
  console.error(`${cliName}: ${message}`);
  process.exitCode = 1;
});