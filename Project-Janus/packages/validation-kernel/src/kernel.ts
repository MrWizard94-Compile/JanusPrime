import type { PatchProposal, Task, ValidationProfile } from "@aether/shared";
import { getValidationProfile } from "@aether/shared";
import { loadAetherConfig } from "./config.js";
import { diagnoseResult } from "./gate-infra.js";
import { runAstLayer } from "./layers/ast.js";
import { runBuildLayer } from "./layers/build.js";
import { runLspLayer } from "./layers/lsp.js";
import { runRulesLayer } from "./layers/rules.js";
import { applyPatch, revertWorkspace } from "./patch.js";
import { writeReceipt } from "./receipt.js";
import type { ValidationResult } from "./types.js";

export interface ValidateOptions {
  repoRoot: string;
  workspaceRoot: string;
  task: Task;
  proposal: PatchProposal;
  persistOnPass?: boolean;
}

export interface ValidateTaskOptions {
  repoRoot: string;
  workspaceRoot: string;
  task: Task;
}

export class ValidationKernel {
  async validateTask(options: ValidateTaskOptions): Promise<ValidationResult> {
    const profile = getValidationProfile(options.task.validation_profile);
    const config = await loadAetherConfig(options.repoRoot);

    const noopProposal: PatchProposal = {
      task_id: options.task.id,
      files: [{ path: ".aether/validation-noop", content: "" }],
    };

    return this.runLayers(
      profile,
      noopProposal,
      options.task,
      options.workspaceRoot,
      config,
    );
  }

  async validate(options: ValidateOptions): Promise<ValidationResult> {
    const profile = getValidationProfile(options.task.validation_profile);
    const config = await loadAetherConfig(options.repoRoot);

    await applyPatch(options.workspaceRoot, options.proposal);

    try {
      const result = await this.runLayers(
        profile,
        options.proposal,
        options.task,
        options.workspaceRoot,
        config,
      );

      await writeReceipt(
        options.repoRoot,
        options.proposal,
        result.passed,
        options.workspaceRoot,
        profile.id,
      );

      if (!result.passed || !options.persistOnPass) {
        await revertWorkspace(options.workspaceRoot, options.proposal);
      }

      return result;
    } catch (error) {
      await revertWorkspace(options.workspaceRoot, options.proposal);
      throw error;
    }
  }

  private async runLayers(
    profile: ValidationProfile,
    proposal: PatchProposal,
    task: Task,
    workspaceRoot: string,
    config: Awaited<ReturnType<typeof loadAetherConfig>>,
  ): Promise<ValidationResult> {
    const layers = [];

    if (profile.layers.includes("lsp")) {
      layers.push(await runLspLayer(proposal, workspaceRoot, config));
    }

    if (profile.layers.includes("ast")) {
      layers.push(runAstLayer(proposal));
    }

    if (profile.layers.includes("rules")) {
      layers.push(
        runRulesLayer(profile, {
          proposal,
          spec: task.spec,
          context_refs: task.context_refs,
        }),
      );
    }

    if (profile.layers.includes("build")) {
      layers.push(await runBuildLayer(profile, workspaceRoot, config, task));
    }

    const errors = layers.flatMap((layer) => layer.errors);
    const passed = layers.every((layer) => !layer.ran || layer.passed);

    const result: ValidationResult = {
      passed,
      profile_id: profile.id,
      workspace_root: workspaceRoot,
      layers,
      errors,
    };

    // Classify harness-infra failures so consumers don't blame the executor
    // patch for a broken gate. The validator inspecting its own failures.
    const harnessInfra = diagnoseResult(result);
    if (harnessInfra.length > 0) {
      result.harness_infra = harnessInfra;
    }

    return result;
  }
}