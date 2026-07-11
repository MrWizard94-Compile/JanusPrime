import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@aether/shared";
import { OrchestratorService } from "@aether/orchestrator";
import { JanusAutonomousLoop } from "./autonomous-loop.js";
import { loadJanusConfig } from "./config.js";
import { PythonSandboxExecutor } from "./python-sandbox-executor.js";
import { JanusUnifiedService } from "./unified-service.js";
import { RelBridge } from "./rel-bridge.js";
import * as wpaiBudgetGate from "./wpai-budget-gate.js";

const projectJanusRoot = join(import.meta.dirname, "../../..");

const pythonChild: Task = {
  id: "child-python-1",
  parent_id: "parent-1",
  worktree: null,
  workload: null,
  status: "pending",
  assignee: "grok",
  context_refs: ["doc:claude"],
  spec: {
    objective: "Validate python script",
    constraints: [],
    files_in_scope: ["scripts/demo.py"],
    acceptance_criteria: ["Sandbox passes"],
  },
  validation_profile: "python-sandbox-v1",
  result: null,
  validation_attempts: [],
  created_at: "2026-06-19T00:00:00.000Z",
  updated_at: "2026-06-19T00:00:00.000Z",
};

describe("autonomous loop config", () => {
  it("loads self_repair limits from janus.config.json", async () => {
    const { config } = await loadJanusConfig(projectJanusRoot);
    expect(config.self_repair.max_validation_retries).toBeGreaterThan(0);
    expect(config.self_repair.seed_on_accept).toBe(true);
  });
});

describe("JanusAutonomousLoop python-sandbox routing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("routes python-sandbox-v1 children to PythonSandboxExecutor", async () => {
    const { root, config } = await loadJanusConfig(projectJanusRoot);

    const executeSpy = vi.spyOn(PythonSandboxExecutor.prototype, "execute").mockResolvedValue({
      task_id: pythonChild.id,
      passed: true,
      status: "accepted",
      heal_status: "Success",
      source_files: ["scripts/demo.py"],
      errors: [],
    });

    vi.spyOn(OrchestratorService.prototype, "provisionChildren").mockResolvedValue();
    vi.spyOn(OrchestratorService.prototype, "listChildren")
      .mockResolvedValueOnce([pythonChild])
      .mockResolvedValue([{ ...pythonChild, status: "accepted" }]);
    vi.spyOn(OrchestratorService.prototype, "rollupStatus").mockResolvedValue({
      parent_id: "parent-1",
      total: 1,
      by_status: {
        pending: 0,
        in_progress: 0,
        validating: 0,
        failed: 0,
        accepted: 1,
        abandoned: 0,
      },
      complete: true,
      children: [{ ...pythonChild, status: "accepted" }],
    });
    vi.spyOn(JanusUnifiedService.prototype, "getDoctrineStatus").mockResolvedValue({
      fresh: true,
      content_hash: "abc",
      stored_count: 1,
    });
    vi.spyOn(JanusUnifiedService.prototype, "seedAcceptedTask").mockResolvedValue({
      message: "seeded",
    });
    vi.spyOn(RelBridge.prototype, "logAutonomousLoopOutcome").mockResolvedValue();
    vi.spyOn(JanusUnifiedService.prototype, "syncRelConceptsToMemory").mockResolvedValue();

    const loop = new JanusAutonomousLoop(root, config);
    const result = await loop.run("parent-1", { max_rounds: 1, seed_on_accept: false });

    expect(executeSpy).toHaveBeenCalledWith(pythonChild.id);
    expect(result.round_results).toHaveLength(1);
    expect(result.round_results[0]).toMatchObject({
      task_id: pythonChild.id,
      kind: "python_sandbox",
      status: "accepted",
      passed: true,
      detail: "Success:scripts/demo.py",
    });
  });
});

describe("JanusAutonomousLoop mid-loop WPAI budget charge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("charges after incomplete round then aborts when next-round gate fails", async () => {
    const { root, config } = await loadJanusConfig(projectJanusRoot);

    vi.spyOn(PythonSandboxExecutor.prototype, "execute").mockResolvedValue({
      task_id: pythonChild.id,
      passed: false,
      status: "failed",
      heal_status: "Failed",
      source_files: ["scripts/demo.py"],
      errors: ["sandbox fail"],
    });

    vi.spyOn(OrchestratorService.prototype, "provisionChildren").mockResolvedValue();
    // Child remains active so rollup stays incomplete and budget path runs
    vi.spyOn(OrchestratorService.prototype, "listChildren").mockResolvedValue([pythonChild]);
    vi.spyOn(OrchestratorService.prototype, "rollupStatus").mockResolvedValue({
      parent_id: "parent-1",
      total: 1,
      by_status: {
        pending: 1,
        in_progress: 0,
        validating: 0,
        failed: 0,
        accepted: 0,
        abandoned: 0,
      },
      complete: false,
      children: [pythonChild],
    });
    vi.spyOn(JanusUnifiedService.prototype, "getDoctrineStatus").mockResolvedValue({
      fresh: true,
      content_hash: "abc",
      stored_count: 1,
    });
    vi.spyOn(RelBridge.prototype, "logAutonomousLoopOutcome").mockResolvedValue();
    vi.spyOn(JanusUnifiedService.prototype, "syncRelConceptsToMemory").mockResolvedValue();

    const chargeSpy = vi.spyOn(wpaiBudgetGate, "chargeWpaiBudgetRound").mockResolvedValue({
      ok: true,
      reason: "charged 1.5",
      day_spent: 1.5,
      day_cap: 5,
      month_spent: 1.5,
      month_cap: 40,
      invocations: 1,
      inv_cap: 30,
    });
    const gateSpy = vi.spyOn(wpaiBudgetGate, "evaluateWpaiBudgetGate").mockResolvedValue({
      ok: false,
      reason: "day spend est 3 would exceed cap 2",
      day_spent: 3,
      day_cap: 2,
    });

    const loop = new JanusAutonomousLoop(root, config);
    const result = await loop.run("parent-1", {
      max_rounds: 3,
      seed_on_accept: false,
      wpai_budget_gate: true,
    });

    expect(chargeSpy).toHaveBeenCalledTimes(1);
    expect(gateSpy).toHaveBeenCalledTimes(1);
    expect(result.rounds_executed).toBe(1);
    expect(result.complete).toBe(false);
    expect(
      result.round_results.some((r) =>
        String(r.detail ?? "").startsWith("wpai_budget_gate_abort:"),
      ),
    ).toBe(true);
  });
});
