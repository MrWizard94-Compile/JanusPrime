import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskQueue } from "@aether/task-queue";
import type { JanusConfig } from "./config.js";
import { MemoryClient } from "./memory-client.js";
import { PythonSandboxExecutor } from "./python-sandbox-executor.js";

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
    soul_path: "SOUL.md",
    inject_into_brief: true,
    inject_into_mcp_instructions: true,
    seed_on_boot: false,
    brief_excerpt_max_chars: 4000,
    mcp_instruction_excerpt_max_chars: 1500,
  },
};

describe("PythonSandboxExecutor", () => {
  let janusRoot = "";
  let queue: TaskQueue;
  let healMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    janusRoot = await mkdtemp(join(tmpdir(), "janus-python-sandbox-"));
    queue = new TaskQueue(janusRoot);
    healMock = vi.fn();
    vi.spyOn(MemoryClient.prototype, "heal").mockImplementation(healMock);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(janusRoot, { recursive: true, force: true });
  });

  async function seedPythonTask(files: Record<string, string>) {
    const task = await queue.create({
      spec: {
        objective: "Validate python via sandbox heal",
        constraints: [],
        files_in_scope: Object.keys(files),
        acceptance_criteria: ["Sandbox execution passes"],
      },
      validation_profile: "python-sandbox-v1",
    });

    for (const [relativePath, content] of Object.entries(files)) {
      const absolutePath = join(janusRoot, relativePath);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, content, "utf8");
    }

    return task;
  }

  it("accepts task when heal returns Success", async () => {
    const task = await seedPythonTask({
      "scripts/hello.py": "print('hello')\n",
    });

    healMock.mockResolvedValue({
      status: "Success",
      code: "print('hello')\n",
      attempts: 1,
      stdout: "hello\n",
    });

    const executor = new PythonSandboxExecutor(janusRoot, testConfig);
    const result = await executor.execute(task.id);

    expect(result.passed).toBe(true);
    expect(result.status).toBe("accepted");
    expect(result.heal_status).toBe("Success");
    expect(result.source_files).toEqual(["scripts/hello.py"]);
    expect(healMock).toHaveBeenCalledWith(
      expect.stringContaining("print('hello')"),
    );

    const updated = await queue.get(task.id);
    expect(updated.validation_attempts).toHaveLength(1);
    expect(updated.validation_attempts[0]?.passed).toBe(true);
  });

  it("accepts task when heal returns Healed", async () => {
    const task = await seedPythonTask({
      "fixme.py": "print(greeting)\n",
    });

    healMock.mockResolvedValue({
      status: "Healed",
      code: "greeting = 'hi'\nprint(greeting)\n",
      attempts: 2,
    });

    const executor = new PythonSandboxExecutor(janusRoot, testConfig);
    const result = await executor.execute(task.id);

    expect(result.passed).toBe(true);
    expect(result.status).toBe("accepted");
    expect(result.heal_status).toBe("Healed");
    expect(result.attempts).toBe(2);
  });

  it("fails task when heal returns Failed", async () => {
    const task = await seedPythonTask({
      "broken.py": "print(greeting)\n",
    });

    healMock.mockResolvedValue({
      status: "Failed",
      code: "print(greeting)\n",
      error: "NameError: name 'greeting' is not defined",
    });

    const executor = new PythonSandboxExecutor(janusRoot, testConfig);
    const result = await executor.execute(task.id);

    expect(result.passed).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.heal_status).toBe("Failed");
    expect(result.errors[0]?.rule).toBe("PY001");
    expect(result.errors[0]?.message).toContain("NameError");
  });

  it("records validation failure when MemoryClient.heal throws", async () => {
    const task = await seedPythonTask({
      "offline.py": "print(1)\n",
    });

    healMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const executor = new PythonSandboxExecutor(janusRoot, testConfig);
    const result = await executor.execute(task.id);

    expect(result.passed).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.heal_status).toBe("Failed");
    expect(result.errors[0]?.rule).toBe("PY002");
    expect(result.errors[0]?.message).toContain("ECONNREFUSED");
  });

  it("concatenates multiple files_in_scope for heal", async () => {
    const task = await seedPythonTask({
      "a.py": "x = 1\n",
      "b.py": "y = 2\n",
    });

    healMock.mockResolvedValue({
      status: "Success",
      code: "x = 1\ny = 2\n",
      attempts: 1,
    });

    const executor = new PythonSandboxExecutor(janusRoot, testConfig);
    const result = await executor.execute(task.id);

    expect(result.source_files).toEqual(["a.py", "b.py"]);
    expect(healMock).toHaveBeenCalledWith(
      expect.stringMatching(/# --- a\.py ---[\s\S]*# --- b\.py ---/),
    );
  });

  it("throws when files_in_scope is empty", async () => {
    const task = await queue.create({
      spec: {
        objective: "Missing scope",
        constraints: [],
        files_in_scope: [],
        acceptance_criteria: [],
      },
      validation_profile: "python-sandbox-v1",
    });

    const executor = new PythonSandboxExecutor(janusRoot, testConfig);

    await expect(executor.execute(task.id)).rejects.toThrow(/files_in_scope/);
  });
});