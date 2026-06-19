import type { Task, TaskStatus } from "@aether/shared";
import { OrchestratorService, parsePatchMode } from "@aether/orchestrator";
import type { JanusConfig } from "./config.js";
import { resolveOrchestratorRoot } from "./config.js";
import { AssetTaskExecutor, type AssetTaskResult } from "./asset-task-executor.js";
import { ManualPatchExecutor } from "./manual-patch-executor.js";
import { JanusUnifiedService } from "./unified-service.js";

export interface LoopRoundResult {
  round: number;
  task_id: string;
  kind: "identity" | "asset" | "manual";
  status: TaskStatus;
  passed: boolean;
  detail?: string;
}

export interface AutonomousLoopResult {
  parent_id: string;
  rounds_executed: number;
  complete: boolean;
  rollup: Awaited<ReturnType<OrchestratorService["rollupStatus"]>>;
  round_results: LoopRoundResult[];
  seeded_tasks: string[];
}

export interface AutonomousLoopOptions {
  max_rounds?: number;
  seed_on_accept?: boolean;
}

export class JanusAutonomousLoop {
  private readonly config: JanusConfig;
  private readonly orchestrator: OrchestratorService;
  private readonly unified: JanusUnifiedService;
  private readonly assets: AssetTaskExecutor;
  private readonly manual: ManualPatchExecutor;

  constructor(janusRoot: string, config: JanusConfig) {
    this.config = config;
    const orchestratorRoot = resolveOrchestratorRoot(janusRoot, config);
    this.orchestrator = new OrchestratorService(orchestratorRoot);
    this.unified = new JanusUnifiedService(janusRoot, config);
    this.assets = new AssetTaskExecutor(janusRoot, config);
    this.manual = new ManualPatchExecutor(janusRoot, config);
  }

  async run(parentId: string, options?: AutonomousLoopOptions): Promise<AutonomousLoopResult> {
    const maxRounds =
      options?.max_rounds ?? this.config.self_repair.max_validation_retries;
    const seedOnAccept = options?.seed_on_accept ?? this.config.self_repair.seed_on_accept;

    try {
      const doctrineStatus = await this.unified.getDoctrineStatus();
      if (this.config.doctrine.seed_on_boot && !doctrineStatus.fresh) {
        await this.unified.seedDoctrine();
      }
    } catch {
      // Memory offline — non-fatal
    }

    await this.orchestrator.provisionChildren(parentId);

    const roundResults: LoopRoundResult[] = [];
    const seededTasks: string[] = [];
    let roundsExecuted = 0;

    for (let round = 1; round <= maxRounds; round += 1) {
      roundsExecuted = round;
      const children = await this.orchestrator.listChildren(parentId);
      const active = children.filter(
        (child) => child.status !== "accepted" && child.status !== "abandoned",
      );

      if (active.length === 0) {
        break;
      }

      for (const child of active) {
        const result = await this.executeChild(child);
        roundResults.push({ round, ...result });
      }

      if (seedOnAccept) {
        const refreshed = await this.orchestrator.listChildren(parentId);
        for (const child of refreshed) {
          if (child.status === "accepted" && !seededTasks.includes(child.id)) {
            try {
              await this.unified.seedAcceptedTask(child.id);
              seededTasks.push(child.id);
            } catch {
              // Memory service may be offline — non-fatal
            }
          }
        }
      }

      const rollup = await this.orchestrator.rollupStatus(parentId);
      if (rollup.complete) {
        return {
          parent_id: parentId,
          rounds_executed: roundsExecuted,
          complete: true,
          rollup,
          round_results: roundResults,
          seeded_tasks: seededTasks,
        };
      }
    }

    const finalRollup = await this.orchestrator.rollupStatus(parentId);
    return {
      parent_id: parentId,
      rounds_executed: roundsExecuted,
      complete: finalRollup.complete,
      rollup: finalRollup,
      round_results: roundResults,
      seeded_tasks: seededTasks,
    };
  }

  private async executeChild(
    child: Task,
  ): Promise<Omit<LoopRoundResult, "round">> {
    if (child.validation_profile === "asset-audit-v1" || child.workload === "omni32") {
      return this.executeAssetChild(child);
    }

    const patchMode = parsePatchMode(child);

    if (patchMode === "identity") {
      const result = await this.orchestrator.executeIdentityTask(child.id);
      return {
        task_id: child.id,
        kind: "identity",
        status: result.task.status,
        passed: result.validation.passed,
        detail: result.validation.passed ? "identity_patch_accepted" : "identity_patch_failed",
      };
    }

    const result = await this.manual.execute(child);
    return {
      task_id: child.id,
      kind: "manual",
      status: result.status,
      passed: result.passed,
      detail: `${result.action}:${result.detail ?? "ok"}`,
    };
  }

  private async executeAssetChild(child: Task): Promise<Omit<LoopRoundResult, "round">> {
    const result: AssetTaskResult = await this.assets.execute(child.id);
    return {
      task_id: child.id,
      kind: "asset",
      status: result.status,
      passed: result.passed,
      detail: `${result.action}:${result.mod_id}`,
    };
  }
}