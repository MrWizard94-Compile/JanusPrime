import type { Task, ValidationError } from "@aether/shared";
import { TaskQueue } from "@aether/task-queue";
import {
  ValidationKernel,
  parseAssetAction,
  parseAssetModId,
} from "@aether/validation-kernel";
import { resolveTaskWorkspace, WorkloadManager } from "@aether/workload-manager";
import type { JanusConfig } from "./config.js";
import { resolveOrchestratorRoot } from "./config.js";
import { AssetRunner } from "./asset-runner.js";

export interface AssetTaskResult {
  task_id: string;
  mod_id: string;
  action: "audit" | "run";
  passed: boolean;
  status: Task["status"];
  errors: ValidationError[];
  output?: string;
}

export class AssetTaskExecutor {
  private readonly orchestratorRoot: string;
  private readonly janusRoot: string;
  private readonly config: JanusConfig;
  private readonly queue: TaskQueue;
  private readonly kernel: ValidationKernel;
  private readonly assets: AssetRunner;

  constructor(janusRoot: string, config: JanusConfig) {
    this.janusRoot = janusRoot;
    this.config = config;
    this.orchestratorRoot = resolveOrchestratorRoot(janusRoot, config);
    this.queue = new TaskQueue(this.orchestratorRoot);
    this.kernel = new ValidationKernel();
    this.assets = new AssetRunner(janusRoot, config);
  }

  async execute(taskId: string): Promise<AssetTaskResult> {
    let task = await this.queue.get(taskId);
    const modId = parseAssetModId(task.spec, task.context_refs);
    const action = parseAssetAction(task.context_refs);

    if (!modId || !action) {
      throw new Error(`Task ${taskId} is missing asset mod id or action markers`);
    }

    if (task.status === "pending") {
      task = await this.queue.transition(taskId, "in_progress");
    } else if (task.status === "failed") {
      task = await this.queue.transition(taskId, "in_progress");
    }

    if (!task.worktree) {
      const workload = new WorkloadManager(this.orchestratorRoot);
      const created = await workload.createWorktree(task.workload ?? "omni32", {
        taskId: task.id,
      });
      task = await this.queue.setWorktree(task.id, created.name, task.workload);
    }

    const workspaceRoot = await resolveTaskWorkspace(this.orchestratorRoot, task);
    task = await this.queue.transition(taskId, "validating");

    const validation = await this.kernel.validateTask({
      repoRoot: this.orchestratorRoot,
      workspaceRoot,
      task,
    });

    let output: string | undefined;
    if (validation.passed && action === "run") {
      const runResult = await this.assets.runMod(modId, { method: "xbrz", build: false });
      output = runResult.stdout;
      if (runResult.exitCode !== 0) {
        const runErrors: ValidationError[] = [
          {
            layer: "build",
            rule: "A003",
            message: `Asset pipeline failed for mod ${modId} (exit ${runResult.exitCode})`,
            suggestion: trimOutput(runResult.stderr || runResult.stdout),
          },
        ];
        const failed = await this.queue.recordValidation(taskId, false, runErrors, true);
        return buildResult({
          taskId,
          modId,
          action,
          passed: false,
          status: failed.status,
          errors: runErrors,
          ...(output !== undefined ? { output } : {}),
        });
      }
    }

    const updated = await this.queue.recordValidation(
      taskId,
      validation.passed,
      validation.errors,
      true,
    );

    return buildResult({
      taskId,
      modId,
      action,
      passed: validation.passed,
      status: updated.status,
      errors: validation.errors,
      ...(output !== undefined ? { output } : {}),
    });
  }
}

function buildResult(input: {
  taskId: string;
  modId: string;
  action: "audit" | "run";
  passed: boolean;
  status: Task["status"];
  errors: ValidationError[];
  output?: string;
}): AssetTaskResult {
  const base: AssetTaskResult = {
    task_id: input.taskId,
    mod_id: input.modId,
    action: input.action,
    passed: input.passed,
    status: input.status,
    errors: input.errors,
  };

  if (input.output !== undefined) {
    return { ...base, output: input.output };
  }

  return base;
}

function trimOutput(output: string): string {
  const lines = output.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.slice(-8).join("\n");
}