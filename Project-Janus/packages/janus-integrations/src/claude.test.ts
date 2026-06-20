import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { excerptClaude, hashClaude, loadClaude } from "./claude.js";
import { loadJanusConfig } from "./config.js";

const projectJanusRoot = join(import.meta.dirname, "../../..");

describe("claude loader", () => {
  it("loads CLAUDE.md from workspace root", async () => {
    const { root, config } = await loadJanusConfig(projectJanusRoot);
    const claude = await loadClaude(root, config);
    expect(claude).toContain("JanusPrime Single Source of Truth");
    expect(claude).toContain("Validation before mutation");
  });

  it("excerpts claude content", () => {
    const excerpt = excerptClaude("abcdefghij", 5);
    expect(excerpt).toBe("ab...");
  });

  it("hashes claude content deterministically", () => {
    expect(hashClaude("abc")).toHaveLength(64);
    expect(hashClaude("abc")).toBe(hashClaude("abc"));
    expect(hashClaude("abc")).not.toBe(hashClaude("abcd"));
  });
});