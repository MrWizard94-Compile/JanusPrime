import { describe, expect, it } from "vitest";
import { loadJanusConfig } from "./config.js";

describe("autonomous loop config", () => {
  it("loads self_repair limits from janus.config.json", async () => {
    const { config } = await loadJanusConfig(
      "C:\\Users\\Bulkl\\OneDrive\\Desktop\\Janus\\Project-Janus",
    );
    expect(config.self_repair.max_validation_retries).toBeGreaterThan(0);
    expect(config.self_repair.seed_on_accept).toBe(true);
  });
});