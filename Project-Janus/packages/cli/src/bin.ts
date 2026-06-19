#!/usr/bin/env node

import { normalizeArgv } from "./argv.js";
import { buildProgram } from "./program.js";

async function main(): Promise<void> {
  const program = buildProgram();
  await program.parseAsync(normalizeArgv(process.argv));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`aether: ${message}`);
  process.exitCode = 1;
});