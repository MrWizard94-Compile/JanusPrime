import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Task, ValidationError } from "@aether/shared";
import { TaskQueue } from "@aether/task-queue";
import { resolveTaskWorkspace } from "@aether/workload-manager";
import type { JanusConfig } from "./config.js";
import { resolveOrchestratorRoot } from "./config.js";
import { MemoryClient, type HealReport } from "./memory-client.js";

export interface PythonSandboxResult {
  task_id: string;
  passed: boolean;
  status: Task["status"];
  heal_status: HealReport["status"];
  attempts?: number;
  source_files: string[];
  errors: ValidationError[];
  stdout?: string;
}

export interface PythonSandboxExecutorOptions {
  memory?: MemoryClient;
}

export class PythonSandboxExecutor {
  private readonly orchestratorRoot: string;
  private readonly queue: TaskQueue;
  private readonly memory: MemoryClient;

  constructor(
    janusRoot: string,
    config: JanusConfig,
    options?: PythonSandboxExecutorOptions,
  ) {
    this.orchestratorRoot = resolveOrchestratorRoot(janusRoot, config);
    this.queue = new TaskQueue(this.orchestratorRoot);
    this.memory = options?.memory ?? new MemoryClient(config.components.memory);
  }

  async execute(taskId: string): Promise<PythonSandboxResult> {
    let task = await this.queue.get(taskId);

    if (task.spec.files_in_scope.length === 0) {
      throw new Error(
        `Task ${taskId} has no files_in_scope for python-sandbox-v1 validation`,
      );
    }

    if (task.status === "pending") {
      task = await this.queue.transition(taskId, "in_progress");
    } else if (task.status === "failed") {
      task = await this.queue.transition(taskId, "in_progress");
    }

    const workspaceRoot = await this.resolveWorkspace(task);
    const { code, sourceFiles } = await this.readPythonFromScope(
      workspaceRoot,
      task.spec.files_in_scope,
    );

    task = await this.queue.transition(taskId, "validating");

    let report: HealReport;
    try {
      report = await this.memory.heal(code);
    } catch (error) {
      const errors: ValidationError[] = [
        {
          layer: "build",
          rule: "PY002",
          message:
            error instanceof Error
              ? `Memory heal request failed: ${error.message}`
              : `Memory heal request failed: ${String(error)}`,
        },
      ];
      const updated = await this.queue.recordValidation(taskId, false, errors, true);
      return {
        task_id: taskId,
        passed: false,
        status: updated.status,
        heal_status: "Failed",
        source_files: sourceFiles,
        errors,
      };
    }

    const passed = report.status === "Success" || report.status === "Healed";
    const errors = passed ? [] : buildHealErrors(report);

    const updated = await this.queue.recordValidation(taskId, passed, errors, true);

    const result: PythonSandboxResult = {
      task_id: taskId,
      passed,
      status: updated.status,
      heal_status: report.status,
      source_files: sourceFiles,
      errors,
    };

    if (report.attempts !== undefined) {
      result.attempts = report.attempts;
    }
    if (report.stdout) {
      result.stdout = report.stdout;
    }

    return result;
  }

  private async resolveWorkspace(task: Task): Promise<string> {
    if (!task.worktree) {
      return this.orchestratorRoot;
    }

    return resolveTaskWorkspace(this.orchestratorRoot, task);
  }

  private async readPythonFromScope(
    workspaceRoot: string,
    filesInScope: readonly string[],
  ): Promise<{ code: string; sourceFiles: string[] }> {
    const chunks: string[] = [];
    const sourceFiles: string[] = [];

    for (const relativePath of filesInScope) {
      const absolutePath = join(workspaceRoot, relativePath);
      const content = await readFile(absolutePath, "utf8");
      sourceFiles.push(relativePath);
      chunks.push(`# --- ${relativePath} ---\n${content}`);
    }

    return {
      code: chunks.join("\n\n"),
      sourceFiles,
    };
  }
}

function buildHealErrors(report: HealReport): ValidationError[] {
  return [
    {
      layer: "build",
      rule: "PY001",
      message: report.error ?? `Sandbox heal failed with status ${report.status}`,
      suggestion: trimOutput(report.stdout ?? ""),
    },
  ];
}

function trimOutput(output: string): string {
  const lines = output.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.slice(-8).join("\n");
}