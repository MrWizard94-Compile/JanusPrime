import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrchestratorService } from "@aether/orchestrator";
import { TaskQueue } from "@aether/task-queue";
import type { JanusConfig } from "./config.js";
import { MemoryClient } from "./memory-client.js";
import { RelBridge } from "./rel-bridge.js";
import {
  JanusUnifiedService,
  buildResolvedContext,
  enforceBriefBudget,
  measureBriefContentChars,
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

describe("enforceBriefBudget", () => {
  const baseBrief = {
    task_id: "task-budget-1",
    assignee: "grok" as const,
    workspace_root: "/tmp/workspace",
    files_in_scope: ["src/index.ts"],
    objective: "Ship the feature",
    constraints: ["Keep tests green"],
    validation_profile: "typescript-v1",
    context_refs: [] as string[],
    doctrine_ref: "doc:soul" as const,
    token_estimate_chars: 0,
  };

  it("truncates huge soul_doctrine to fit brief_max_chars", () => {
    const hugeSoul = "soul-".repeat(5000);
    const unified = enforceBriefBudget(
      {
        ...baseBrief,
        soul_doctrine: hugeSoul,
        token_estimate_chars: hugeSoul.length,
      },
      500,
    );

    expect(measureBriefContentChars(unified)).toBeLessThanOrEqual(500);
    expect(unified.token_estimate_chars).toBe(measureBriefContentChars(unified));
    expect(unified.soul_doctrine?.length ?? 0).toBeLessThan(hugeSoul.length);
    expect(unified.objective).toBe("Ship the feature");
  });

  it("preserves base brief fields before truncating soul_doctrine", () => {
    const unified = enforceBriefBudget(
      {
        ...baseBrief,
        soul_doctrine: "x".repeat(1000),
        memory_context: ["memory-".repeat(200)],
        resolved_context: [{ ref: "doc:handoff-protocol", excerpt: "resolved-".repeat(200) }],
      },
      120,
    );

    expect(measureBriefContentChars(unified)).toBeLessThanOrEqual(120);
    expect(unified.memory_context).toBeUndefined();
    expect(unified.resolved_context).toBeUndefined();
    expect(unified.objective).toBe("Ship the feature");
    expect(unified.soul_doctrine?.length ?? 0).toBeLessThan(1000);
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

  it("buildUnifiedBrief enforces brief_max_chars on assembled content", async () => {
    const tightConfig: JanusConfig = {
      ...baseConfig,
      token_policy: {
        ...baseConfig.token_policy,
        brief_max_chars: 200,
      },
      doctrine: {
        ...baseConfig.doctrine,
        brief_excerpt_max_chars: 10000,
      },
    };

    await writeFile(
      join(janusRoot, "SOUL.md"),
      `# Test Soul\n${"Validation before mutation. ".repeat(400)}\n`,
      "utf8",
    );
    await writeFile(join(janusRoot, "janus.config.json"), JSON.stringify(tightConfig, null, 2), "utf8");

    const service = new JanusUnifiedService(janusRoot, tightConfig);
    const brief = await service.buildUnifiedBrief("task-budget-integration");

    expect(measureBriefContentChars(brief)).toBeLessThanOrEqual(200);
    expect(brief.token_estimate_chars).toBe(measureBriefContentChars(brief));
    expect(brief.soul_doctrine?.length ?? 0).toBeLessThan(10000);
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

describe("JanusUnifiedService doc:rel-state injection", () => {
  let janusRoot = "";

  const cognitionConfig: JanusConfig = {
    version: "1.0.0",
    name: "janus-rel-test",
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
        allow_query_llm_fallback: false,
      },
      assets: {
        root: "assets",
        entry: "ac.py",
        python: "python",
      },
      cognition: {
        root: "cognition",
        rest_url: "http://localhost:3001",
        api_key_env: "JANUS_REL_API_KEY",
        bearer_token_env: "JANUS_REL_BEARER_TOKEN",
        log_loop_outcomes: false,
        sync_concepts_to_memory: false,
        concept_sync_max_chars: 2000,
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
      inject_into_brief: false,
      inject_into_mcp_instructions: false,
      seed_on_boot: false,
      brief_excerpt_max_chars: 4000,
    },
  };

  beforeEach(async () => {
    janusRoot = await mkdtemp(join(tmpdir(), "janus-rel-"));
    await writeFile(join(janusRoot, "janus.config.json"), JSON.stringify(cognitionConfig, null, 2), "utf8");
    vi.spyOn(MemoryClient.prototype, "queryContextSlices").mockResolvedValue([]);
    vi.spyOn(OrchestratorService.prototype, "buildExecutorBrief").mockImplementation(
      async (taskId: string) => ({
        task_id: taskId,
        assignee: "grok",
        workspace_root: join(janusRoot, "orch"),
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

  it("does not inject REL excerpt for grok assignee with doc:rel-state", async () => {
    const relSpy = vi
      .spyOn(RelBridge.prototype, "getStateExcerpt")
      .mockResolvedValue("REL cognitive state excerpt");

    const service = new JanusUnifiedService(janusRoot, cognitionConfig);
    vi.mocked(OrchestratorService.prototype.buildExecutorBrief).mockResolvedValueOnce({
      task_id: "task-rel-grok",
      assignee: "grok",
      workspace_root: join(janusRoot, "orch"),
      files_in_scope: ["README.md"],
      objective: "Grok task with rel-state ref",
      constraints: [],
      validation_profile: "typescript-v1",
      context_refs: ["doc:rel-state"],
    });

    const brief = await service.buildUnifiedBrief("task-rel-grok");

    expect(relSpy).not.toHaveBeenCalled();
    expect(brief.resolved_context?.some((item) => item.ref === "doc:rel-state")).toBeFalsy();
  });

  it("injects REL excerpt for claude assignee with doc:rel-state and cognition configured", async () => {
    const relExcerpt = "REL cognitive state excerpt for orchestrator";
    const relSpy = vi
      .spyOn(RelBridge.prototype, "getStateExcerpt")
      .mockResolvedValue(relExcerpt);

    const service = new JanusUnifiedService(janusRoot, cognitionConfig);
    vi.mocked(OrchestratorService.prototype.buildExecutorBrief).mockResolvedValueOnce({
      task_id: "task-rel-claude",
      assignee: "claude",
      workspace_root: join(janusRoot, "orch"),
      files_in_scope: ["README.md"],
      objective: "Claude task with rel-state ref",
      constraints: [],
      validation_profile: "typescript-v1",
      context_refs: ["doc:rel-state"],
    });

    const brief = await service.buildUnifiedBrief("task-rel-claude");

    expect(relSpy).toHaveBeenCalledWith(cognitionConfig.token_policy.rel_context_max_chars);
    const relContext = brief.resolved_context?.find((item) => item.ref === "doc:rel-state");
    expect(relContext).toBeDefined();
    expect(relContext?.excerpt).toBe(relExcerpt);
  });

  it("does not inject REL excerpt for claude assignee without doc:rel-state", async () => {
    const relSpy = vi
      .spyOn(RelBridge.prototype, "getStateExcerpt")
      .mockResolvedValue("REL cognitive state excerpt");

    const service = new JanusUnifiedService(janusRoot, cognitionConfig);
    vi.mocked(OrchestratorService.prototype.buildExecutorBrief).mockResolvedValueOnce({
      task_id: "task-rel-claude-no-ref",
      assignee: "claude",
      workspace_root: join(janusRoot, "orch"),
      files_in_scope: ["README.md"],
      objective: "Claude task without rel-state ref",
      constraints: [],
      validation_profile: "typescript-v1",
      context_refs: ["doc:handoff-protocol"],
    });

    const brief = await service.buildUnifiedBrief("task-rel-claude-no-ref");

    expect(relSpy).not.toHaveBeenCalled();
    expect(brief.resolved_context?.some((item) => item.ref === "doc:rel-state")).toBeFalsy();
  });
});