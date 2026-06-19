import { ContextResolver, type ResolvedContextDocument } from "@aether/context";
import type { ValidationError } from "@aether/shared";
import {
  CONTEXT_CATALOG,
  ORCHESTRATOR_ONLY_CONTEXT_REFS,
  REL_STATE_CONTEXT_REF,
} from "@aether/shared";
import { TaskQueue } from "@aether/task-queue";
import { OrchestratorService, publicContextRefs, type ExecutorBrief } from "@aether/orchestrator";
import type { JanusConfig } from "./config.js";
import { resolveOrchestratorRoot } from "./config.js";
import { AssetRunner } from "./asset-runner.js";
import { MemoryClient } from "./memory-client.js";
import { RelBridge } from "./rel-bridge.js";
import { excerptSoul, hashSoul, loadSoul } from "./soul.js";

export interface ResolvedContextExcerpt {
  ref: string;
  excerpt: string;
}

export interface UnifiedBrief extends ExecutorBrief {
  doctrine_ref: "doc:soul";
  soul_doctrine?: string;
  resolved_context?: ResolvedContextExcerpt[];
  memory_context?: string[];
  repair_hints?: string[];
  token_estimate_chars: number;
}

export interface SystemStatus {
  janus_root: string;
  orchestrator_root: string;
  memory: { status: string; detail?: string };
  cognition?: {
    configured: boolean;
    reachable: boolean;
    status?: string;
    detail?: string;
  };
  assets: { queue_available: boolean };
  tasks: { total: number; by_status: Record<string, number> };
}

export interface RepairContext {
  task_id: string;
  validation_errors: ValidationError[];
  memory_slices: string[];
  repair_query: string;
  soul_doctrine?: string;
  resolved_context_hint?: ResolvedContextExcerpt;
}

export interface DoctrineStatus {
  fresh: boolean;
  content_hash: string;
  stored_count: number;
  soul_path: string;
  memory_reachable: boolean;
  detail?: string;
}

export class JanusUnifiedService {
  private readonly janusRoot: string;
  private readonly config: JanusConfig;
  private readonly orchestratorRoot: string;
  private readonly memory: MemoryClient;
  private readonly assets: AssetRunner;
  private readonly orchestrator: OrchestratorService;
  private readonly queue: TaskQueue;
  private readonly relBridge: RelBridge;
  private soulCache: string | null = null;

  constructor(janusRoot: string, config: JanusConfig) {
    this.janusRoot = janusRoot;
    this.config = config;
    this.orchestratorRoot = resolveOrchestratorRoot(janusRoot, config);
    this.memory = new MemoryClient(config.components.memory);
    this.assets = new AssetRunner(janusRoot, config);
    this.orchestrator = new OrchestratorService(this.orchestratorRoot);
    this.queue = new TaskQueue(this.orchestratorRoot);
    this.relBridge = new RelBridge(janusRoot, config);
  }

  async getSoulExcerpt(): Promise<string | undefined> {
    if (!this.config.doctrine.inject_into_brief) {
      return undefined;
    }
    if (!this.soulCache) {
      this.soulCache = await loadSoul(this.janusRoot, this.config);
    }
    return excerptSoul(this.soulCache, this.config.doctrine.brief_excerpt_max_chars);
  }

  async buildUnifiedBrief(taskId: string): Promise<UnifiedBrief> {
    const brief = await this.orchestrator.buildExecutorBrief(taskId);
    const soulDoctrine = await this.getSoulExcerpt();

    const unified: UnifiedBrief = {
      ...brief,
      doctrine_ref: "doc:soul",
      token_estimate_chars: estimateChars(brief),
    };

    if (soulDoctrine) {
      unified.soul_doctrine = soulDoctrine;
      unified.token_estimate_chars += soulDoctrine.length;
    }

    const queryParts = [brief.objective, ...brief.files_in_scope];
    if (brief.last_validation_errors?.length) {
      const errorSummary = brief.last_validation_errors
        .slice(0, this.config.token_policy.validation_error_max)
        .map((error) => `${error.layer}:${error.rule ?? "unknown"} ${error.message}`)
        .join("; ");
      queryParts.push(errorSummary);
    }

    try {
      const memorySlices = await this.memory.queryContextSlices(queryParts.join(" "));
      if (memorySlices.length > 0) {
        unified.memory_context = memorySlices.map((slice) =>
          truncate(slice, this.config.token_policy.memory_slice_max_chars),
        );
        unified.token_estimate_chars += unified.memory_context.join("").length;
        unified.repair_hints = memorySlices.slice(0, 1).map((slice) =>
          truncate(slice, this.config.token_policy.memory_slice_max_chars),
        );
      }
    } catch {
      unified.memory_context = [];
    }

    const refsToResolve = selectCatalogContextRefs(brief.context_refs, {
      skipSoulDuplicate: Boolean(soulDoctrine),
    });

    try {
      const resolvedContext = await buildResolvedContext(
        this.orchestratorRoot,
        refsToResolve,
        this.config.token_policy.resolved_context_max_chars,
      );
      if (resolvedContext.length > 0) {
        unified.resolved_context = resolvedContext;
        unified.token_estimate_chars += resolvedContext.reduce(
          (sum, item) => sum + item.excerpt.length,
          0,
        );
      }
    } catch {
      // Non-fatal if catalog documents are unavailable
    }

    if (
      brief.assignee === "claude" &&
      brief.context_refs.includes(REL_STATE_CONTEXT_REF) &&
      this.config.components.cognition
    ) {
      try {
        const relExcerpt = await this.relBridge.getStateExcerpt(
          this.config.token_policy.rel_context_max_chars,
        );
        if (relExcerpt) {
          const relContext = unified.resolved_context ?? [];
          relContext.push({ ref: REL_STATE_CONTEXT_REF, excerpt: relExcerpt });
          unified.resolved_context = relContext;
          unified.token_estimate_chars += relExcerpt.length;
        }
      } catch {
        // REL offline — non-fatal
      }
    }

    unified.token_estimate_chars = Math.min(
      unified.token_estimate_chars,
      this.config.token_policy.brief_max_chars,
    );

    return unified;
  }

