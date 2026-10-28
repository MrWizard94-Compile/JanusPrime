import { z } from "zod";

export interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

const OllamaConfigSchema = z.object({
  base_url: z.string().url().default("http://localhost:11434/v1"),
  model: z.string().default("qwen2.5-coder:7b"),
});

export type OllamaConfig = z.infer<typeof OllamaConfigSchema>;

export interface OllamaChatResponse {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: ToolCall[];
    };
  }>;
}

export class OllamaClient {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(config: Partial<OllamaConfig> = {}) {
    const parsed = OllamaConfigSchema.parse(config);
    this.baseUrl = parsed.base_url.replace(/\/$/, "");
    this.model = parsed.model;
  }

  async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options: { temperature?: number; maxTokens?: number } = {},
  ): Promise<OllamaChatResponse> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: options.temperature ?? 0.1,
      max_tokens: options.maxTokens ?? 4000,
    };
    if (tools && tools.length > 0) {
      body["tools"] = tools;
      body["tool_choice"] = "auto";
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama API error ${res.status}: ${text}`);
    }

    const data: unknown = await res.json();
    const response = data as OllamaChatResponse;
    normalizeContentToolCalls(response);
    return response;
  }
}

/**
 * Ollama's /v1 chat for some models (e.g. qwen2.5-coder:7b) emits tool calls as
 * JSON in `message.content` while leaving the structured `tool_calls` field
 * null. Callers that only read `tool_calls` would see prose and miss the call.
 * Normalize those content-embedded calls into `tool_calls` so downstream loops
 * work unchanged.
 */
function normalizeContentToolCalls(response: OllamaChatResponse): void {
  for (const choice of response.choices ?? []) {
    const msg = choice.message;
    if (!msg) {
      continue;
    }
    if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      continue;
    }
    if (typeof msg.content !== "string" || msg.content.trim().length === 0) {
      continue;
    }
    const extracted = parseToolCallsFromContent(msg.content);
    if (extracted.length > 0) {
      msg.tool_calls = extracted;
      // The content WAS the tool call, not assistant prose — clear it so the
      // loop treats this purely as a tool-call turn.
      msg.content = null;
    }
  }
}

function parseToolCallsFromContent(content: string): ToolCall[] {
  const stripped = stripCodeFence(content).trim();
  if (!(stripped.startsWith("{") || stripped.startsWith("["))) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return [];
  }
  const candidates = Array.isArray(parsed) ? parsed : [parsed];
  const calls: ToolCall[] = [];
  candidates.forEach((candidate, index) => {
    const call = extractToolCall(candidate, index);
    if (call) {
      calls.push(call);
    }
  });
  return calls;
}

function extractToolCall(candidate: unknown, index: number): ToolCall | null {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }
  let rec = candidate as Record<string, unknown>;
  if (rec["function"] && typeof rec["function"] === "object") {
    rec = rec["function"] as Record<string, unknown>;
  }
  const name = rec["name"];
  if (typeof name !== "string" || name.length === 0) {
    return null;
  }
  const args = rec["arguments"] ?? rec["parameters"] ?? {};
  const argString = typeof args === "string" ? args : JSON.stringify(args);
  return { id: `call_${index}_${name}`, function: { name, arguments: argString } };
}

function stripCodeFence(value: string): string {
  const match = value.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match?.[1] ?? value;
}
