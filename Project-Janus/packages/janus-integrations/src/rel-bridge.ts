import type { JanusConfig } from "./config.js";
import { resolveCognitionRoot } from "./config.js";
import type { AutonomousLoopResult } from "./autonomous-loop.js";
import type { MemoryClient } from "./memory-client.js";
import { RelClient, type RelContextResult, type RelHealth, type RelStateSummary } from "./rel-client.js";

export interface CognitionStatus {
  configured: boolean;
  root?: string;
  rest_url?: string;
  reachable: boolean;
  health?: RelHealth;
  state_summary?: RelStateSummary;
  detail?: string;
}

export class RelBridge {
  private readonly janusRoot: string;
  private readonly config: JanusConfig;
  private readonly client: RelClient | null;

  constructor(janusRoot: string, config: JanusConfig) {
    this.janusRoot = janusRoot;
    this.config = config;
    this.client = config.components.cognition
      ? new RelClient(config.components.cognition)
      : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async getStatus(): Promise<CognitionStatus> {
    const cognition = this.config.components.cognition;
    if (!this.client || !cognition) {
      return { configured: false, reachable: false };
    }

    const cognitionRoot = resolveCognitionRoot(this.janusRoot, this.config);
    const health = await this.client.health();
    if (!health.reachable) {
      const status: CognitionStatus = {
        configured: true,
        rest_url: cognition.rest_url,
        reachable: false,
      };
      if (cognitionRoot) {
        status.root = cognitionRoot;
      }
      if (health.error) {
        status.detail = health.error;
      }
      return status;
    }

    const stateSummary = await this.client.getStateSummary();
    const status: CognitionStatus = {
      configured: true,
      rest_url: cognition.rest_url,
      reachable: true,
    };
    if (cognitionRoot) {
      status.root = cognitionRoot;
    }
    if (health.data) {
      status.health = health.data;
    }
    if (stateSummary.reachable && stateSummary.data) {
      status.state_summary = stateSummary.data;
    }
    if (stateSummary.error) {
      status.detail = stateSummary.error;
    }
    return status;
  }

  async loadContext(query: string, maxTokens = 4000): Promise<RelContextResult | null> {
    if (!this.client) {
      return null;
    }
    const result = await this.client.loadContext(query, maxTokens);
    return result.reachable && result.data ? result.data : null;
  }

  async getStateExcerpt(maxChars: number): Promise<string | undefined> {
    if (!this.client) {
      return undefined;
    }
    const state = await this.client.getStateSummary();
    if (!state.reachable || !state.data?.summary) {
      return undefined;
    }
    return truncateText(state.data.summary, maxChars);
  }

  async syncConceptsToMemory(
    memory: MemoryClient,
    query = "JanusPrime active projects and recent decisions",
  ): Promise<{ seeded: boolean; message?: string }> {
    const cognition = this.config.components.cognition;
    if (!this.client || !cognition?.sync_concepts_to_memory) {
      return { seeded: false, message: "sync_concepts_to_memory disabled or cognition not configured" };
    }

    const maxChars = cognition.concept_sync_max_chars;
    const state = await this.client.getStateSummary();
    const context = await this.client.loadContext(query, Math.min(1200, maxChars));
    const analytics = await this.client.invokeTool("get_analytics");

    if (!state.reachable && !context.reachable && !analytics.reachable) {
      return { seeded: false, message: state.error ?? "REL unreachable" };
    }

    const content = formatConceptSyncPayload({
      stateSummary: state.data?.summary,
      contextText: context.data?.context,
      analytics: analytics.data,
      query,
      maxChars,
    });

    if (!content.trim()) {
      return { seeded: false, message: "no concept content to seed" };
    }

    const result = await memory.seed(content, "Project Context", "All");
    return { seeded: true, message: result.message };
  }

  async logAutonomousLoopOutcome(result: AutonomousLoopResult): Promise<void> {
    if (!this.client || !this.config.components.cognition?.log_loop_outcomes) {
      return;
    }

    const summary = formatLoopSummary(result);
    const achievements = collectLoopAchievements(result);

    await this.client.logSession({ summary, achievements });

    if (result.complete) {
      await this.client.invokeTool("neural_learn", {
        text: summary,
      });
    }
  }
}

export function formatConceptSyncPayload(input: {
  stateSummary?: string;
  contextText?: string;
  analytics: unknown;
  query: string;
  maxChars: number;
}): string {
  const parts: string[] = [
    "Source: REL steward/neural-web bridge → Smart-Library",
    `Query: ${input.query}`,
  ];

  if (input.stateSummary) {
    parts.push(`State: ${input.stateSummary}`);
  }

  if (input.contextText) {
    parts.push(`Context:\n${input.contextText}`);
  }

  const analyticsLines = extractAnalyticsHighlights(input.analytics);
  if (analyticsLines.length > 0) {
    parts.push(`Neural highlights:\n${analyticsLines.join("\n")}`);
  }

  return truncateText(parts.join("\n\n"), input.maxChars);
}

export function extractAnalyticsHighlights(analytics: unknown): string[] {
  if (!analytics || typeof analytics !== "object") {
    return [];
  }

  const record = analytics as Record<string, unknown>;
  const payload =
    record["result"] && typeof record["result"] === "object"
      ? (record["result"] as Record<string, unknown>)
      : record;

  const lines: string[] = [];

  const neuralWeb = payload["neural_web"];
  if (neuralWeb && typeof neuralWeb === "object") {
    const stats = neuralWeb as Record<string, unknown>;
    lines.push(
      `neurons:${stats["total_neurons"] ?? "?"} synapses:${stats["total_synapses"] ?? "?"} activations:${stats["total_activations"] ?? "?"}`,
    );
  }

  if (typeof payload["total_projects"] === "number") {
    lines.push(`active_projects:${payload["total_projects"]}`);
  }

  if (typeof payload["total_sessions"] === "number") {
    lines.push(`sessions:${payload["total_sessions"]}`);
  }

  return lines;
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars - 3)}...`;
}

export function formatLoopSummary(result: AutonomousLoopResult): string {
  const accepted = result.rollup.by_status.accepted ?? 0;
  const total = result.rollup.total ?? 0;
  const failedKinds = result.round_results
    .filter((round) => !round.passed)
    .map((round) => `${round.task_id}:${round.kind}`)
    .slice(0, 10);

  const lines = [
    `Autonomous loop ${result.complete ? "complete" : "incomplete"} for parent ${result.parent_id}`,
    `Rounds: ${result.rounds_executed}`,
    `Rollup: ${accepted}/${total} accepted`,
    `Seeded tasks: ${result.seeded_tasks.length}`,
  ];

  if (failedKinds.length > 0) {
    lines.push(`Recent failures: ${failedKinds.join(", ")}`);
  }

  return lines.join("\n");
}

export function collectLoopAchievements(result: AutonomousLoopResult): string[] {
  const achievements: string[] = [];

  if (result.complete) {
    achievements.push(`parent:${result.parent_id}:complete`);
  }

  for (const taskId of result.seeded_tasks) {
    achievements.push(`seeded:${taskId}`);
  }

  for (const round of result.round_results.filter((entry) => entry.passed)) {
    achievements.push(`passed:${round.task_id}:${round.kind}`);
  }

  return achievements;
}