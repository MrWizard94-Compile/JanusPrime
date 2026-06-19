import type { JanusConfig } from "./config.js";
import { resolveCognitionRoot } from "./config.js";
import type { AutonomousLoopResult } from "./autonomous-loop.js";
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

  async logAutonomousLoopOutcome(result: AutonomousLoopResult): Promise<void> {
    if (!this.client || !this.config.components.cognition?.log_loop_outcomes) {
      return;
    }

    const summary = formatLoopSummary(result);
    const achievements = collectLoopAchievements(result);

    await this.client.logSession({ summary, achievements });

    if (result.complete) {
      await this.client.invokeTool("neural_learn", {
        summary,
        achievements,
        parent_id: result.parent_id,
        rounds_executed: result.rounds_executed,
      });
    }
  }
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