  async buildRepairContext(taskId: string): Promise<RepairContext> {
    const task = await this.queue.get(taskId);
    const lastAttempt = task.validation_attempts.at(-1);

    if (!lastAttempt || lastAttempt.passed) {
      throw new Error(`Task ${taskId} has no failed validation attempt to repair from`);
    }

    const errors = lastAttempt.errors.slice(0, this.config.token_policy.validation_error_max);
    const repairQuery = [
      task.spec.objective,
      ...errors.map((error) => `${error.file ?? ""} ${error.message}`),
    ].join(" ");

    let memorySlices: string[] = [];
    try {
      memorySlices = await this.memory.queryContextSlices(repairQuery);
    } catch {
      memorySlices = [];
    }

    const context: RepairContext = {
      task_id: taskId,
      validation_errors: errors,
      memory_slices: memorySlices,
      repair_query: repairQuery,
    };

    const soulDoctrine = await this.getSoulExcerpt();
    if (soulDoctrine) {
      context.soul_doctrine = soulDoctrine;
    }

    const refsToResolve = selectCatalogContextRefs(publicContextRefs(task.context_refs), {
      skipSoulDuplicate: Boolean(soulDoctrine),
    });

    try {
      const resolvedContext = await buildResolvedContext(
        this.orchestratorRoot,
        refsToResolve,
        this.config.token_policy.resolved_context_max_chars,
      );
      const topResolved = resolvedContext[0];
      if (topResolved) {
        context.resolved_context_hint = {
          ref: topResolved.ref,
          excerpt: truncate(topResolved.excerpt, this.config.token_policy.memory_slice_max_chars),
        };
      }
    } catch {
      // Non-fatal if catalog documents are unavailable
    }

    return context;
  }

