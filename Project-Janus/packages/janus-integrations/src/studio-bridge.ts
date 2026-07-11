/**
 * @janus/studio-bridge surface (PR-06/07) — lives in integrations to avoid monorepo churn.
 * Transforms janus_job → DelegationPlan; projects .aether tasks into BLACKBOARD via file RMW.
 */
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";

export interface JanusJob {
  schema_version?: string;
  kind: "janus_job";
  workload: string;
  validation_profile: string;
  objective: string;
  files_in_scope?: string[];
  constraints?: string[];
  acceptance_criteria?: string[];
  patch_mode?: "manual" | "identity";
  parent_task_id?: string | null;
  context_refs?: string[];
}

export interface DelegationPlan {
  parent: {
    assignee: "claude";
    workload: null;
    validation_profile: string;
    context_refs: string[];
    spec: {
      objective: string;
      constraints: string[];
      files_in_scope: string[];
      acceptance_criteria: string[];
    };
  };
  children: Array<{
    assignee: "grok";
    patch_mode: "manual" | "identity";
    task: {
      workload: string;
      validation_profile: string;
      context_refs: string[];
      spec: {
        objective: string;
        constraints: string[];
        files_in_scope: string[];
        acceptance_criteria: string[];
      };
    };
  }>;
  provision: { auto_worktree: boolean; auto_prepare: boolean };
}

export function transformJanusJobToDelegationPlan(job: JanusJob): DelegationPlan {
  if (job.kind !== "janus_job") {
    throw new Error(`kind must be janus_job, got: ${String(job.kind)}`);
  }
  if (!job.workload) throw new Error("workload required");
  if (!job.objective) throw new Error("objective required");
  if (!job.validation_profile) throw new Error("validation_profile required");

  const contextRefs = [...(job.context_refs ?? [])];
  if (!contextRefs.includes("doc:claude")) {
    contextRefs.unshift("doc:claude");
  }
  const patchMode = job.patch_mode === "identity" ? "identity" : "manual";
  const constraints = job.constraints ?? [];
  const acceptance = job.acceptance_criteria ?? [];
  const files = job.files_in_scope ?? [];

  return {
    parent: {
      assignee: "claude",
      workload: null,
      validation_profile: job.validation_profile,
      context_refs: contextRefs,
      spec: {
        objective: `Coordinate: ${job.objective}`,
        constraints: ["Studio bridge created plan from janus_job", ...constraints],
        files_in_scope: [],
        acceptance_criteria: ["All children accepted"],
      },
    },
    children: [
      {
        assignee: "grok",
        patch_mode: patchMode,
        task: {
          workload: job.workload,
          validation_profile: job.validation_profile,
          context_refs: contextRefs,
          spec: {
            objective: job.objective,
            constraints,
            files_in_scope: files,
            acceptance_criteria: acceptance,
          },
        },
      },
    ],
    provision: { auto_worktree: true, auto_prepare: false },
  };
}

const DEFAULT_BB =
  process.env["WPAI_BLACKBOARD_PATH"] ||
  "C:\\WPAI\\Workspace\\.wpai\\BLACKBOARD.json";
const DEFAULT_TASKS =
  process.env["WPAI_AETHER_TASKS"] ||
  "C:\\WPAI\\AI-Research\\Janus\\.aether\\tasks.json";

async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp.${process.pid}.${randomBytes(4).toString("hex")}`;
  await writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await rename(tmp, path);
}

/**
 * Project Janus task counts into BLACKBOARD.janus (single-writer RMW + generation).
 */
export async function projectJanusOntoBlackboard(options?: {
  tasksPath?: string;
  blackboardPath?: string;
}): Promise<{ open_tasks: number; failed_tasks: number; generation: number }> {
  const tasksPath = options?.tasksPath ?? DEFAULT_TASKS;
  const bbPath = options?.blackboardPath ?? DEFAULT_BB;

  let open = 0;
  let failed = 0;
  const parents: string[] = [];

  if (existsSync(tasksPath)) {
    try {
      const data = JSON.parse(await readFile(tasksPath, "utf8")) as {
        tasks?: Record<string, { status?: string; parent_id?: string | null; id?: string }>;
      };
      const tasks = data.tasks ? Object.values(data.tasks) : [];
      for (const t of tasks) {
        const st = String(t.status ?? "");
        if (st === "pending" || st === "in_progress" || st === "validating") open += 1;
        if (st === "failed") failed += 1;
        if (!t.parent_id && t.id) parents.push(String(t.id));
      }
    } catch {
      // ignore parse errors
    }
  }

  let bb: Record<string, unknown> = {};
  if (existsSync(bbPath)) {
    try {
      bb = JSON.parse(await readFile(bbPath, "utf8")) as Record<string, unknown>;
    } catch {
      bb = {};
    }
  }
  const gen = Number(bb["generation"] ?? 0);
  const janus = (bb["janus"] as Record<string, unknown>) ?? {};
  janus["open_tasks"] = open;
  janus["failed_tasks"] = failed;
  janus["parents"] = parents.slice(0, 20);
  janus["last_loop"] = new Date().toISOString();
  bb["janus"] = janus;
  bb["generation"] = gen + 1;
  bb["updated_at"] = new Date().toISOString();
  await atomicWriteJson(bbPath, bb);
  return { open_tasks: open, failed_tasks: failed, generation: Number(bb["generation"]) };
}

export async function writeDelegationPlanFile(
  plan: DelegationPlan,
  plansDir = "C:\\WPAI\\Workspace\\.wpai\\plans",
): Promise<string> {
  await mkdir(plansDir, { recursive: true });
  const id = randomBytes(6).toString("hex");
  const path = join(plansDir, `${id}-delegation.json`);
  await atomicWriteJson(path, plan);
  return path;
}
