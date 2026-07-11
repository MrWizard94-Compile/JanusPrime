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

/**
 * Property / fuzz: budget gate must stay total for arbitrary numeric inputs.
 * Loop opt-in is human-before-auto: `janus loop run --wpai-budget-gate`
 * (off by default; chaos only when explicitly flagged).
 */
describe("wpai budget gate property/fuzz", () => {
  function randChoice<T>(xs: readonly T[]): T {
    return xs[Math.floor(Math.random() * xs.length)]!;
  }

  /** Mix of finite, edge, and non-finite budget-ish numbers. */
  function fuzzNumber(): number {
    return randChoice([
      0,
      -0,
      -1,
      -100,
      0.001,
      0.5,
      1,
      1.5,
      2,
      5,
      30,
      40,
      1e6,
      Number.MAX_SAFE_INTEGER,
      Number.MIN_SAFE_INTEGER,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NaN,
      Math.random() * 100,
      Math.random() * 1e9 - 5e8,
    ]);
  }

  function fuzzInvocations(): number {
    return randChoice([
      0,
      1,
      2,
      30,
      31,
      -1,
      1000,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Math.floor(Math.random() * 50),
    ]);
  }

  function fuzzKill(): { global?: boolean; loops?: boolean } | undefined {
    return randChoice([
      undefined,
      {},
      { global: false, loops: false },
      { global: true, loops: false },
      { global: false, loops: true },
      { global: true, loops: true },
      { global: Boolean(Math.random() > 0.5) },
      { loops: Boolean(Math.random() > 0.5) },
    ]);
  }

  it("evaluate never throws; ok is always boolean (random budgets + kills)", async () => {
    const dir = uniqueDir("wpai-fuzz-eval");
    await mkdir(dir, { recursive: true });

    for (let i = 0; i < 80; i++) {
      const bb = join(dir, `BLACKBOARD-${i}.json`);
      const kill_switch = fuzzKill();
      const body: Record<string, unknown> = {
        generation: i,
        budgets: {
          api_usd_cap_day: fuzzNumber(),
          api_usd_cap_month: fuzzNumber(),
          api_usd_spent_est_day: fuzzNumber(),
          api_usd_spent_est_month: fuzzNumber(),
          max_executor_invocations_day: fuzzNumber(),
          executor_invocations_day: fuzzNumber(),
        },
      };
      if (kill_switch !== undefined) {
        body["kill_switch"] = kill_switch;
      }
      await writeBlackboard(bb, body);

      const additionalUsd = fuzzNumber();
      const additionalInv = fuzzInvocations();
      let r: Awaited<ReturnType<typeof evaluateWpaiBudgetGate>>;
      await expect(
        (async () => {
          r = await evaluateWpaiBudgetGate(bb, additionalUsd, additionalInv);
          return r;
        })(),
      ).resolves.toBeDefined();
      expect(typeof r!.ok).toBe("boolean");
      expect(typeof r!.reason).toBe("string");
      if (r!.kill !== undefined) {
        expect(typeof r!.kill).toBe("boolean");
      }
    }
  });

  it("charge never throws; ok is always boolean (random budgets + kills)", async () => {
    const dir = uniqueDir("wpai-fuzz-charge");
    await mkdir(dir, { recursive: true });

    for (let i = 0; i < 60; i++) {
      const bb = join(dir, `BLACKBOARD-${i}.json`);
      const kill_switch = fuzzKill();
      const body: Record<string, unknown> = {
        generation: i,
        budgets: {
          // Prefer room under cap so some charges succeed and exercise RMW path
          api_usd_cap_day: randChoice([5, 10, 40, 100, fuzzNumber()]),
          api_usd_cap_month: randChoice([40, 100, 500, fuzzNumber()]),
          api_usd_spent_est_day: randChoice([0, 0.5, 1, fuzzNumber()]),
          api_usd_spent_est_month: randChoice([0, 1, 10, fuzzNumber()]),
          max_executor_invocations_day: randChoice([30, 50, 100, fuzzNumber()]),
          executor_invocations_day: randChoice([0, 1, 5, fuzzNumber()]),
        },
      };
      if (kill_switch !== undefined) {
        body["kill_switch"] = kill_switch;
      }
      await writeBlackboard(bb, body);

      const inv = fuzzInvocations();
      let r: Awaited<ReturnType<typeof chargeWpaiBudgetRound>>;
      await expect(
        (async () => {
          r = await chargeWpaiBudgetRound(bb, inv);
          return r;
        })(),
      ).resolves.toBeDefined();
      expect(typeof r!.ok).toBe("boolean");
      expect(typeof r!.reason).toBe("string");
    }
  });

  it("evaluate is total for missing and garbage blackboard paths", async () => {
    const dir = uniqueDir("wpai-fuzz-garbage");
    await mkdir(dir, { recursive: true });
    const missing = join(dir, "no-such-blackboard.json");
    const garbage = join(dir, "garbage.json");
    await writeFile(garbage, "{not-json!!!", "utf8");

    for (const path of [missing, garbage]) {
      let r: Awaited<ReturnType<typeof evaluateWpaiBudgetGate>>;
      await expect(
        (async () => {
          r = await evaluateWpaiBudgetGate(path, fuzzNumber(), fuzzInvocations());
          return r;
        })(),
      ).resolves.toBeDefined();
      expect(typeof r!.ok).toBe("boolean");
      expect(r!.ok).toBe(false);
      expect(typeof r!.reason).toBe("string");
    }

    // charge must also not throw when pre-gate fails
    for (const path of [missing, garbage]) {
      let r: Awaited<ReturnType<typeof chargeWpaiBudgetRound>>;
      await expect(
        (async () => {
          r = await chargeWpaiBudgetRound(path, fuzzInvocations());
          return r;
        })(),
      ).resolves.toBeDefined();
      expect(typeof r!.ok).toBe("boolean");
      expect(r!.ok).toBe(false);
    }
  });
});
