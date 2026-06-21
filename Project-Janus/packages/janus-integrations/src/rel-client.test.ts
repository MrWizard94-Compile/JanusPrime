import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadJanusConfig } from "./config.js";
import { RelClient } from "./rel-client.js";
import { formatLoopSummary, collectLoopAchievements } from "./rel-bridge.js";
import type { AutonomousLoopResult } from "./autonomous-loop.js";

const cognitionConfig = {
  root: "REL_Codex_Variant",
  rest_url: "http://localhost:8080",
  api_key_env: "JANUS_REL_API_KEY",
  bearer_token_env: "JANUS_REL_BEARER_TOKEN",
  log_loop_outcomes: true,
};

describe("RelClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.JANUS_REL_API_KEY;
    delete process.env.JANUS_REL_BEARER_TOKEN;
  });

  it("health returns reachable result on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: "ok" }),
      }),
    );

    const client = new RelClient(cognitionConfig);
    const health = await client.health();

    expect(health.reachable).toBe(true);
    expect(health.data?.status).toBe("ok");
  });

  it("health returns unreachable result on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const client = new RelClient(cognitionConfig);
    const health = await client.health();

    expect(health.reachable).toBe(false);
    expect(health.error).toContain("ECONNREFUSED");
  });

  it("invokeTool sends auth headers and POST body", async () => {
    process.env.JANUS_REL_API_KEY = "test-api-key";
    process.env.JANUS_REL_BEARER_TOKEN = "test-bearer";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ result: "logged" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new RelClient(cognitionConfig);
    const result = await client.invokeTool("log_session", {
      summary: "loop complete",
      achievements: ["seeded:task-1"],
    });

    expect(result.reachable).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/tools/log_session",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": "test-api-key",
          Authorization: "Bearer test-bearer",
        },
        body: JSON.stringify({
          arguments: {
            summary: "loop complete",
            achievements: ["seeded:task-1"],
          },
        }),
      }),
    );
  });

  it("loadContext normalizes string tool responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({ result: "prior session context" }),
      }),
    );

    const client = new RelClient(cognitionConfig);
    const context = await client.loadContext("validation repair patterns", 2000);

    expect(context.reachable).toBe(true);
    expect(context.data?.context).toBe("prior session context");
  });

  it("loads cognition config from janus.config.json", async () => {
    const { config } = await loadJanusConfig(join(import.meta.dirname, "../../.."));

    expect(config.components.cognition?.rest_url).toBe("http://localhost:8080");
    expect(config.components.cognition?.log_loop_outcomes).toBe(true);
  });
});

describe("rel bridge helpers", () => {
  const loopResult: AutonomousLoopResult = {
    parent_id: "parent-1",
    rounds_executed: 2,
    complete: true,
    rollup: {
      parent_id: "parent-1",
      total: 2,
      by_status: {
        pending: 0,
        in_progress: 0,
        validating: 0,
        failed: 0,
        accepted: 2,
        abandoned: 0,
      },
      complete: true,
      children: [],
    },
    round_results: [
      {
        round: 1,
        task_id: "child-1",
        kind: "identity",
        status: "accepted",
        passed: true,
      },
      {
        round: 2,
        task_id: "child-2",
        kind: "manual",
        status: "failed",
        passed: false,
      },
    ],
    seeded_tasks: ["child-1"],
  };

  it("formatLoopSummary includes rollup and failure details", () => {
    const summary = formatLoopSummary(loopResult);

    expect(summary).toContain("parent-1");
    expect(summary).toContain("2/2 accepted");
    expect(summary).toContain("child-2:manual");
  });

  it("collectLoopAchievements captures seeded and passed tasks", () => {
    const achievements = collectLoopAchievements(loopResult);

    expect(achievements).toContain("parent:parent-1:complete");
    expect(achievements).toContain("seeded:child-1");
    expect(achievements).toContain("passed:child-1:identity");
    expect(achievements).not.toContain("passed:child-2:manual");
  });
});