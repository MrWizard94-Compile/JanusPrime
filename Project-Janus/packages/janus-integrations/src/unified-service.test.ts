import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrchestratorService } from "@aether/orchestrator";
import { TaskQueue } from "@aether/task-queue";
import type { JanusConfig } from "./config.js";
import { MemoryClient } from "./memory-client.js";
import {
  JanusUnifiedService,
  buildResolvedContext,
  selectCatalogContextRefs,
} from "./unified-service.js";

const projectJanusRoot = join(import.meta.dirname, "../../..");

describe("selectCatalogContextRefs", () => {
  it("keeps only refs present in CONTEXT_CATALOG", () => {
    expect(
      selectCatalogContextRefs(
        ["doc:handoff-protocol", "unknown:ref", "ref:neoforged"],
        { skipSoulDuplicate: false },
      ),
    ).toEqual(["doc:handoff-protocol", "ref:neoforged"]);
  });

  it("skips doc:soul when soul doctrine is already included", () => {
    expect(
      selectCatalogContextRefs(
        ["doc:soul", "doc:handoff-protocol"],
        { skipSoulDuplicate: true },
      ),
    ).toEqual(["doc:handoff-protocol"]);
  });

  it("keeps doc:soul when soul doctrine is not included", () => {
    expect(
      selectCatalogContextRefs(["doc:soul", "doc:handoff-protocol"], {
        skipSoulDuplicate: false,
      }),
    ).toEqual(["doc:soul", "doc:handoff-protocol"]);
  });

  it("skips doc:rel-state because it is resolved dynamically", () => {
    expect(
      selectCatalogContextRefs(["doc:rel-state", "doc:handoff-protocol"], {
        skipSoulDuplicate: false,
      }),
    ).toEqual(["doc:handoff-protocol"]);
  });
});

describe("buildResolvedContext", () => {
  it("resolves catalog refs into excerpts", async () => {
    const resolved = await buildResolvedContext(
      projectJanusRoot,
      ["doc:handoff-protocol"],
      3000,
    );

    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.ref).toBe("doc:handoff-protocol");
    expect(resolved[0]?.excerpt).toContain("Phase 0 Handoff Protocol");
  });

  it("caps total resolved chars across refs", async () => {
    const resolved = await buildResolvedContext(
      projectJanusRoot,
      ["arch:framedblocks-mixin-pattern", "doc:handoff-protocol"],
      120,
    );

    const totalChars = resolved.reduce((sum, item) => sum + item.excerpt.length, 0);
    expect(totalChars).toBeLessThanOrEqual(120);
    expect(resolved.length).toBeGreaterThan(0);
  });
});

describe("JanusUnifiedService context resolution", () => {
  let janusRoot = "";
  let orchestratorRoot = "";

  const baseConfig: JanusConfig = {
    version: "1.0.0",
    name: "janus-test",
    components: {
      orchestrator: {
        root: "orch",
        state_dir: ".aether",
      },
      memory: {
        root: "memory",
        url: "http://localhost:8000",
        api_key_env: "JANUS_MEMORY_API_KEY",
        context_limit: 3,
        max_context_chars: 8000,
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
    },
    doctrine: {
      soul_path: "SOUL.md",
      inject_into_brief: true,
      inject_into_mcp_instructions: true,
      seed_on_boot: false,
      brief_excerpt_max_chars: 4000,
    },
  };

  beforeEach(async () => {
    janusRoot = await mkdtemp(join(tmpdir(), "janus-unified-"));
    orchestratorRoot = join(janusRoot, "orch");

    const handoffSource = await readFile(
      join(projectJanusRoot, "docs/phase0/handoff-protocol.md"),
      "utf8",
    );

    await mkdir(join(orchestratorRoot, "docs/phase0"), { recursive: true });
    await writeFile(join(orchestratorRoot, "docs/phase0/handoff-protocol.md"), handoffSource, "utf8");
    await writeFile(join(janusRoot, "SOUL.md"), "# Test Soul\nValidation before mutation\n", "utf8");
    await writeFile(join(janusRoot, "janus.config.json"), JSON.stringify(baseConfig, null, 2), "utf8");
    vi.spyOn(MemoryClient.prototype, "queryContextSlices").mockResolvedValue([]);
    vi.spyOn(OrchestratorService.prototype, "buildExecutorBrief").mockImplementation(
      async (taskId: string) => ({
        task_id: taskId,
        assignee: "grok",
        workspace_root: orchestratorRoot,
        files_in_scope: ["README.md"],
        objective: "Test objective",
        constraints: [],
        validation_profile: "typescript-v1",
        context_refs: [],
      }),
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(janusRoot, { recursive: true, force: true });
  });

  it("buildUnifiedBrief resolves public catalog context_refs", async () => {
    const service = new JanusUnifiedService(janusRoot, baseConfig);
    vi.mocked(OrchestratorService.prototype.buildExecutorBrief).mockResolvedValueOnce({
      task_id: "task-test-1",
      assignee: "grok",
      workspace_root: orchestratorRoot,
      files_in_scope: ["README.md"],
      objective: "Apply handoff protocol",
      constraints: [],
      validation_profile: "typescript-v1",
      context_refs: ["doc:handoff-protocol", "aether:patch_mode:identity", "unknown:ref"],
    });

    const brief = await service.buildUnifiedBrief("task-test-1");

    expect(brief.resolved_context).toHaveLength(1);
    expect(brief.resolved_context?.[0]?.ref).toBe("doc:handoff-protocol");
    expect(brief.resolved_context?.[0]?.excerpt).toContain("Phase 0 Handoff Protocol");
    expect(brief.soul_doctrine).toContain("Validation before mutation");
  });

  it("buildUnifiedBrief skips doc:soul when soul doctrine is injected", async () => {
    const service = new JanusUnifiedService(janusRoot, baseConfig);
    vi.mocked(OrchestratorService.prototype.buildExecutorBrief).mockResolvedValueOnce({
      task_id: "task-test-2",
      assignee: "grok",
      workspace_root: orchestratorRoot,
      files_in_scope: ["README.md"],
      objective: "Avoid duplicate soul context",
      constraints: [],
      validation_profile: "typescript-v1",
      context_refs: ["doc:soul", "doc:handoff-protocol"],
    });

    const brief = await service.buildUnifiedBrief("task-test-2");

    expect(brief.soul_doctrine).toBeDefined();
    expect(brief.resolved_context?.map((item) => item.ref)).toEqual(["doc:handoff-protocol"]);
  });

  it("buildRepairContext includes top resolved catalog ref", async () => {
    const queue = new TaskQueue(orchestratorRoot);
    const task = await queue.create({
      assignee: "grok",
      worktree: "test-wt",
      context_refs: ["doc:handoff-protocol"],
      spec: {
        objective: "Repair with context",
        constraints: [],
        files_in_scope: ["README.md"],
        acceptance_criteria: ["Fixed"],
      },
      validation_profile: "typescript-v1",
    });

    await queue.transition(task.id, "in_progress");
    await queue.recordValidation(task.id, false, [
      {
        layer: "rules",
        message: "Constraint violated",
        file: "README.md",
      },
    ]);

    const service = new JanusUnifiedService(janusRoot, baseConfig);
    const repair = await service.buildRepairContext(task.id);

    expect(repair.resolved_context_hint?.ref).toBe("doc:handoff-protocol");
    expect(repair.resolved_context_hint?.excerpt).toContain("Phase 0 Handoff Protocol");
  });
});