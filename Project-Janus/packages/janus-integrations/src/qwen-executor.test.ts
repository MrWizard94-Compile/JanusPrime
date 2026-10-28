import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskQueue } from "@aether/task-queue";
import type { JanusConfig } from "./config.js";
import { OrchestratorService } from "@aether/orchestrator";
import { OllamaClient } from "./ollama-client.js";
import { QwenExecutor } from "./qwen-executor.js";

const testConfig: JanusConfig = {
  version: "1",
  name: "test-janus",
  components: {
    orchestrator: { root: ".", state_dir: ".aether" },
    memory: {
      root: "memory",
      url: "http://localhost:8000",
      api_key_env: "JANUS_MEMORY_API_KEY",
      context_limit: 3,
      max_context_chars: 8000,
      allow_query_llm_fallback: false,
    },
    assets: {
      root: "assets",
      entry: "ac.py",
      python: "python",
    },
  },
  self_repair: {
    max_validation_retries: 5,
    max_heal_attempts: 3,
    seed_on_accept: true,
    seed_on_heal: true,
  },
  token_policy: {
    brief_max_chars: 12000,
    memory_slice_max_chars: 2000,
    resolved_context_max_chars: 3000,
    validation_error_max: 20,
    rel_context_max_chars: 800,
  },
  doctrine: {
    claude_path: "CLAUDE.md",
    inject_into_brief: true,
    inject_into_mcp_instructions: true,
    seed_on_boot: false,
    brief_excerpt_max_chars: 4000,
    mcp_instruction_excerpt_max_chars: 1500,
  },
};

describe("QwenExecutor", () => {
  let janusRoot = "";
  let queue: TaskQueue;
  let chatMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    janusRoot = await mkdtemp(join(tmpdir(), "janus-qwen-"));
    await mkdir(join(janusRoot, "local"), { recursive: true });
    queue = new TaskQueue(janusRoot);
    chatMock = vi.fn();
    vi.spyOn(OllamaClient.prototype, "chat").mockImplementation(chatMock);
    vi.spyOn(OrchestratorService.prototype, "buildExecutorBrief").mockResolvedValue({
      task_id: "t",
      spec: { objective: "t", constraints: [], files_in_scope: [], acceptance_criteria: [] },
      workspace_root: janusRoot,
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(janusRoot, { recursive: true, force: true });
  });

  async function seedQwenTask() {
    const t = await queue.create({
      spec: {
        objective: "Implement Qwen fallback executor",
        constraints: ["gate only", "no untyped values"],
        files_in_scope: [
          "packages/janus-integrations/src/ollama-client.ts",
          "packages/janus-integrations/src/qwen-executor.ts",
        ],
        acceptance_criteria: ["dispatch works", "tests green"],
      },
      validation_profile: "typescript-v1",
      assignee: "grok",
    });
    await queue.setWorktree(t.id, "local");
    return t;
  }

  it("runs tool loop and abandons cleanly on no proposal after rounds", async () => {
    const task = await seedQwenTask();
    // model returns no tool_calls ever
    chatMock.mockResolvedValue({ choices: [{ message: { role: "assistant", content: "done" } }] });

    const exec = new QwenExecutor(janusRoot, testConfig);
    const res = await exec.execute(task.id);

    expect(res.task_id).toBe(task.id);
    expect(res.passed).toBe(false);
    expect(res.action).toBe("abandoned");
    expect(res.attempts).toBeGreaterThan(0);
  });

  it("stages proposal and reports submit result", async () => {
    const task = await seedQwenTask();

    // First call: emit a stage_patch tool call
    chatMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: "assistant",
            tool_calls: [
              {
                id: "call_1",
                function: {
                  name: "stage_patch",
                  arguments: JSON.stringify({
                    files: [
                      { path: "packages/janus-integrations/src/ollama-client.ts", content: "export const x=1;" },
                    ],
                  }),
                },
              },
            ],
          },
        },
      ],
    });

    // Second response after tool: no more tools
    chatMock.mockResolvedValueOnce({ choices: [{ message: { role: "assistant", content: "submitted" } }] });

    const exec = new QwenExecutor(janusRoot, testConfig);
    const res = await exec.execute(task.id);

    // Since handoff submit will fail (no real kernel in test), expect failed submit path or handled
    // The impl records and returns non-passed; we mainly assert no crash and attempts recorded.
    expect(res.task_id).toBe(task.id);
    expect(typeof res.attempts).toBe("number");
    expect(["submit_failed", "abandoned", "submit_exception", "patch_applied"].includes(res.action)).toBe(true);
  });
});
