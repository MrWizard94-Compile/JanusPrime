import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryClient } from "./memory-client.js";
import type { JanusConfig } from "./config.js";

const baseMemoryConfig: JanusConfig["components"]["memory"] = {
  root: "memory",
  url: "http://localhost:8000",
  api_key_env: "JANUS_MEMORY_API_KEY",
  context_limit: 3,
  max_context_chars: 8000,
  allow_query_llm_fallback: false,
};

describe("MemoryClient queryContextSlices", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns slices from /query/context on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ slices: ["slice-one", "slice-two"] }),
      }),
    );

    const client = new MemoryClient(baseMemoryConfig);
    const slices = await client.queryContextSlices("repair pattern");

    expect(slices).toEqual(["slice-one", "slice-two"]);
  });

  it("returns empty array when /query/context fails and allow_query_llm_fallback is false", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => "context endpoint unavailable",
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new MemoryClient({
      ...baseMemoryConfig,
      allow_query_llm_fallback: false,
    });
    const slices = await client.queryContextSlices("repair pattern");

    expect(slices).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/query/context",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("falls back to /query when allow_query_llm_fallback is true", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        text: async () => "context endpoint unavailable",
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: "answer",
          referenced_context: "legacy-slice-one\n\nlegacy-slice-two",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const client = new MemoryClient({
      ...baseMemoryConfig,
      allow_query_llm_fallback: true,
    });
    const slices = await client.queryContextSlices("repair pattern");

    expect(slices).toEqual(["legacy-slice-one", "legacy-slice-two"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8000/query",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns empty array on network failure when allow_query_llm_fallback is false", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchMock);

    const client = new MemoryClient({
      ...baseMemoryConfig,
      allow_query_llm_fallback: false,
    });
    const slices = await client.queryContextSlices("repair pattern");

    expect(slices).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});