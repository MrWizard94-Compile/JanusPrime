import { describe, expect, it } from "vitest";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { estimateRoundCostUsd, evaluateWpaiBudgetGate } from "./wpai-budget-gate.js";
import { transformJanusJobToDelegationPlan } from "./studio-bridge.js";

describe("wpai budget gate", () => {
  it("estimates cost model v0 additively", () => {
    expect(estimateRoundCostUsd(1)).toBe(1.5);
    expect(estimateRoundCostUsd(2)).toBe(2.0);
  });

  it("fails when kill switch loops is true", async () => {
    const dir = join(tmpdir(), `wpai-gate-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    const bb = join(dir, "BLACKBOARD.json");
    await writeFile(
      bb,
      JSON.stringify({
        generation: 1,
        kill_switch: { global: false, loops: true },
        budgets: {
          api_usd_cap_day: 5,
          api_usd_cap_month: 40,
          api_usd_spent_est_day: 0,
          api_usd_spent_est_month: 0,
          max_executor_invocations_day: 30,
          executor_invocations_day: 0,
        },
      }),
      "utf8",
    );
    const r = await evaluateWpaiBudgetGate(bb);
    expect(r.ok).toBe(false);
    expect(r.kill).toBe(true);
  });

  it("passes under default caps", async () => {
    const dir = join(tmpdir(), `wpai-gate-ok-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    const bb = join(dir, "BLACKBOARD.json");
    await writeFile(
      bb,
      JSON.stringify({
        generation: 1,
        kill_switch: { global: false, loops: false },
        budgets: {
          api_usd_cap_day: 5,
          api_usd_cap_month: 40,
          api_usd_spent_est_day: 0,
          api_usd_spent_est_month: 0,
          max_executor_invocations_day: 30,
          executor_invocations_day: 0,
        },
      }),
      "utf8",
    );
    const r = await evaluateWpaiBudgetGate(bb);
    expect(r.ok).toBe(true);
  });
});

describe("studio-bridge transform", () => {
  it("maps janus_job to claude parent + grok child manual default", () => {
    const plan = transformJanusJobToDelegationPlan({
      kind: "janus_job",
      workload: "nodecore",
      validation_profile: "forge-mod-v1",
      objective: "fix warnings",
      files_in_scope: ["a.java"],
      patch_mode: "manual",
    });
    expect(plan.parent.assignee).toBe("claude");
    expect(plan.children[0]?.assignee).toBe("grok");
    expect(plan.children[0]?.patch_mode).toBe("manual");
    expect(plan.parent.spec.files_in_scope).toEqual([]);
    expect(plan.children[0]?.task.spec.files_in_scope).toEqual(["a.java"]);
  });
});
