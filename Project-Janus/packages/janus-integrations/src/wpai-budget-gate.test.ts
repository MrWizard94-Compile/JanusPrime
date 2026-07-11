import { describe, expect, it } from "vitest";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  chargeWpaiBudgetRound,
  estimateRoundCostUsd,
  evaluateWpaiBudgetGate,
} from "./wpai-budget-gate.js";

function uniqueDir(prefix: string): string {
  return join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

async function writeBlackboard(
  bb: string,
  body: Record<string, unknown>,
): Promise<void> {
  await writeFile(bb, JSON.stringify(body), "utf8");
}

const openBudgets = {
  api_usd_cap_day: 5,
  api_usd_cap_month: 40,
  api_usd_spent_est_day: 0,
  api_usd_spent_est_month: 0,
  max_executor_invocations_day: 30,
  executor_invocations_day: 0,
};

describe("wpai budget gate", () => {
  it("estimates cost model v0 additively", () => {
    expect(estimateRoundCostUsd(1)).toBe(1.5);
    expect(estimateRoundCostUsd(2)).toBe(2.0);
  });

  it("fails when kill switch loops is true", async () => {
    const dir = uniqueDir("wpai-gate");
    await mkdir(dir, { recursive: true });
    const bb = join(dir, "BLACKBOARD.json");
    await writeBlackboard(bb, {
      generation: 1,
      kill_switch: { global: false, loops: true },
      budgets: { ...openBudgets },
    });
    const r = await evaluateWpaiBudgetGate(bb);
    expect(r.ok).toBe(false);
    expect(r.kill).toBe(true);
  });

  it("passes under default caps", async () => {
    const dir = uniqueDir("wpai-gate-ok");
    await mkdir(dir, { recursive: true });
    const bb = join(dir, "BLACKBOARD.json");
    await writeBlackboard(bb, {
      generation: 1,
      kill_switch: { global: false, loops: false },
      budgets: { ...openBudgets },
    });
    const r = await evaluateWpaiBudgetGate(bb);
    expect(r.ok).toBe(true);
  });

  it("charges round cost onto blackboard", async () => {
    const dir = uniqueDir("wpai-charge");
    await mkdir(dir, { recursive: true });
    const bb = join(dir, "BLACKBOARD.json");
    await writeBlackboard(bb, {
      generation: 1,
      kill_switch: { global: false, loops: false },
      budgets: { ...openBudgets },
    });
    const r = await chargeWpaiBudgetRound(bb, 1);
    expect(r.ok).toBe(true);
    expect(r.day_spent).toBe(1.5);
    expect(r.invocations).toBe(1);
  });

  it("charge then gate fails when day cap exceeded", async () => {
    // Cap 2.0; one charge is 1.5 (ok), next evaluateRound (additional 1.5) would be 3.0 > 2.0
    const dir = uniqueDir("wpai-day-cap");
    await mkdir(dir, { recursive: true });
    const bb = join(dir, "BLACKBOARD.json");
    await writeBlackboard(bb, {
      generation: 1,
      kill_switch: { global: false, loops: false },
      budgets: {
        ...openBudgets,
        api_usd_cap_day: 2,
      },
    });

    const charged = await chargeWpaiBudgetRound(bb, 1);
    expect(charged.ok).toBe(true);
    expect(charged.day_spent).toBe(1.5);

    const gate = await evaluateWpaiBudgetGate(bb);
    expect(gate.ok).toBe(false);
    expect(gate.reason).toMatch(/day spend est/);
    expect(gate.day_cap).toBe(2);
    expect(gate.day_spent).toBeGreaterThan(2);

    // Second charge also blocked by pre-check
    const blocked = await chargeWpaiBudgetRound(bb, 1);
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toMatch(/day spend est/);

    const persisted = JSON.parse(await readFile(bb, "utf8")) as {
      budgets: { api_usd_spent_est_day: number };
    };
    // Only the first successful charge landed
    expect(persisted.budgets.api_usd_spent_est_day).toBe(1.5);
  });

  it("kill global blocks charge", async () => {
    const dir = uniqueDir("wpai-kill-global");
    await mkdir(dir, { recursive: true });
    const bb = join(dir, "BLACKBOARD.json");
    await writeBlackboard(bb, {
      generation: 1,
      kill_switch: { global: true, loops: false },
      budgets: { ...openBudgets },
    });

    const evaluate = await evaluateWpaiBudgetGate(bb);
    expect(evaluate.ok).toBe(false);
    expect(evaluate.kill).toBe(true);
    expect(evaluate.reason).toMatch(/kill switch/);

    const charge = await chargeWpaiBudgetRound(bb, 1);
    expect(charge.ok).toBe(false);
    expect(charge.kill).toBe(true);
    expect(charge.reason).toMatch(/kill switch/);

    const persisted = JSON.parse(await readFile(bb, "utf8")) as {
      budgets: { api_usd_spent_est_day: number; executor_invocations_day: number };
      generation: number;
    };
    expect(persisted.budgets.api_usd_spent_est_day).toBe(0);
    expect(persisted.budgets.executor_invocations_day).toBe(0);
    expect(persisted.generation).toBe(1);
  });
});
