/**
 * WPAI overnight budget / kill gate (PR-09).
 * Reads Workspace\.wpai\BLACKBOARD.json; never spends money — only estimates.
 * Optional chargeAfterRound updates spent counters via atomic rename RMW.
 */
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";

export interface WpaiBudgetGateResult {
  ok: boolean;
  reason: string;
  kill?: boolean;
  day_spent?: number;
  day_cap?: number;
  month_spent?: number;
  month_cap?: number;
  invocations?: number;
  inv_cap?: number;
}

const DEFAULT_BB =
  process.env["WPAI_BLACKBOARD_PATH"] ||
  "C:\\WPAI\\Workspace\\.wpai\\BLACKBOARD.json";

/** Round fee + one executor invocation (cost model v0). */
const ROUND_FEE = 1.0;
const EXECUTOR_FEE = 0.5;

export function estimateRoundCostUsd(executorInvocations = 1): number {
  return ROUND_FEE + EXECUTOR_FEE * executorInvocations;
}

export async function evaluateWpaiBudgetGate(
  blackboardPath: string = DEFAULT_BB,
  additionalUsd: number = estimateRoundCostUsd(1),
  additionalInvocations = 1,
): Promise<WpaiBudgetGateResult> {
  if (!existsSync(blackboardPath)) {
    return { ok: false, reason: `BLACKBOARD missing: ${blackboardPath}` };
  }
  let raw: string;
  try {
    raw = await readFile(blackboardPath, "utf8");
  } catch (err) {
    return {
      ok: false,
      reason: `BLACKBOARD unreadable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  let bb: {
    kill_switch?: { global?: boolean; loops?: boolean };
    budgets?: {
      api_usd_cap_day?: number;
      api_usd_cap_month?: number;
      api_usd_spent_est_day?: number;
      api_usd_spent_est_month?: number;
      max_executor_invocations_day?: number;
      executor_invocations_day?: number;
    };
  };
  try {
    bb = JSON.parse(raw) as typeof bb;
  } catch {
    return { ok: false, reason: "BLACKBOARD JSON parse failed" };
  }
  if (bb.kill_switch?.global || bb.kill_switch?.loops) {
    return { ok: false, reason: "kill switch active (global or loops)", kill: true };
  }
  const b = bb.budgets ?? {};
  const daySpent = Number(b.api_usd_spent_est_day ?? 0) + additionalUsd;
  const monthSpent = Number(b.api_usd_spent_est_month ?? 0) + additionalUsd;
  const dayCap = Number(b.api_usd_cap_day ?? 5);
  const monthCap = Number(b.api_usd_cap_month ?? 40);
  const inv = Number(b.executor_invocations_day ?? 0) + additionalInvocations;
  const invCap = Number(b.max_executor_invocations_day ?? 30);
  if (daySpent > dayCap) {
    return {
      ok: false,
      reason: `day spend est ${daySpent} would exceed cap ${dayCap}`,
      day_spent: daySpent,
      day_cap: dayCap,
    };
  }
  if (monthSpent > monthCap) {
    return {
      ok: false,
      reason: `month spend est ${monthSpent} would exceed cap ${monthCap}`,
      month_spent: monthSpent,
      month_cap: monthCap,
    };
  }
  if (inv > invCap) {
    return {
      ok: false,
      reason: `invocations ${inv} would exceed day cap ${invCap}`,
      invocations: inv,
      inv_cap: invCap,
    };
  }
  return {
    ok: true,
    reason: "ok",
    day_spent: daySpent,
    day_cap: dayCap,
    month_spent: monthSpent,
    month_cap: monthCap,
    invocations: inv,
    inv_cap: invCap,
  };
}

/**
 * After a successful loop round, charge cost model v0 onto BLACKBOARD.
 * Estimate-only accounting — does not call any paid API.
 */
export async function chargeWpaiBudgetRound(
  blackboardPath: string = DEFAULT_BB,
  executorInvocations = 1,
): Promise<WpaiBudgetGateResult> {
  const cost = estimateRoundCostUsd(executorInvocations);
  const pre = await evaluateWpaiBudgetGate(blackboardPath, cost, executorInvocations);
  if (!pre.ok) return pre;
  if (!existsSync(blackboardPath)) {
    return { ok: false, reason: `BLACKBOARD missing: ${blackboardPath}` };
  }
  const raw = await readFile(blackboardPath, "utf8");
  const bb = JSON.parse(raw) as {
    generation?: number;
    updated_at?: string;
    budgets?: Record<string, number | string>;
  };
  const budgets = bb.budgets ?? {};
  budgets["api_usd_spent_est_day"] =
    Number(budgets["api_usd_spent_est_day"] ?? 0) + cost;
  budgets["api_usd_spent_est_month"] =
    Number(budgets["api_usd_spent_est_month"] ?? 0) + cost;
  budgets["executor_invocations_day"] =
    Number(budgets["executor_invocations_day"] ?? 0) + executorInvocations;
  bb.budgets = budgets;
  bb.generation = Number(bb.generation ?? 0) + 1;
  bb.updated_at = new Date().toISOString();
  await mkdir(dirname(blackboardPath), { recursive: true });
  const tmp = `${blackboardPath}.tmp.${process.pid}.${randomBytes(3).toString("hex")}`;
  await writeFile(tmp, JSON.stringify(bb, null, 2), "utf8");
  await rename(tmp, blackboardPath);
  return {
    ok: true,
    reason: `charged ${cost}`,
    day_spent: Number(budgets["api_usd_spent_est_day"]),
    day_cap: Number(budgets["api_usd_cap_day"] ?? 5),
    month_spent: Number(budgets["api_usd_spent_est_month"]),
    month_cap: Number(budgets["api_usd_cap_month"] ?? 40),
    invocations: Number(budgets["executor_invocations_day"]),
    inv_cap: Number(budgets["max_executor_invocations_day"] ?? 30),
  };
}
