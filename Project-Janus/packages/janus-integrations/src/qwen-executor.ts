import * as fs from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Task, PatchProposal } from "@aether/shared";
import { PatchProposalSchema } from "@aether/shared";
import { TaskQueue } from "@aether/task-queue";
import { HandoffService, type SubmitPatchResult } from "@aether/validation-kernel";
import { OrchestratorService } from "@aether/orchestrator";
import type { JanusConfig } from "./config.js";
import { OllamaClient, type ChatMessage, type OllamaConfig, type ToolCall, type ToolDefinition, type OllamaChatResponse } from "./ollama-client.js";

export interface QwenExecutorResult {
  task_id: string;
  passed: boolean;
  status: Task["status"];
  action: string;
  detail?: string;
  attempts?: number;
}

const DEFAULT_QWEN = {
  base_url: "http://localhost:11434/v1",
  model: "qwen2.5-coder:7b",
  max_repair_rounds: 3,
};

interface QwenProviderConfig {
  base_url?: string;
  model?: string;
  max_repair_rounds?: number;
}

export class QwenExecutor {
  private readonly janusRoot: string;
  private readonly queue: TaskQueue;
  private readonly handoff: HandoffService;
  private readonly orchestrator: OrchestratorService;
  private readonly ollama: OllamaClient;
  private readonly maxRounds: number;

  constructor(janusRoot: string, config: JanusConfig) {
    this.janusRoot = janusRoot;
    this.queue = new TaskQueue(janusRoot);
    this.handoff = new HandoffService(janusRoot);
    this.orchestrator = new OrchestratorService(janusRoot);

    // Config may be stripped by zod; re-read raw for executor section (untrusted input path)
    let provider: QwenProviderConfig = DEFAULT_QWEN;
    try {
      let cfgPath = join(janusRoot, "janus.config.json");
      if (!fs.existsSync(cfgPath)) {
        cfgPath = join(janusRoot, "..", "janus.config.json");
      }
      if (fs.existsSync(cfgPath)) {
        const raw = fs.readFileSync(cfgPath, "utf8");
        const full = JSON.parse(raw) as Record<string, unknown>;
        const execSection = (full["executor"] ?? full) as Record<string, unknown>;
        const q = ((execSection["providers"] as Record<string, unknown> | undefined)?.["qwen"]) as QwenProviderConfig | undefined;
        if (q) {
          provider = {
            base_url: q.base_url ?? DEFAULT_QWEN.base_url,
            model: q.model ?? DEFAULT_QWEN.model,
            max_repair_rounds: q.max_repair_rounds ?? DEFAULT_QWEN.max_repair_rounds,
          };
        }
      }
    } catch {
      provider = DEFAULT_QWEN;
    }

    const clientCfg: Partial<OllamaConfig> = {};
    if (provider.base_url) clientCfg.base_url = provider.base_url;
    if (provider.model) clientCfg.model = provider.model;
    this.ollama = new OllamaClient(clientCfg);
    this.maxRounds = provider.max_repair_rounds ?? DEFAULT_QWEN.max_repair_rounds;
  }

