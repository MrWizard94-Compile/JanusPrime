import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";
import { Command } from "commander";
import { AssigneeSchema, PatchProposalSchema, TaskStatusSchema } from "@aether/shared";
import { ContextResolver } from "@aether/context";
import { TaskQueue } from "@aether/task-queue";
import { HandoffService } from "@aether/validation-kernel";
import { resolveTaskWorkspace, setupJdtls, WorkloadManager } from "@aether/workload-manager";
import {
  prepareWorktreeDependencies,
  WorktreeManager,
  type CreateWorktreeOptions,
} from "@aether/worktree-manager";
import { OrchestratorService, type DelegationPlan } from "@aether/orchestrator";
import { CommsService, JanusUnifiedService, loadJanusConfig } from "@janus/integrations";
import { findRepoRoot } from "./repo.js";
import { registerJanusCommands } from "./janus-commands.js";

interface TaskCreateFile {
  parent_id?: string | null;
  worktree?: string | null;
  workload?: string | null;
  assignee?: "grok" | "claude" | null;
  context_refs?: string[];
  validation_profile: string;
  spec: {
    objective: string;
    constraints: string[];
    files_in_scope: string[];
    acceptance_criteria: string[];
  };
}

export function buildProgram(cliName: "janus" | "aether" = "aether"): Command {
  const program = new Command();

  if (cliName === "janus") {
    program
      .name("janus")
      .description("JanusPrime CLI — unified autonomous development and asset generation")
      .version("0.4.0");
  } else {
    program
      .name("aether")
      .description("Aether CLI — task queue, validation gate, worktrees, and Phase 1 orchestration")
      .version("0.4.0");
  }

  const task = program.command("task").description("Manage structured tasks");

  task
    .command("create")
    .description("Create a task from a JSON file")
    .requiredOption("-f, --file <path>", "Task definition JSON file")
    .action(async (options: { file: string }) => {
      const repoRoot = await findRepoRoot(process.cwd());
      const queue = new TaskQueue(repoRoot);
      const raw = await readFile(options.file, "utf8");
      const parsed = JSON.parse(raw) as TaskCreateFile;
      const created = await queue.create({
        ...parsed,
        context_refs: parsed.context_refs ?? [],
      });
      console.log(JSON.stringify(created, null, 2));
    });

  task
    .command("list")
    .description("List all tasks")
    .action(async () => {
      const repoRoot = await findRepoRoot(process.cwd());
      const queue = new TaskQueue(repoRoot);
      const tasks = await queue.list();
      console.log(JSON.stringify(tasks, null, 2));
    });

  task
    .command("show")
    .description("Show a single task")
    .argument("<taskId>", "Task identifier")
    .action(async (taskId: string) => {
      const repoRoot = await findRepoRoot(process.cwd());
      const queue = new TaskQueue(repoRoot);
      const entry = await queue.get(taskId);
      console.log(JSON.stringify(entry, null, 2));
    });

  task
    .command("assign")
    .description("Assign a task to grok or claude")
    .argument("<taskId>", "Task identifier")
    .requiredOption("-a, --assignee <name>", "grok or claude")
    .action(async (taskId: string, options: { assignee: string }) => {
      const repoRoot = await findRepoRoot(process.cwd());
      const queue = new TaskQueue(repoRoot);
      const assignee = AssigneeSchema.parse(options.assignee);
      const updated = await queue.assign(taskId, assignee);
      console.log(JSON.stringify(updated, null, 2));
    });

  task
    .command("status")
    .description("Transition task status")
    .argument("<taskId>", "Task identifier")
    .requiredOption("-s, --status <status>", "Target status")
    .action(async (taskId: string, options: { status: string }) => {
      const repoRoot = await findRepoRoot(process.cwd());
      const queue = new TaskQueue(repoRoot);
      const status = TaskStatusSchema.parse(options.status);
      const updated = await queue.transition(taskId, status);
      console.log(JSON.stringify(updated, null, 2));
    });

  const worktree = program.command("worktree").description("Manage git worktrees");

  worktree
    .command("create")
    .description("Create an isolated worktree for a task")
    .requiredOption("-t, --task <taskId>", "Task identifier")
    .option("-b, --base <branch>", "Base branch")
    .option("-w, --workload <id>", "Workload whose cloned repo owns the worktree")
    .option("--recreate", "Tear down pre-existing worktree/branch and rebuild from base", false)
    .action(
      async (options: {
        task: string;
        base?: string;
        workload?: string;
        recreate?: boolean;
      }) => {
        const repoRoot = await findRepoRoot(process.cwd());
        const queue = new TaskQueue(repoRoot);

        const createOptions = buildCreateWorktreeOptions(
          options.task,
          options.base,
          options.recreate,
        );

        const created = options.workload
          ? await new WorkloadManager(repoRoot).createWorktree(options.workload, createOptions)
          : await new WorktreeManager(repoRoot).create({
              ...createOptions,
              baseBranch: createOptions.baseBranch ?? "main",
            });

        const updated = await queue.setWorktree(
          options.task,
          created.name,
          options.workload ?? null,
        );
        console.log(JSON.stringify({ worktree: created, task: updated }, null, 2));
      },
    );

  worktree
    .command("list")
    .description("List Aether-managed worktrees")
    .option("-w, --workload <id>", "List worktrees for a workload repository")
    .action(async (options: { workload?: string }) => {
      const repoRoot = await findRepoRoot(process.cwd());

      const entries = options.workload
        ? await new WorkloadManager(repoRoot).listWorktrees(options.workload)
        : await new WorktreeManager(repoRoot).list();

      console.log(JSON.stringify(entries, null, 2));
    });

  worktree
    .command("prepare")
    .description("Install dependencies in a task worktree")
    .requiredOption("-t, --task <taskId>", "Task identifier")
    .action(async (options: { task: string }) => {
      const repoRoot = await findRepoRoot(process.cwd());
      const queue = new TaskQueue(repoRoot);
      const task = await queue.get(options.task);

      if (!task.worktree) {
        throw new Error(`Task ${task.id} has no worktree`);
      }

      const workspaceRoot = await resolveTaskWorkspaceForCli(repoRoot, task);
      const result = await prepareWorktreeDependencies(workspaceRoot);
      console.log(JSON.stringify(result, null, 2));
    });

  worktree
    .command("destroy")
    .description("Remove worktree and branch for a task")
    .requiredOption("-t, --task <taskId>", "Task identifier")
    .action(async (options: { task: string }) => {
      const repoRoot = await findRepoRoot(process.cwd());
      const queue = new TaskQueue(repoRoot);
      const task = await queue.get(options.task);

      if (task.workload) {
        await new WorkloadManager(repoRoot).destroyWorktree(task.workload, options.task);
      } else {
        await new WorktreeManager(repoRoot).destroy(options.task);
      }

      const updated = await queue.setWorktree(options.task, null);
      console.log(JSON.stringify(updated, null, 2));
    });

  const setup = program.command("setup").description("Bootstrap Aether dependencies");

  setup
    .command("jdtls")
    .description("Download and configure Eclipse JDT.LS for Java validation")
    .option("--java <path>", "Java executable path", "java")
    .action(async (options: { java: string }) => {
      const repoRoot = await findRepoRoot(process.cwd());
      const result = await setupJdtls(repoRoot, options.java);
      console.log(JSON.stringify(result, null, 2));
    });

  const workload = program.command("workload").description("Manage external workload repositories");

  workload
    .command("init")
    .description("Create a workload manifest")
    .argument("<id>", "Workload identifier")
    .requiredOption("-d, --description <text>", "Workload description")
    .option("--url <repository>", "Git repository URL")
    .option("-b, --branch <branch>", "Default branch", "main")
    .option("-p, --profile <id>", "Validation profile", "neoforge-mixin-v1")
    .action(async (id: string, options: { description: string; url?: string; branch: string; profile: string }) => {
      const repoRoot = await findRepoRoot(process.cwd());
      const manager = new WorkloadManager(repoRoot);
      const manifest = await manager.init({
        id,
        description: options.description,
        repository: options.url ?? null,
        branch: options.branch,
        validation_profile: options.profile,
      });
      console.log(JSON.stringify(manifest, null, 2));
    });

  workload
    .command("set-url")
    .description("Set or update workload repository URL")
    .argument("<id>", "Workload identifier")
    .requiredOption("--url <repository>", "Git repository URL")
    .option("-b, --branch <branch>", "Default branch", "main")
    .action(async (id: string, options: { url: string; branch: string }) => {
      const repoRoot = await findRepoRoot(process.cwd());
      const manager = new WorkloadManager(repoRoot);
      const manifest = await manager.setRepository(id, options.url, options.branch);
      console.log(JSON.stringify(manifest, null, 2));
    });

  workload
    .command("list")
    .description("List workload manifests")
    .action(async () => {
      const repoRoot = await findRepoRoot(process.cwd());
      const manager = new WorkloadManager(repoRoot);
      const manifests = await manager.list();
      console.log(JSON.stringify(manifests, null, 2));
    });

  workload
    .command("clone")
    .description("Clone or update a workload repository")
    .argument("<id>", "Workload identifier")
    .action(async (id: string) => {
      const repoRoot = await findRepoRoot(process.cwd());
      const manager = new WorkloadManager(repoRoot);
      const result = await manager.clone(id);
      console.log(JSON.stringify(result, null, 2));
    });

  const workloadWorktree = workload
    .command("worktree")
    .description("Manage git worktrees inside a workload repository");

  workloadWorktree
    .command("create")
    .description("Create an isolated worktree for a task in a workload repo")
    .argument("<id>", "Workload identifier")
    .requiredOption("-t, --task <taskId>", "Task identifier")
    .option("-b, --base <branch>", "Base branch")
    .action(async (id: string, options: { task: string; base?: string }) => {
      const repoRoot = await findRepoRoot(process.cwd());
      const manager = new WorkloadManager(repoRoot);
      const queue = new TaskQueue(repoRoot);

      const created = await manager.createWorktree(
        id,
        buildCreateWorktreeOptions(options.task, options.base),
      );

      const updated = await queue.setWorktree(options.task, created.name, id);
      console.log(JSON.stringify({ worktree: created, task: updated }, null, 2));
    });

  workloadWorktree
    .command("list")
    .description("List Aether-managed worktrees for a workload repository")
    .argument("<id>", "Workload identifier")
    .action(async (id: string) => {
      const repoRoot = await findRepoRoot(process.cwd());
      const manager = new WorkloadManager(repoRoot);
      const entries = await manager.listWorktrees(id);
      console.log(JSON.stringify(entries, null, 2));
    });

  workloadWorktree
    .command("destroy")
    .description("Remove worktree and branch for a task in a workload repository")
    .argument("<id>", "Workload identifier")
    .requiredOption("-t, --task <taskId>", "Task identifier")
    .action(async (id: string, options: { task: string }) => {
      const repoRoot = await findRepoRoot(process.cwd());
      const manager = new WorkloadManager(repoRoot);
      const queue = new TaskQueue(repoRoot);

      await manager.destroyWorktree(id, options.task);
      const updated = await queue.setWorktree(options.task, null);
      console.log(JSON.stringify(updated, null, 2));
    });

  const context = program.command("context").description("Resolve task context references");

  context
    .command("resolve")
    .description("Resolve context refs to markdown documents")
    .option("-t, --task <taskId>", "Resolve refs from a task")
    .option("-r, --refs <refs>", "Comma-separated context refs")
    .action(async (options: { task?: string; refs?: string }) => {
      const repoRoot = await findRepoRoot(process.cwd());
      const resolver = new ContextResolver(repoRoot);

      let refs: string[] = [];
      if (options.task) {
        const queue = new TaskQueue(repoRoot);
        const task = await queue.get(options.task);
        refs = task.context_refs;
      } else if (options.refs) {
        refs = options.refs.split(",").map((ref) => ref.trim()).filter((ref) => ref.length > 0);
      } else {
        throw new Error("Provide --task or --refs");
      }

      const bundle = await resolver.resolve(refs);
      console.log(JSON.stringify(bundle, null, 2));
    });

  context
    .command("catalog")
    .description("List known context references")
    .action(async () => {
      const repoRoot = await findRepoRoot(process.cwd());
      const resolver = new ContextResolver(repoRoot);
      console.log(JSON.stringify(resolver.listCatalog(), null, 2));
    });

  const patch = program.command("patch").description("Submit and apply validated patches");

  patch
    .command("submit")
    .description("Validate a patch proposal against the task worktree")
    .requiredOption("-f, --file <path>", "Patch proposal JSON file")
    .option("--apply", "Persist patch when validation passes", false)
    .action(async (options: { file: string; apply: boolean }) => {
      const repoRoot = await findRepoRoot(process.cwd());
      const raw = await readFile(options.file, "utf8");
      const proposal = PatchProposalSchema.parse(JSON.parse(raw) as unknown);
      const handoff = new HandoffService(repoRoot);
      const result = await handoff.submit({
        repoRoot,
        proposal,
        apply: options.apply,
      });

      console.log(
        JSON.stringify(
          {
            applied: result.applied,
            task: result.task,
            validation: result.validation,
          },
          null,
          2,
        ),
      );

      if (!result.validation.passed) {
        process.exitCode = 1;
      }
    });

  patch
    .command("apply")
    .description("Apply a patch that already has a passing validation receipt")
    .requiredOption("-f, --file <path>", "Patch proposal JSON file")
    .action(async (options: { file: string }) => {
      const repoRoot = await findRepoRoot(process.cwd());
      const raw = await readFile(options.file, "utf8");
      const proposal = PatchProposalSchema.parse(JSON.parse(raw) as unknown);
      const handoff = new HandoffService(repoRoot);
      const task = await handoff.applyValidatedPatch(repoRoot, proposal);
      console.log(JSON.stringify(task, null, 2));
    });

  const orchestrate = program
    .command("orchestrate")
    .description("Phase 1 orchestration — delegation plans and child rollups");

  orchestrate
    .command("plan")
    .description("Create parent and child tasks from a delegation plan JSON file")
    .requiredOption("-f, --file <path>", "Delegation plan JSON file")
    .action(async (options: { file: string }) => {
      const repoRoot = await findRepoRoot(process.cwd());
      const raw = await readFile(options.file, "utf8");
      const plan = JSON.parse(raw) as unknown;
      const orchestrator = new OrchestratorService(repoRoot);
      const result = await orchestrator.createPlan(plan as DelegationPlan);
      console.log(JSON.stringify(result, null, 2));
    });

  orchestrate
    .command("status")
    .description("Roll up child task statuses for a parent task")
    .requiredOption("-t, --task <parentId>", "Parent task identifier")
    .action(async (options: { task: string }) => {
      const repoRoot = await findRepoRoot(process.cwd());
      const orchestrator = new OrchestratorService(repoRoot);
      const rollup = await orchestrator.rollupStatus(options.task);
      console.log(JSON.stringify(rollup, null, 2));

      if (!rollup.complete) {
        process.exitCode = 1;
      }
    });

  orchestrate
    .command("provision")
    .description("Provision worktrees for all children missing worktrees")
    .requiredOption("-t, --task <parentId>", "Parent task identifier")
    .action(async (options: { task: string }) => {
      const repoRoot = await findRepoRoot(process.cwd());
      const orchestrator = new OrchestratorService(repoRoot);
      const provisioned = await orchestrator.provisionChildren(options.task);
      console.log(JSON.stringify(provisioned, null, 2));
    });

  orchestrate
    .command("run")
    .description("Run identity-patch children through the validation gate")
    .requiredOption("-t, --task <parentId>", "Parent task identifier")
    .action(async (options: { task: string }) => {
      const repoRoot = await findRepoRoot(process.cwd());
      const orchestrator = new OrchestratorService(repoRoot);
      const results = await orchestrator.runChildren(options.task);
      const rollup = await orchestrator.rollupStatus(options.task);
      console.log(JSON.stringify({ results, rollup }, null, 2));

      if (!rollup.complete) {
        process.exitCode = 1;
      }
    });

  const execute = program
    .command("execute")
    .description("Grok executor surface — scoped briefs and identity patches");

  execute
    .command("brief")
    .description("Build minimal executor brief JSON for a task")
    .requiredOption("-t, --task <taskId>", "Task identifier")
    .action(async (options: { task: string }) => {
      try {
        const { root, config } = await loadJanusConfig(process.cwd());
        const unified = new JanusUnifiedService(root, config);
        const brief = await unified.buildUnifiedBrief(options.task);
        console.log(JSON.stringify(brief, null, 2));
      } catch {
        const repoRoot = await findRepoRoot(process.cwd());
        const orchestrator = new OrchestratorService(repoRoot);
        const brief = await orchestrator.buildExecutorBrief(options.task);
        console.log(JSON.stringify(brief, null, 2));
      }
    });

  execute
    .command("identity-patch")
    .description("Build identity patch proposal JSON (no submit)")
    .requiredOption("-t, --task <taskId>", "Task identifier")
    .action(async (options: { task: string }) => {
      const repoRoot = await findRepoRoot(process.cwd());
      const orchestrator = new OrchestratorService(repoRoot);
      const proposal = await orchestrator.buildIdentityPatch(options.task);
      console.log(JSON.stringify(proposal, null, 2));
    });

  execute
    .command("run")
    .description("Execute an identity-patch task through the validation gate")
    .requiredOption("-t, --task <taskId>", "Task identifier")
    .action(async (options: { task: string }) => {
      const repoRoot = await findRepoRoot(process.cwd());
      const orchestrator = new OrchestratorService(repoRoot);
      const result = await orchestrator.executeIdentityTask(options.task);
      console.log(JSON.stringify(result, null, 2));

      if (result.task.status !== "accepted" || !result.validation.passed) {
        process.exitCode = 1;
      }
    });

  registerJanusCommands(program);

  const janus = program.commands.find((c) => c.name() === "janus") as Command | undefined;
  if (janus) {
    const comms = janus
      .command("comms")
      .description("MCP comms channel backed by append-only .aether/comms.jsonl mirrored to COMMS-CLAUDE-GROK.md");

    comms
      .command("post")
      .description("Post a message (appends to JSONL and mirrors to markdown)")
      .requiredOption("--author <name>", "Author (e.g. Grok or Claude)")
      .requiredOption("--recipient <name>", "Recipient")
      .option("-t, --task <taskId>", "Associated task id")
      .requiredOption("--status <status>", "INFO | ASK | BLOCKED | HANDOFF | DONE")
      .requiredOption("--body <text>", "Message body")
      .action(async (opts: { author: string; recipient: string; task?: string; status: string; body: string }) => {
        const { root } = await loadJanusConfig(process.cwd());
        const svc = new CommsService(root);
        const res = await svc.post({
          author: opts.author,
          recipient: opts.recipient,
          task_id: opts.task,
          status: opts.status as "INFO" | "ASK" | "BLOCKED" | "HANDOFF" | "DONE",
          body: opts.body,
        });
        console.log(JSON.stringify(res, null, 2));
      });

    comms
      .command("read")
      .description("Read recent messages, optionally filtered by task_id and since")
      .option("-t, --task <taskId>", "Filter to task_id")
      .option("--since <isoTs>", "ISO-8601 lower bound (inclusive)")
      .option("--limit <n>", "Max messages to return", "100")
      .action(async (opts: { task?: string; since?: string; limit?: string }) => {
        const { root } = await loadJanusConfig(process.cwd());
        const svc = new CommsService(root);
        const res = await svc.read({
          task_id: opts.task,
          since: opts.since,
          limit: opts.limit ? Number.parseInt(opts.limit, 10) : undefined,
        });
        console.log(JSON.stringify(res, null, 2));
      });

    // Qwen fallback + multi-executor dispatch (under janus for "janus dispatch")
    janus
      .command("dispatch")
      .description("Dispatch task execution to grok (primary) or qwen (ollama tool-calling fallback) or auto")
      .requiredOption("-t, --task <taskId>", "Task identifier")
      .option("--executor <mode>", "grok | qwen | auto", "auto")
      .action(async (options: { task: string; executor?: string }) => {
        const repoRoot = await findRepoRoot(process.cwd());
        const { root: cfgRoot } = await loadJanusConfig(process.cwd());
        const raw = await readFile(join(cfgRoot, "janus.config.json"), "utf8");
        const fullCfg = JSON.parse(raw) as Record<string, unknown>;
        const execSection = (fullCfg["executor"] ?? fullCfg) as Record<string, unknown>;
        const providers = ((execSection["providers"] ?? {}) as Record<string, unknown>);
        const mode = (options.executor ?? "auto").toLowerCase();

        const doQwen = async () => {
          const qwenCfg = ((providers["qwen"] ?? {}) as Record<string, unknown>);
          // Runtime load of built module from package dist (no static import, no barrel edit, no src relative)
          const intRoot = join(cfgRoot, "Project-Janus", "packages", "janus-integrations");
          const qwenJs = join(intRoot, "dist", "qwen-executor.js");
          const mod = await import("file://" + qwenJs.replace(/\\/g, "/"));
          const exported = mod as Record<string, unknown>;
          interface QwenLike {
            new (r: string, c: Record<string, unknown>): { execute(id: string): Promise<Record<string, unknown>> };
          }
          const cand = exported["QwenExecutor"] ?? exported["default"];
          const makeCtor = (x: unknown): QwenLike => x as QwenLike;
          const QwenCtor = makeCtor(cand);
          const qwen = new QwenCtor(repoRoot, fullCfg);
          const result = await qwen.execute(options.task);
          console.log(JSON.stringify({ executor: "qwen", result }, null, 2));
          if (!result || (result as { passed?: boolean }).passed !== true) {
            process.exitCode = 1;
          }
        };

        if (mode === "qwen") {
          await doQwen();
          return;
        }
        if (mode === "grok") {
          console.log(JSON.stringify({ executor: "grok", note: "primary handled via external grok cli per dispatch-executor.ps1", task: options.task }));
          return;
        }
        // auto: prefer qwen path for this fallback impl (grok is external)
        if (providers["qwen"]) {
          await doQwen();
        } else {
          console.log(JSON.stringify({ executor: "auto", note: "no qwen provider, nothing to dispatch in this stub" }));
        }
      });
  }

  // Also expose top-level dispatch for direct "node bin.js dispatch" (ps1 probe compatibility)
  program
    .command("dispatch")
    .description("Dispatch task to executor (alias)")
    .requiredOption("-t, --task <taskId>", "Task identifier")
    .option("--executor <mode>", "grok | qwen | auto", "auto")
    .action(async (options: { task: string; executor?: string }) => {
      // Delegate to janus sub impl by re-invoking same logic (dupe small for no extra files)
      const repoRoot = await findRepoRoot(process.cwd());
      const { root: cfgRoot } = await loadJanusConfig(process.cwd());
      const raw = await readFile(join(cfgRoot, "janus.config.json"), "utf8");
      const fullCfg = JSON.parse(raw) as Record<string, unknown>;
      const execSection = (fullCfg["executor"] ?? fullCfg) as Record<string, unknown>;
      const providers = ((execSection["providers"] ?? {}) as Record<string, unknown>);
      const mode = (options.executor ?? "auto").toLowerCase();

      if (mode === "qwen" || (mode === "auto" && providers["qwen"])) {
        const intRoot = join(cfgRoot, "Project-Janus", "packages", "janus-integrations");
        const qwenJs = join(intRoot, "dist", "qwen-executor.js");
        const mod = await import("file://" + qwenJs.replace(/\\/g, "/"));
        const exported = mod as Record<string, unknown>;
        interface QwenLike {
          new (r: string, c: Record<string, unknown>): { execute(id: string): Promise<Record<string, unknown>> };
        }
        const cand = exported["QwenExecutor"] ?? exported["default"];
        const makeCtor = (x: unknown): QwenLike => x as QwenLike;
        const QwenCtor = makeCtor(cand);
        const qwen = new QwenCtor(repoRoot, fullCfg);
        const result = await qwen.execute(options.task);
        console.log(JSON.stringify({ executor: "qwen", result }, null, 2));
        if (!result || (result as { passed?: boolean }).passed !== true) {
          process.exitCode = 1;
        }
      } else {
        console.log(JSON.stringify({ executor: mode, note: "delegated or external" }));
      }
    });

  return program;
}

async function resolveTaskWorkspaceForCli(
  repoRoot: string,
  task: Awaited<ReturnType<TaskQueue["get"]>>,
): Promise<string> {
  return resolveTaskWorkspace(repoRoot, task);
}

function buildCreateWorktreeOptions(
  taskId: string,
  baseBranch?: string,
  recreate?: boolean,
): CreateWorktreeOptions {
  const options: CreateWorktreeOptions = { taskId };
  if (baseBranch !== undefined) {
    options.baseBranch = baseBranch;
  }
  if (recreate) {
    options.recreate = true;
  }
  return options;
}
