import { describe, expect, it } from "vitest";
import {
  extractAnalyticsHighlights,
  formatConceptSyncPayload,
  formatLoopSummary,
} from "./rel-bridge.js";

describe("formatConceptSyncPayload", () => {
  it("combines state, context, and analytics within max chars", () => {
    const content = formatConceptSyncPayload({
      stateSummary: "Focus: JanusPrime integration",
      contextText: "Neural web concepts about validation",
      analytics: {
        result: {
          total_projects: 3,
          total_sessions: 10,
          neural_web: { total_neurons: 42, total_synapses: 100, total_activations: 500 },
        },
      },
      query: "JanusPrime",
      maxChars: 2000,
    });

    expect(content).toContain("Focus: JanusPrime integration");
    expect(content).toContain("Neural web concepts");
    expect(content).toContain("neurons:42");
    expect(content.length).toBeLessThanOrEqual(2000);
  });

  it("truncates oversized payloads", () => {
    const content = formatConceptSyncPayload({
      stateSummary: "x".repeat(5000),
      query: "test",
      maxChars: 100,
    });
    expect(content.length).toBeLessThanOrEqual(100);
    expect(content.endsWith("...")).toBe(true);
  });
});

describe("extractAnalyticsHighlights", () => {
  it("extracts neural web stats from nested result", () => {
    const lines = extractAnalyticsHighlights({
      result: {
        total_projects: 2,
        neural_web: { total_neurons: 5, total_synapses: 8, total_activations: 20 },
      },
    });
    expect(lines.join(" ")).toContain("neurons:5");
    expect(lines.join(" ")).toContain("active_projects:2");
  });
});

describe("formatLoopSummary", () => {
  it("includes rollup acceptance ratio", () => {
    const summary = formatLoopSummary({
      parent_id: "task-parent",
      rounds_executed: 2,
      complete: true,
      rollup: {
        parent_id: "task-parent",
        total: 3,
        by_status: {
          pending: 0,
          in_progress: 0,
          validating: 0,
          failed: 0,
          accepted: 3,
          abandoned: 0,
        },
        complete: true,
        children: [],
      },
      round_results: [],
      seeded_tasks: ["task-a"],
    });
    expect(summary).toContain("3/3 accepted");
    expect(summary).toContain("complete");
  });
});