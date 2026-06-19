import type { JanusConfig } from "./config.js";

export type CognitionConfig = NonNullable<JanusConfig["components"]["cognition"]>;

export interface RelResult<T> {
  reachable: boolean;
  data?: T;
  error?: string;
}

export interface RelHealth {
  status: string;
  detail?: string;
}

export interface RelStateSummary {
  summary: string;
  [key: string]: unknown;
}

export interface RelSessionInput {
  summary: string;
  achievements?: string[];
}

export interface RelContextResult {
  context: string;
  tokens_used?: number;
  [key: string]: unknown;
}

export class RelClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly bearerToken: string | undefined;

  constructor(config: CognitionConfig) {
    this.baseUrl = config.rest_url.replace(/\/$/, "");
    this.apiKey = process.env[config.api_key_env];
    this.bearerToken = process.env[config.bearer_token_env];
  }

  async health(): Promise<RelResult<RelHealth>> {
    return this.wrap(async () => {
      const response = await fetch(`${this.baseUrl}/health`);
      if (!response.ok) {
        return { status: "degraded", detail: `HTTP ${response.status}` };
      }
      return (await response.json()) as RelHealth;
    });
  }

  async invokeTool(name: string, args: Record<string, unknown> = {}): Promise<RelResult<unknown>> {
    return this.wrap(async () => {
      const response = await fetch(`${this.baseUrl}/api/v1/tools/${encodeURIComponent(name)}`, {
        method: "POST",
        headers: this.authHeaders(),
        body: JSON.stringify(args),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`REL tool ${name} failed (${response.status}): ${detail}`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        return (await response.json()) as unknown;
      }
      return { result: await response.text() };
    });
  }

  async getStateSummary(): Promise<RelResult<RelStateSummary>> {
    const result = await this.invokeTool("get_state_summary");
    if (!result.reachable) {
      return result as RelResult<RelStateSummary>;
    }
    return {
      reachable: true,
      data: normalizeStateSummary(result.data),
    };
  }

  async logSession(input: RelSessionInput): Promise<RelResult<{ logged: boolean }>> {
    const result = await this.invokeTool("log_session", {
      summary: input.summary,
      achievements: input.achievements ?? [],
    });
    if (!result.reachable) {
      return result as RelResult<{ logged: boolean }>;
    }
    return {
      reachable: true,
      data: { logged: true },
    };
  }

  async loadContext(query: string, maxTokens = 4000): Promise<RelResult<RelContextResult>> {
    const result = await this.invokeTool("load_context", {
      query,
      max_tokens: maxTokens,
    });
    if (!result.reachable) {
      return result as RelResult<RelContextResult>;
    }
    return {
      reachable: true,
      data: normalizeContextResult(result.data, query),
    };
  }

  private authHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }
    if (this.bearerToken) {
      headers["Authorization"] = `Bearer ${this.bearerToken}`;
    }
    return headers;
  }

  private async wrap<T>(operation: () => Promise<T>): Promise<RelResult<T>> {
    try {
      const data = await operation();
      return { reachable: true, data };
    } catch (error) {
      return {
        reachable: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

function normalizeStateSummary(data: unknown): RelStateSummary {
  if (typeof data === "string") {
    return { summary: data };
  }
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const summary =
      typeof record["summary"] === "string"
        ? record["summary"]
        : typeof record["result"] === "string"
          ? record["result"]
          : JSON.stringify(record);
    return { summary, ...record };
  }
  return { summary: String(data ?? "") };
}

function normalizeContextResult(data: unknown, query: string): RelContextResult {
  if (typeof data === "string") {
    return { context: data, query };
  }
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const context =
      typeof record["context"] === "string"
        ? record["context"]
        : typeof record["result"] === "string"
          ? record["result"]
          : JSON.stringify(record);
    const normalized: RelContextResult = { context, query };
    if (typeof record["tokens_used"] === "number") {
      normalized.tokens_used = record["tokens_used"];
    }
    return normalized;
  }
  return { context: String(data ?? ""), query };
}