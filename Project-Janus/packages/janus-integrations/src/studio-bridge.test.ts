import { describe, expect, it } from "vitest";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  projectJanusOntoBlackboard,
  transformJanusJobToDelegationPlan,
  writeDelegationPlanFile,
  type DelegationPlan,
  type JanusJob,
} from "./studio-bridge.js";

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
    expect(plan.parent.context_refs[0]).toBe("doc:claude");
  });

  it("rejects non-janus_job kind", () => {
    const bad = {
      kind: "not_a_job",
      workload: "nodecore",
      validation_profile: "forge-mod-v1",
      objective: "nope",
    } as unknown as JanusJob;
    expect(() => transformJanusJobToDelegationPlan(bad)).toThrow(
      /kind must be janus_job/,
    );
  });
});

describe("projectJanusOntoBlackboard", () => {
  it("projects open/failed task counts into temp BLACKBOARD from temp tasks.json", async () => {
    const dir = join(tmpdir(), `studio-proj-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await mkdir(dir, { recursive: true });
    const tasksPath = join(dir, "tasks.json");
    const blackboardPath = join(dir, "BLACKBOARD.json");

    await writeFile(
      tasksPath,
      JSON.stringify({
        tasks: {
          "parent-1": {
            id: "parent-1",
            parent_id: null,
            status: "in_progress",
          },
          "child-open": {
            id: "child-open",
            parent_id: "parent-1",
            status: "pending",
          },
          "child-validating": {
            id: "child-validating",
            parent_id: "parent-1",
            status: "validating",
          },
          "child-failed": {
            id: "child-failed",
            parent_id: "parent-1",
            status: "failed",
          },
          "child-done": {
            id: "child-done",
            parent_id: "parent-1",
            status: "accepted",
          },
        },
      }),
      "utf8",
    );

    await writeFile(
      blackboardPath,
      JSON.stringify({
        generation: 3,
        janus: { open_tasks: 0 },
        kill_switch: { global: false, loops: false },
      }),
      "utf8",
    );

    const result = await projectJanusOntoBlackboard({ tasksPath, blackboardPath });

    // pending + in_progress + validating = 3 open; 1 failed
    expect(result.open_tasks).toBe(3);
    expect(result.failed_tasks).toBe(1);
    expect(result.generation).toBe(4);

    const bb = JSON.parse(await readFile(blackboardPath, "utf8")) as {
      generation: number;
      janus: {
        open_tasks: number;
        failed_tasks: number;
        parents: string[];
        last_loop: string;
      };
      updated_at: string;
    };
    expect(bb.generation).toBe(4);
    expect(bb.janus.open_tasks).toBe(3);
    expect(bb.janus.failed_tasks).toBe(1);
    expect(bb.janus.parents).toEqual(["parent-1"]);
    expect(typeof bb.janus.last_loop).toBe("string");
    expect(typeof bb.updated_at).toBe("string");
  });

  it("creates BLACKBOARD when missing and tolerates empty tasks file", async () => {
    const dir = join(tmpdir(), `studio-empty-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await mkdir(dir, { recursive: true });
    const tasksPath = join(dir, "tasks.json");
    const blackboardPath = join(dir, "nested", "BLACKBOARD.json");

    await writeFile(tasksPath, JSON.stringify({ tasks: {} }), "utf8");

    const result = await projectJanusOntoBlackboard({ tasksPath, blackboardPath });
    expect(result.open_tasks).toBe(0);
    expect(result.failed_tasks).toBe(0);
    expect(result.generation).toBe(1);

    const bb = JSON.parse(await readFile(blackboardPath, "utf8")) as {
      generation: number;
      janus: { open_tasks: number; failed_tasks: number; parents: string[] };
    };
    expect(bb.generation).toBe(1);
    expect(bb.janus.parents).toEqual([]);
  });
});

describe("writeDelegationPlanFile", () => {
  it("writes valid JSON DelegationPlan to plans dir", async () => {
    const plansDir = join(
      tmpdir(),
      `studio-plans-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    const plan: DelegationPlan = transformJanusJobToDelegationPlan({
      kind: "janus_job",
      workload: "nodecore",
      validation_profile: "typescript-v1",
      objective: "ship bridge tests",
      constraints: ["no paid APIs"],
      acceptance_criteria: ["tests green"],
      patch_mode: "identity",
    });

    const path = await writeDelegationPlanFile(plan, plansDir);
    expect(path.endsWith("-delegation.json")).toBe(true);
    expect(path.startsWith(plansDir)).toBe(true);

    const loaded = JSON.parse(await readFile(path, "utf8")) as DelegationPlan;
    expect(loaded.parent.assignee).toBe("claude");
    expect(loaded.children).toHaveLength(1);
    expect(loaded.children[0]?.patch_mode).toBe("identity");
    expect(loaded.children[0]?.task.workload).toBe("nodecore");
    expect(loaded.children[0]?.task.spec.objective).toBe("ship bridge tests");
    expect(loaded.provision.auto_worktree).toBe(true);
  });
});
