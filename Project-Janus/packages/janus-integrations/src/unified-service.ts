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
import { excerptClaude, hashClaude, loadClaude } from "./claude.js";

export interface ResolvedContextExcerpt {
  ref: string;
  excerpt: string;
}

export interface UnifiedBrief extends ExecutorBrief {
  doctrine_ref: "doc:claude";
  claude_doctrine?: string;
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
  claude_doctrine?: string;
  resolved_context_hint?: ResolvedContextExcerpt;
}

export interface DoctrineStatus {
  fresh: boolean;
  content_hash: string;
  stored_count: number;
  claude_path: string;
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
  private claudeCache: string | null = null;

  constructor(janusRoot: string, config: JanusConfig) {
    this.janusRoot = janusRoot;
    this.config = config;
    this.orchestratorRoot = resolveOrchestratorRoot(janusRoot, config);
    this.memory = new MemoryClient(config.components.memory);
    this.assets = new AssetRunner(janusRoot, config);
    // Task queue + orchestration state live at JanusPrime workspace root (.aether/),
    // matching `aether orchestrate` / `findRepoRoot` — not Project-Janus subfolder.
    this.orchestrator = new OrchestratorService(janusRoot);
    this.queue = new TaskQueue(janusRoot);
    this.relBridge = new RelBridge(janusRoot, config);
  }

  async getClaudeExcerpt(): Promise<string | undefined> {
    if (!this.config.doctrine.inject_into_brief) {
      return undefined;
    }
    if (!this.claudeCache) {
      this.claudeCache = await loadClaude(this.janusRoot, this.config);
    }
    return excerptClaude(this.claudeCache, this.config.doctrine.brief_excerpt_max_chars);
  }

