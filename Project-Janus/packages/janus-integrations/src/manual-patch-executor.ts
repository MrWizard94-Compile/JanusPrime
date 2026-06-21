import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PatchProposal, Task, ValidationError } from "@aether/shared";
import { PatchProposalSchema } from "@aether/shared";
import { OrchestratorService } from "@aether/orchestrator";
import { TaskQueue } from "@aether/task-queue";
import { HandoffService, type SubmitPatchResult } from "@aether/validation-kernel";
import type { JanusConfig } from "./config.js";
import { applyClaudeAutoFixesToFiles } from "./claude-auto-fix.js";
import { JanusUnifiedService } from "./unified-service.js";

export interface ManualPatchResult {
  task_id: string;
  action:
    | "patch_applied"
    | "patch_submitted"
    | "patch_failed"
    | "pending_apply_completed"
    | "brief_prepared"
    | "repair_context_prepared";
  status: Task["status"];
  passed: boolean;
  detail?: string;
}

export class ManualPatchExecutor {
  private readonly janusRoot: string;
  private readonly stateDir: string;
  private readonly orchestrator: OrchestratorService;
  private readonly queue: TaskQueue;
  private readonly handoff: HandoffService;
  private readonly unified: JanusUnifiedService;

  constructor(janusRoot: string, config: JanusConfig) {
    // Task store, patch staging, and validation/apply all resolve to the
    // JanusPrime workspace root (.aether/), matching JanusUnifiedService and the
    // `aether` CLI's findRepoRoot — NOT the Project-Janus orchestrator subroot.
    // Rooting these at the subroot split the task store the loop/CLI read
    // (workspace .aether, 36 tasks) from the one this executor wrote (subroot
    // .aether, stale) — the .aether split-brain. orchestrator.root remains the
    // base for catalog-doc resolution inside JanusUnifiedService only.
    this.janusRoot = janusRoot;
    this.stateDir = join(janusRoot, config.components.orchestrator.state_dir);
    this.orchestrator = new OrchestratorService(janusRoot);
    this.queue = new TaskQueue(janusRoot);
    this.handoff = new HandoffService(janusRoot);
    this.unified = new JanusUnifiedService(janusRoot, config);
  }

  async execute(task: Task): Promise<ManualPatchResult> {
    if (task.result === "validation_passed_pending_apply") {
      return this.completePendingApply(task);
    }

    if (task.status === "failed") {
      return this.executeRepairRound(task);
    }

    const staged = await this.loadStagedPatch(task.id);
    if (staged) {
      return this.submitProposal(task, staged, true, "staged_patch");
    }

    if (task.spec.files_in_scope.length > 0) {
      try {
        const proposal = await this.buildWorkspaceProposal(task.id);
        return this.submitProposal(task, proposal, true, "workspace_snapshot");
      } catch {
        // Fall through to brief preparation
      }
    }

    const brief = await this.unified.buildUnifiedBrief(task.id);
    await this.queue.setResult(task.id, JSON.stringify(brief));

    if (task.status === "pending") {
      const updated = await this.queue.transition(task.id, "in_progress");
      return {
        task_id: task.id,
        action: "brief_prepared",
        status: updated.status,
        passed: false,
        detail: "executor_brief_prepared",
      };
    }

    return {
      task_id: task.id,
      action: "brief_prepared",
      status: task.status,
      passed: false,
      detail: "executor_brief_prepared",
    };
  }

  private async completePendingApply(task: Task): Promise<ManualPatchResult> {
    const staged = await this.loadStagedPatch(task.id);
    const proposal = staged ?? (await this.buildWorkspaceProposal(task.id));

    try {
      const updated = await this.handoff.applyValidatedPatch(
        this.janusRoot,
        proposal,
      );
      return {
        task_id: task.id,
        action: "pending_apply_completed",
        status: updated.status,
        passed: updated.status === "accepted",
        detail: "validation_receipt_applied",
      };
    } catch (error) {
      return {
        task_id: task.id,
        action: "patch_failed",
        status: task.status,
        passed: false,
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async executeRepairRound(task: Task): Promise<ManualPatchResult> {
    const repair = await this.unified.buildRepairContext(task.id);
    const errors = repair.validation_errors;

    let proposal: PatchProposal;
    try {
      proposal = await this.buildWorkspaceProposal(task.id);
    } catch (error) {
      await this.queue.setResult(
        task.id,
        JSON.stringify({ ...repair, doctrine_ref: "doc:claude" }),
      );
      return {
        task_id: task.id,
        action: "repair_context_prepared",
        status: task.status,
        passed: false,
        detail: error instanceof Error ? error.message : String(error),
      };
    }

    const fixedFiles = applyClaudeAutoFixesToFiles(proposal.files, errors);
    const repairedProposal: PatchProposal = {
      ...proposal,
      files: fixedFiles,
      allow_overwrite: true,
    };

    return this.submitProposal(task, repairedProposal, true, "memory_informed_repair");
  }

  private async submitProposal(
    task: Task,
    proposal: PatchProposal,
    apply: boolean,
    source: string,
  ): Promise<ManualPatchResult> {
    try {
      const result: SubmitPatchResult = await this.handoff.submit({
        repoRoot: this.janusRoot,
        proposal,
        apply,
      });

      return {
        task_id: task.id,
        action: result.applied ? "patch_applied" : "patch_submitted",
        status: result.task.status,
        passed: result.validation.passed,
        detail: result.validation.passed
          ? `${source}:${result.applied ? "applied" : "validated"}`
          : summarizeValidationErrors(result.validation.errors),
      };
    } catch (error) {
      return {
        task_id: task.id,
        action: "patch_failed",
        status: task.status,
        passed: false,
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async loadStagedPatch(taskId: string): Promise<PatchProposal | null> {
    const patchPath = join(this.stateDir, "patches", `${taskId}.json`);

    try {
      await access(patchPath);
    } catch {
      return null;
    }

    const raw = await readFile(patchPath, "utf8");
    return PatchProposalSchema.parse(JSON.parse(raw) as unknown);
  }

  private async buildWorkspaceProposal(taskId: string): Promise<PatchProposal> {
    return this.orchestrator.buildIdentityPatch(taskId);
  }
}

function summarizeValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return "validation_failed";
  }

  const preview = errors
    .slice(0, 3)
    .map((error) => `${error.rule ?? error.layer}:${error.message}`)
    .join("; ");

  return errors.length > 3 ? `${preview}; +${errors.length - 3} more` : preview;
}