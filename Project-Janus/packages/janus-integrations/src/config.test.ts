import { describe, expect, it } from "vitest";
import { findJanusRoot, loadJanusConfig } from "./config.js";

describe("janus config", () => {
  it("finds janus.config.json from Project-Janus subdirectory", async () => {
    const root = await findJanusRoot(
      "C:\\Users\\Bulkl\\OneDrive\\Desktop\\Janus\\Project-Janus\\packages\\janus-integrations",
    );
    expect(root).toContain("Janus");
  });

  it("loads and parses config", async () => {
    const { config } = await loadJanusConfig(
      "C:\\Users\\Bulkl\\OneDrive\\Desktop\\Janus\\Project-Janus",
    );
    expect(config.name).toBe("janusprime");
    expect(config.components.memory.url).toBe("http://localhost:8000");
    expect(config.components.assets.root).toBe("AssetConverter-sparse");
    expect(config.doctrine.soul_path).toBe("SOUL.md");
    expect(config.doctrine.inject_into_brief).toBe(true);
  });
});