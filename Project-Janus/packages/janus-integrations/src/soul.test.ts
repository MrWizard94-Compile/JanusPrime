import { describe, expect, it } from "vitest";
import { excerptSoul, hashSoul, loadSoul } from "./soul.js";
import { loadJanusConfig } from "./config.js";

describe("soul loader", () => {
  it("loads SOUL.md from workspace root", async () => {
    const { root, config } = await loadJanusConfig(
      "C:\\Users\\Bulkl\\OneDrive\\Desktop\\Janus\\Project-Janus",
    );
    const soul = await loadSoul(root, config);
    expect(soul).toContain("JanusPrime Single Source of Truth");
    expect(soul).toContain("Validation before mutation");
  });

  it("excerpts soul content", () => {
    const excerpt = excerptSoul("abcdefghij", 5);
    expect(excerpt).toBe("ab...");
  });

  it("hashes soul content deterministically", () => {
    expect(hashSoul("abc")).toHaveLength(64);
    expect(hashSoul("abc")).toBe(hashSoul("abc"));
    expect(hashSoul("abc")).not.toBe(hashSoul("abcd"));
  });
});