  async execute(taskId: string): Promise<QwenExecutorResult> {
    let task = await this.queue.get(taskId);
    if (task.status === "pending") {
      task = await this.queue.transition(taskId, "in_progress");
    } else if (task.status === "failed") {
      task = await this.queue.transition(taskId, "in_progress");
    }

    const brief = await this.orchestrator.buildExecutorBrief(taskId);
    const context = JSON.stringify(brief, null, 2);

    const tools: ToolDefinition[] = [
      {
        type: "function",
        function: {
          name: "read_file",
          description: "Read a source file by path relative to the workspace root (e.g. packages/janus-integrations/src/foo.ts). Returns full content or error.",
          parameters: {
            type: "object",
            properties: {
              path: { type: "string", description: "Relative path from workspace root" },
            },
            required: ["path"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "stage_patch",
          description: "Stage a complete patch proposal. Provide all target files with full intended content. Must cover files_in_scope. After staging submit will be called by the loop.",
          parameters: {
            type: "object",
            properties: {
              files: {
                type: "array",
                description: "Array of {path, content} for the proposal",
                items: {
                  type: "object",
                  properties: {
                    path: { type: "string" },
                    content: { type: "string" },
                  },
                  required: ["path", "content"],
                },
              },
            },
            required: ["files"],
          },
        },
      },
    ];

    const systemPrompt = [
      "You are a precise autonomous coding agent for JanusPrime orchestrator.",
      "Objective: " + task.spec.objective,
      "Constraints: " + JSON.stringify(task.spec.constraints),
      "Files in scope (patch only these): " + task.spec.files_in_scope.join(", "),
      "",
      "Process:",
      "1. Use read_file tool to inspect current state of needed files.",
      "2. Produce correct, complete replacement content.",
      "3. Call stage_patch with the full files[] array (complete content, no placeholders).",
      "4. The driver will submit the staged proposal through HandoffService + typescript-v1 gate.",
      "5. If validation fails you will receive the errors in the next tool response; repair and resubmit up to max rounds.",
      "",
      "Rules:",
      "- Output ONLY tool calls until ready for final, or a summary after submit.",
      "- Never bypass gate. All mutations via stage_patch + submit.",
      "- Complete files only. No deferred markers or stubs.",
      "- Use strict TypeScript, no untyped values, no suppressions.",
    ].join("\n");

    let messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Brief and context:\n" + context + "\n\nStart: read the files you need then stage a passing patch." },
    ];

    let rounds = 0;
    let lastProposal: PatchProposal | null = null;
    let lastValidationErrors: string[] = [];

    while (rounds < this.maxRounds) {
      rounds += 1;
      let resp: OllamaChatResponse;
      try {
        resp = await this.ollama.chat(messages, tools, { temperature: 0.05 });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        await this.queue.setResult(taskId, JSON.stringify({ error: "ollama_chat_failed", detail: msg, rounds }));
        return { task_id: taskId, passed: false, status: "failed", action: "ollama_error", detail: msg, attempts: rounds };
      }

      const choice = resp.choices && resp.choices[0] ? resp.choices[0].message : undefined;
      if (!choice) {
        break;
      }

      const nextMsg: ChatMessage = {
        role: ((choice.role ?? "assistant") as ChatMessage["role"]),
        content: choice.content ?? null,
      };
      if (choice.tool_calls && choice.tool_calls.length > 0) {
        nextMsg.tool_calls = choice.tool_calls;
      }
      messages.push(nextMsg);

      if (choice.tool_calls && choice.tool_calls.length > 0) {
        for (const tc of choice.tool_calls) {
          const name = tc.function.name;
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>;
          } catch {
            args = {};
          }

          let toolResult: Record<string, unknown> = {};

          if (name === "read_file") {
            const p = String(args["path"] || "");
            try {
              const full = join(this.janusRoot, p);
              const content = await readFile(full, "utf8");
              toolResult = { content, path: p };
            } catch (e: unknown) {
              toolResult = { error: "read_failed", path: p, detail: e instanceof Error ? e.message : String(e) };
            }
          } else if (name === "stage_patch") {
            const rawFiles = Array.isArray(args["files"]) ? (args["files"] as Array<Record<string, unknown>>) : [];
            const files = rawFiles
              .map((f) => ({
                path: String((f as Record<string, unknown>)["path"] || ""),
                content: String((f as Record<string, unknown>)["content"] || ""),
              }))
              .filter((f) => f.path.length > 0);

            const candidate: PatchProposal = {
              task_id: taskId,
              files,
              allow_overwrite: true,
            };

            try {
              lastProposal = PatchProposalSchema.parse(candidate);
              toolResult = { staged: true, num_files: lastProposal.files.length, paths: lastProposal.files.map((f) => f.path) };
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              toolResult = { staged: false, error: "invalid_proposal", detail: msg };
              lastProposal = null;
            }
          } else {
            toolResult = { error: "unknown_tool", name };
          }

          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            name,
            content: JSON.stringify(toolResult),
          });
        }

        // After processing tools, if we have a valid proposal, attempt submit
        if (lastProposal) {
          try {
            const submitRes: SubmitPatchResult = await this.handoff.submit({
              repoRoot: this.janusRoot,
              proposal: lastProposal,
              apply: false,
            });

            if (submitRes.validation.passed) {
              // Apply on second submit (or use flag, but follow two step for clarity)
              await this.handoff.submit({
                repoRoot: this.janusRoot,
                proposal: lastProposal,
                apply: true,
              });
              const finalTask = await this.queue.get(taskId);
              return {
                task_id: taskId,
                passed: true,
                status: finalTask.status,
                action: "patch_applied",
                attempts: rounds,
              };
            } else {
              lastValidationErrors = submitRes.validation.errors.map((e) => `${e.layer}:${e.rule} ${e.message}`);
              messages.push({
                role: "user",
                content: "Validation FAILED. Errors:\n" + lastValidationErrors.join("\n") + "\n\nRepair the patch and call stage_patch again with corrected full files.",
              });
              lastProposal = null;
              // continue loop for repair
            }
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            await this.queue.setResult(taskId, JSON.stringify({ error: "submit_exception", detail: msg }));
            return { task_id: taskId, passed: false, status: "failed", action: "submit_exception", detail: msg, attempts: rounds };
          }
        }
      } else {
        // model gave text only, no more tool calls
        if (lastProposal) {
          // already handled above
        }
        break;
      }
    }

    // exhausted rounds or no proposal
    const resultDetail = lastValidationErrors.length > 0
      ? "max_rounds_validation_failed: " + lastValidationErrors.slice(0, 3).join("; ")
      : "abandoned_no_valid_patch";

    await this.queue.setResult(taskId, JSON.stringify({ abandoned: true, rounds, last_errors: lastValidationErrors }));
    let finalStatus: Task["status"] = "failed";
    try {
      const updated = await this.queue.transition(taskId, "failed");
      finalStatus = updated.status;
    } catch {
      const cur = await this.queue.get(taskId);
      finalStatus = cur.status;
    }
    return {
      task_id: taskId,
      passed: false,
      status: finalStatus,
      action: "abandoned",
      detail: resultDetail,
      attempts: rounds,
    };
  }
}
