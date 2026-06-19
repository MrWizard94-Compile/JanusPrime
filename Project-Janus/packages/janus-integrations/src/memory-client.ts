import type { JanusConfig } from "./config.js";

export interface MemoryHealth {
  status: "ok" | "degraded";
  detail?: string;
  llm?: string;
  embeddings?: string;
}

export interface MemoryQueryResult {
  response: string;
  referenced_context: string;
}

export interface HealReport {
  status: "Healed" | "Failed" | "Success";
  code?: string;
  attempts?: number;
  stdout?: string;
  error?: string;
}

export interface SeedResult {
  message: string;
}

export interface DoctrineStatusResult {
  fresh: boolean;
  content_hash: string;
  stored_count: number;
}

export interface RepairErrorEntry {
  message: string;
  file?: string;
  rule?: string;
}

export interface SeedRepairInput {
  objective: string;
  errors: RepairErrorEntry[];
  resolution: string;
  profile: string;
}

export class MemoryClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly contextLimit: number;
  private readonly maxContextChars: number;
  private readonly allowQueryLlmFallback: boolean;

  constructor(config: JanusConfig["components"]["memory"]) {
    this.baseUrl = config.url.replace(/\/$/, "");
    this.apiKey = process.env[config.api_key_env];
    this.contextLimit = config.context_limit;
    this.maxContextChars = config.max_context_chars;
    this.allowQueryLlmFallback = config.allow_query_llm_fallback;
  }

  async health(): Promise<MemoryHealth> {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      return { status: "degraded", detail: `HTTP ${response.status}` };
    }
    return (await response.json()) as MemoryHealth;
  }

  async query(query: string): Promise<MemoryQueryResult> {
    const response = await fetch(`${this.baseUrl}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Memory query failed (${response.status}): ${detail}`);
    }

    return (await response.json()) as MemoryQueryResult;
  }

  async queryContextSlices(query: string): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/query/context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          limit: this.contextLimit,
          max_chars: this.maxContextChars,
        }),
      });

      if (response.ok) {
        const body = (await response.json()) as { slices: string[] };
        return body.slices.slice(0, this.contextLimit);
      }
    } catch {
      // /query/context unavailable — optionally fall back to legacy /query path
    }

    if (!this.allowQueryLlmFallback) {
      return [];
    }

    const result = await this.query(query);
    if (!result.referenced_context.trim()) {
      return [];
    }

    const slices = result.referenced_context
      .split(/\n\n+/)
      .map((slice) => slice.trim())
      .filter((slice) => slice.length > 0)
      .slice(0, this.contextLimit);

    return slices.map((slice) => truncate(slice, this.maxContextChars));
  }

  async seedRepairPattern(input: SeedRepairInput): Promise<SeedResult> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }

    const response = await fetch(`${this.baseUrl}/seed-repair`, {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Memory seed-repair failed (${response.status}): ${detail}`);
    }

    return (await response.json()) as SeedResult;
  }

  async getDoctrineStatus(contentHash: string): Promise<DoctrineStatusResult> {
    const response = await fetch(
      `${this.baseUrl}/doctrine/status?content_hash=${encodeURIComponent(contentHash)}`,
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Doctrine status failed (${response.status}): ${detail}`);
    }

    return (await response.json()) as DoctrineStatusResult;
  }

  async seed(content: string, category: string, language = "All"): Promise<SeedResult> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }

    const response = await fetch(`${this.baseUrl}/seed`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content, category, language }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Memory seed failed (${response.status}): ${detail}`);
    }

    return (await response.json()) as SeedResult;
  }

  async heal(code: string): Promise<HealReport> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }

    const response = await fetch(`${this.baseUrl}/execute-heal`, {
      method: "POST",
      headers,
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Memory heal failed (${response.status}): ${detail}`);
    }

    const body = (await response.json()) as { report: HealReport };
    return body.report;
  }
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars - 3)}...`;
}