  async getDoctrineStatus(): Promise<DoctrineStatus> {
    const content = await loadSoul(this.janusRoot, this.config);
    const contentHash = hashSoul(content);

    try {
      const status = await this.memory.getDoctrineStatus(contentHash);
      return {
        fresh: status.fresh,
        content_hash: contentHash,
        stored_count: status.stored_count,
        soul_path: this.config.doctrine.soul_path,
        memory_reachable: true,
      };
    } catch (error) {
      return {
        fresh: false,
        content_hash: contentHash,
        stored_count: 0,
        soul_path: this.config.doctrine.soul_path,
        memory_reachable: false,
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async seedDoctrine(): Promise<{ seeded: boolean; message?: string }> {
    const content = await loadSoul(this.janusRoot, this.config);
    const result = await this.memory.seed(content, "Operational Doctrine", "All");
    return { seeded: true, message: result.message };
  }

  async seedRepairPattern(taskId: string): Promise<{ seeded: boolean; message?: string }> {
    const task = await this.queue.get(taskId);

    const errors = task.validation_attempts
      .filter((attempt) => !attempt.passed)
      .flatMap((attempt) => attempt.errors)
      .slice(0, this.config.token_policy.validation_error_max)
      .map((error) => {
        const entry: { message: string; file?: string; rule?: string } = {
          message: error.message,
        };
        if (error.file !== undefined) {
          entry.file = error.file;
        }
        if (error.rule !== undefined) {
          entry.rule = error.rule;
        }
        return entry;
      });

    const result = await this.memory.seedRepairPattern({
      objective: task.spec.objective,
      errors,
      resolution: task.result ?? "accepted",
      profile: task.validation_profile,
    });

    return { seeded: true, message: result.message };
  }

  async seedAcceptedTask(taskId: string): Promise<{ seeded: boolean; message?: string }> {
    if (!this.config.self_repair.seed_on_accept) {
      return { seeded: false, message: "seed_on_accept disabled" };
    }

    const task = await this.queue.get(taskId);
    if (task.status !== "accepted") {
      throw new Error(`Task ${taskId} is not accepted (status: ${task.status})`);
    }

    const hadPriorFailure = task.validation_attempts.some((attempt) => !attempt.passed);
    if (hadPriorFailure && this.config.self_repair.seed_on_heal) {
      return this.seedRepairPattern(taskId);
    }

    const soulExcerpt = await this.getSoulExcerpt();
    const content = [
      soulExcerpt ? `Doctrine: ${soulExcerpt.slice(0, 500)}` : "",
      `Objective: ${task.spec.objective}`,
      `Files: ${task.spec.files_in_scope.join(", ")}`,
      `Profile: ${task.validation_profile}`,
      `Constraints: ${task.spec.constraints.join("; ")}`,
      `Result: ${task.result ?? "accepted"}`,
    ]
      .filter((line) => line.length > 0)
      .join("\n");

    const result = await this.memory.seed(content, "Accepted Task Pattern", "All");
    return { seeded: true, message: result.message };
  }

  async getSystemStatus(): Promise<SystemStatus> {
    const tasks = await this.queue.list();
    const by_status: Record<string, number> = {};

    for (const task of tasks) {
      by_status[task.status] = (by_status[task.status] ?? 0) + 1;
    }

    let memoryStatus: { status: string; detail?: string } = { status: "unknown" };
    try {
      const health = await this.memory.health();
      memoryStatus = health.detail
        ? { status: health.status, detail: health.detail }
        : { status: health.status };
    } catch (error) {
      memoryStatus = {
        status: "unreachable",
        detail: error instanceof Error ? error.message : String(error),
      };
    }

    let queueAvailable = false;
    try {
      await this.assets.queue();
      queueAvailable = true;
    } catch {
      queueAvailable = false;
    }

    const status: SystemStatus = {
      janus_root: this.janusRoot,
      orchestrator_root: this.orchestratorRoot,
      memory: memoryStatus,
      assets: { queue_available: queueAvailable },
      tasks: { total: tasks.length, by_status },
    };

    if (this.config.components.cognition) {
      const cognition = await this.relBridge.getStatus();
      const cognitionStatus: NonNullable<SystemStatus["cognition"]> = {
        configured: cognition.configured,
        reachable: cognition.reachable,
      };
      if (cognition.health?.status) {
        cognitionStatus.status = cognition.health.status;
      }
      const detail = cognition.detail ?? cognition.state_summary?.summary;
      if (detail) {
        cognitionStatus.detail = detail;
      }
      status.cognition = cognitionStatus;
    }

    return status;
  }

  async syncRelConceptsToMemory(query?: string): Promise<{ seeded: boolean; message?: string }> {
    return this.relBridge.syncConceptsToMemory(this.memory, query);
  }
}

export function selectCatalogContextRefs(
  contextRefs: readonly string[],
  options: { skipSoulDuplicate: boolean },
): string[] {
  const selected: string[] = [];

  for (const ref of contextRefs) {
    if (!(ref in CONTEXT_CATALOG)) {
      continue;
    }
    if (ORCHESTRATOR_ONLY_CONTEXT_REFS.has(ref)) {
      continue;
    }
    if (options.skipSoulDuplicate && ref === "doc:soul") {
      continue;
    }
    selected.push(ref);
  }

  return selected;
}

export async function buildResolvedContext(
  orchestratorRoot: string,
  refs: readonly string[],
  maxTotalChars: number,
): Promise<ResolvedContextExcerpt[]> {
  if (refs.length === 0 || maxTotalChars <= 0) {
    return [];
  }

  const resolver = new ContextResolver(orchestratorRoot);
  const bundle = await resolver.resolve(refs);
  const resolved: ResolvedContextExcerpt[] = [];
  let remaining = maxTotalChars;

  for (const entry of bundle.entries) {
    if (remaining <= 0) {
      break;
    }

    const parts: string[] = [];
    for (const relativePath of entry.files) {
      const normalizedPath = relativePath.replace(/\\/g, "/");
      const document = bundle.documents.find(
        (candidate: ResolvedContextDocument) => candidate.path === normalizedPath,
      );
      if (document) {
        parts.push(document.content);
      }
    }

    const combined = parts.join("\n\n");
    const excerpt = truncate(combined, remaining);
    if (excerpt.length === 0) {
      continue;
    }

    resolved.push({ ref: entry.ref, excerpt });
    remaining -= excerpt.length;
  }

  return resolved;
}

function estimateChars(brief: ExecutorBrief): number {
  return (
    brief.objective.length +
    brief.constraints.join("").length +
    brief.files_in_scope.join("").length +
    (brief.last_validation_errors?.reduce((sum, error) => sum + error.message.length, 0) ?? 0)
  );
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars - 3)}...`;
}