  async buildUnifiedBrief(taskId: string): Promise<UnifiedBrief> {
    const brief = await this.orchestrator.buildExecutorBrief(taskId);
    const claudeDoctrine = await this.getClaudeExcerpt();

    const unified: UnifiedBrief = {
      ...brief,
      doctrine_ref: "doc:claude",
      token_estimate_chars: estimateChars(brief),
    };

    if (claudeDoctrine) {
      unified.claude_doctrine = claudeDoctrine;
      unified.token_estimate_chars += claudeDoctrine.length;
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
      skipClaudeDuplicate: Boolean(claudeDoctrine),
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

    return enforceBriefBudget(unified, this.config.token_policy.brief_max_chars);
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

    const claudeDoctrine = await this.getClaudeExcerpt();
    if (claudeDoctrine) {
      context.claude_doctrine = claudeDoctrine;
    }

    const refsToResolve = selectCatalogContextRefs(publicContextRefs(task.context_refs), {
      skipClaudeDuplicate: Boolean(claudeDoctrine),
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
    const content = await loadClaude(this.janusRoot, this.config);
    const contentHash = hashClaude(content);

    try {
      const status = await this.memory.getDoctrineStatus(contentHash);
      return {
        fresh: status.fresh,
        content_hash: contentHash,
        stored_count: status.stored_count,
        claude_path: this.config.doctrine.claude_path,
        memory_reachable: true,
      };
    } catch (error) {
      return {
        fresh: false,
        content_hash: contentHash,
        stored_count: 0,
        claude_path: this.config.doctrine.claude_path,
        memory_reachable: false,
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async seedDoctrine(): Promise<{ seeded: boolean; message?: string }> {
    const content = await loadClaude(this.janusRoot, this.config);
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

    const claudeExcerpt = await this.getClaudeExcerpt();
    const content = [
      claudeExcerpt ? `Doctrine: ${claudeExcerpt.slice(0, 500)}` : "",
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
  options: { skipClaudeDuplicate: boolean },
): string[] {
  const selected: string[] = [];

  for (const ref of contextRefs) {
    if (!(ref in CONTEXT_CATALOG)) {
      continue;
    }
    if (ORCHESTRATOR_ONLY_CONTEXT_REFS.has(ref)) {
      continue;
    }
    if (options.skipClaudeDuplicate && ref === "doc:claude") {
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

export function measureBriefContentChars(unified: UnifiedBrief): number {
  const base = estimateChars(unified);
  const claude = unified.claude_doctrine?.length ?? 0;
  const resolved =
    unified.resolved_context?.reduce((sum, item) => sum + item.excerpt.length, 0) ?? 0;
  const memory = unified.memory_context?.join("").length ?? 0;
  const repair = unified.repair_hints?.join("").length ?? 0;
  return base + claude + resolved + memory + repair;
}

export function enforceBriefBudget(unified: UnifiedBrief, maxChars: number): UnifiedBrief {
  const result: UnifiedBrief = { ...unified };

  if (unified.memory_context) {
    result.memory_context = [...unified.memory_context];
  }
  if (unified.repair_hints) {
    result.repair_hints = [...unified.repair_hints];
  }
  if (unified.resolved_context) {
    result.resolved_context = unified.resolved_context.map((item) => ({ ...item }));
  }

  if (measureBriefContentChars(result) <= maxChars) {
    result.token_estimate_chars = measureBriefContentChars(result);
    return result;
  }

  truncateMemoryContext(result, maxChars);
  truncateRepairHints(result, maxChars);
  truncateResolvedContext(result, maxChars);
  truncateClaudeDoctrine(result, maxChars);

  if (measureBriefContentChars(result) > maxChars) {
    truncateBaseBriefFields(result, maxChars);
  }

  if (measureBriefContentChars(result) > maxChars) {
    proportionallyTruncateBrief(result, maxChars);
  }

  result.token_estimate_chars = measureBriefContentChars(result);
  return result;
}

function truncateMemoryContext(unified: UnifiedBrief, maxChars: number): void {
  if (!unified.memory_context) {
    return;
  }

  while (measureBriefContentChars(unified) > maxChars && unified.memory_context.length > 0) {
    const lastIndex = unified.memory_context.length - 1;
    const lastSlice = unified.memory_context[lastIndex]!;
    const excess = measureBriefContentChars(unified) - maxChars;

    if (lastSlice.length > excess && lastSlice.length > 3) {
      unified.memory_context[lastIndex] = truncate(lastSlice, lastSlice.length - excess);
      break;
    }

    unified.memory_context.pop();
  }

  if (unified.memory_context.length === 0) {
    delete unified.memory_context;
  }
}

function truncateRepairHints(unified: UnifiedBrief, maxChars: number): void {
  if (!unified.repair_hints) {
    return;
  }

  while (measureBriefContentChars(unified) > maxChars && unified.repair_hints.length > 0) {
    const lastIndex = unified.repair_hints.length - 1;
    const lastHint = unified.repair_hints[lastIndex]!;
    const excess = measureBriefContentChars(unified) - maxChars;

    if (lastHint.length > excess && lastHint.length > 3) {
      unified.repair_hints[lastIndex] = truncate(lastHint, lastHint.length - excess);
      break;
    }

    unified.repair_hints.pop();
  }

  if (unified.repair_hints.length === 0) {
    delete unified.repair_hints;
  }
}

function truncateResolvedContext(unified: UnifiedBrief, maxChars: number): void {
  if (!unified.resolved_context) {
    return;
  }

  while (measureBriefContentChars(unified) > maxChars && unified.resolved_context.length > 0) {
    const lastIndex = unified.resolved_context.length - 1;
    const lastEntry = unified.resolved_context[lastIndex]!;
    const excess = measureBriefContentChars(unified) - maxChars;

    if (lastEntry.excerpt.length > excess && lastEntry.excerpt.length > 3) {
      lastEntry.excerpt = truncate(lastEntry.excerpt, lastEntry.excerpt.length - excess);
      break;
    }

    unified.resolved_context.pop();
  }

  if (unified.resolved_context.length === 0) {
    delete unified.resolved_context;
  }
}

function truncateClaudeDoctrine(unified: UnifiedBrief, maxChars: number): void {
  if (!unified.claude_doctrine || measureBriefContentChars(unified) <= maxChars) {
    return;
  }

  const excess = measureBriefContentChars(unified) - maxChars;
  const nextLength = Math.max(0, unified.claude_doctrine.length - excess);
  unified.claude_doctrine = truncate(unified.claude_doctrine, nextLength);

  if (unified.claude_doctrine.length === 0) {
    delete unified.claude_doctrine;
  }
}

function truncateBaseBriefFields(unified: UnifiedBrief, maxChars: number): void {
  if (unified.last_validation_errors && measureBriefContentChars(unified) > maxChars) {
    unified.last_validation_errors = [];
  }

  while (measureBriefContentChars(unified) > maxChars && unified.constraints.length > 0) {
    unified.constraints.pop();
  }

  while (measureBriefContentChars(unified) > maxChars && unified.files_in_scope.length > 0) {
    unified.files_in_scope.pop();
  }

  if (measureBriefContentChars(unified) > maxChars) {
    const excess = measureBriefContentChars(unified) - maxChars;
    unified.objective = truncate(unified.objective, Math.max(0, unified.objective.length - excess));
  }
}

function proportionallyTruncateBrief(unified: UnifiedBrief, maxChars: number): void {
  const entries = collectTruncatableTextEntries(unified);

  while (measureBriefContentChars(unified) > maxChars && entries.length > 0) {
    const totalChars = entries.reduce((sum, entry) => sum + entry.get().length, 0);
    if (totalChars === 0) {
      break;
    }

    const excess = measureBriefContentChars(unified) - maxChars;
    const largest = entries.reduce((current, candidate) =>
      candidate.get().length > current.get().length ? candidate : current,
    );
    const value = largest.get();
    const reduction = Math.min(
      value.length,
      Math.max(1, Math.ceil((value.length / totalChars) * excess)),
    );
    const nextValue = truncate(value, Math.max(0, value.length - reduction));
    largest.set(nextValue);

    if (nextValue.length === 0) {
      const index = entries.indexOf(largest);
      if (index >= 0) {
        entries.splice(index, 1);
      }
    }
  }
}

interface TruncatableTextEntry {
  get: () => string;
  set: (value: string) => void;
}

function collectTruncatableTextEntries(unified: UnifiedBrief): TruncatableTextEntry[] {
  const entries: TruncatableTextEntry[] = [
    {
      get: () => unified.objective,
      set: (value) => {
        unified.objective = value;
      },
    },
  ];

  if (unified.claude_doctrine) {
    entries.push({
      get: () => unified.claude_doctrine ?? "",
      set: (value) => {
        if (value.length === 0) {
          delete unified.claude_doctrine;
        } else {
          unified.claude_doctrine = value;
        }
      },
    });
  }

  for (const [index, constraint] of unified.constraints.entries()) {
    entries.push({
      get: () => unified.constraints[index] ?? "",
      set: (value) => {
        if (value.length === 0) {
          unified.constraints.splice(index, 1);
        } else {
          unified.constraints[index] = value;
        }
      },
    });
  }

  for (const [index, file] of unified.files_in_scope.entries()) {
    entries.push({
      get: () => unified.files_in_scope[index] ?? "",
      set: (value) => {
        if (value.length === 0) {
          unified.files_in_scope.splice(index, 1);
        } else {
          unified.files_in_scope[index] = value;
        }
      },
    });
  }

  if (unified.resolved_context) {
    for (const [index, item] of unified.resolved_context.entries()) {
      entries.push({
        get: () => unified.resolved_context?.[index]?.excerpt ?? "",
        set: (value) => {
          const entry = unified.resolved_context?.[index];
          if (!entry) {
            return;
          }
          if (value.length === 0) {
            unified.resolved_context?.splice(index, 1);
            if (unified.resolved_context?.length === 0) {
              delete unified.resolved_context;
            }
          } else {
            entry.excerpt = value;
          }
        },
      });
    }
  }

  if (unified.memory_context) {
    for (const [index, slice] of unified.memory_context.entries()) {
      entries.push({
        get: () => unified.memory_context?.[index] ?? "",
        set: (value) => {
          if (value.length === 0) {
            unified.memory_context?.splice(index, 1);
            if (unified.memory_context?.length === 0) {
              delete unified.memory_context;
            }
          } else {
            unified.memory_context![index] = value;
          }
        },
      });
    }
  }

  if (unified.repair_hints) {
    for (const [index, hint] of unified.repair_hints.entries()) {
      entries.push({
        get: () => unified.repair_hints?.[index] ?? "",
        set: (value) => {
          if (value.length === 0) {
            unified.repair_hints?.splice(index, 1);
            if (unified.repair_hints?.length === 0) {
              delete unified.repair_hints;
            }
          } else {
            unified.repair_hints![index] = value;
          }
        },
      });
    }
  }

  return entries.filter((entry) => entry.get().length > 0);
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars - 3)}...`;
}