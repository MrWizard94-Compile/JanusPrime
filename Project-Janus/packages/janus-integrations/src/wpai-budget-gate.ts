/**
 * WPAI overnight budget / kill gate (PR-09).
 * Reads Workspace\.wpai\BLACKBOARD.json; never spends money — only estimates.
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

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
