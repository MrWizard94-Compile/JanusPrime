import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { JanusConfig } from "./config.js";

export async function loadClaude(janusRoot: string, config: JanusConfig): Promise<string> {
  const path = join(janusRoot, config.doctrine.claude_path);
  return readFile(path, "utf8");
}

export function excerptClaude(content: string, maxChars: number): string {
  if (content.length <= maxChars) {
    return content;
  }
  return `${content.slice(0, maxChars - 3)}...`;
}

export function hashClaude(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}