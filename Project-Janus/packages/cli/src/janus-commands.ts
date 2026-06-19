import { readFile } from "node:fs/promises";
import type { Command } from "commander";
import {
  JanusAutonomousLoop,
  JanusUnifiedService,
  loadJanusConfig,
  MemoryClient,
  AssetRunner,
} from "@janus/integrations";

async function loadJanusService(cwd: string): Promise<JanusUnifiedService> {
  const { root, config } = await loadJanusConfig(cwd);
  return new JanusUnifiedService(root, config);
}

export function registerJanusCommands(program: Command): void {
  const janus = program
    .command("janus")
    .description("JanusPrime unified system — memory, assets, and token-efficient briefs");

  janus
    .command("status")
    .description("Show unified system status across all components")
    .action(async () => {
      const service = await loadJanusService(process.cwd());
      const status = await service.getSystemStatus();
      console.log(JSON.stringify(status, null, 2));
    });

  janus
    .command("brief")
    .description("Build token-efficient executor brief with memory context slices")
    .requiredOption("-t, --task <taskId>", "Task identifier")
    .action(async (options: { task: string }) => {
      const service = await loadJanusService(process.cwd());
      const brief = await service.buildUnifiedBrief(options.task);
      console.log(JSON.stringify(brief, null, 2));
    });

  janus
    .command("repair")
    .description("Build repair context from validation errors + memory retrieval")
    .requiredOption("-t, --task <taskId>", "Task identifier")
    .action(async (options: { task: string }) => {
      const service = await loadJanusService(process.cwd());
      const context = await service.buildRepairContext(options.task);
      console.log(JSON.stringify(context, null, 2));
    });

  janus
    .command("seed")
    .description("Seed an accepted task pattern into memory for future retrieval")
    .requiredOption("-t, --task <taskId>", "Task identifier")
    .action(async (options: { task: string }) => {
      const service = await loadJanusService(process.cwd());
      const result = await service.seedAcceptedTask(options.task);
      console.log(JSON.stringify(result, null, 2));
    });

  const doctrine = janus.command("doctrine").description("SOUL.md doctrine operations");

  doctrine
    .command("seed")
    .description("Bootstrap SOUL.md into Smart-Library memory (run once per environment)")
    .action(async () => {
      const service = await loadJanusService(process.cwd());
      const result = await service.seedDoctrine();
      console.log(JSON.stringify(result, null, 2));
    });

  doctrine
    .command("status")
    .description("Compare SOUL.md hash against doctrine stored in memory")
    .option("--reseed", "Re-seed SOUL.md when memory is stale or unreachable")
    .action(async (options: { reseed?: boolean }) => {
      const service = await loadJanusService(process.cwd());
      let status = await service.getDoctrineStatus();

      if (options.reseed && !status.fresh) {
        const seedResult = await service.seedDoctrine();
        status = await service.getDoctrineStatus();
        console.log(
          JSON.stringify(
            {
              ...status,
              reseeded: seedResult.seeded,
              reseed_message: seedResult.message,
            },
            null,
            2,
          ),
        );
        return;
      }

      console.log(JSON.stringify(status, null, 2));

      if (!status.fresh && status.memory_reachable) {
        process.exitCode = 1;
      }
    });

  const loop = janus.command("loop").description("Autonomous plan→execute→validate→seed loop");

  loop
    .command("run")
    .description("Run autonomous loop for a parent delegation task")
    .requiredOption("-t, --task <parentId>", "Parent task identifier")
    .option("--max-rounds <n>", "Maximum retry rounds", "5")
    .option("--no-seed", "Skip seeding accepted tasks to memory")
    .action(async (options: { task: string; maxRounds: string; noSeed?: boolean }) => {
      const { root, config } = await loadJanusConfig(process.cwd());
      const autonomous = new JanusAutonomousLoop(root, config);
      const result = await autonomous.run(options.task, {
        max_rounds: Number.parseInt(options.maxRounds, 10),
        seed_on_accept: !options.noSeed,
      });
      console.log(JSON.stringify(result, null, 2));

      if (!result.complete) {
        process.exitCode = 1;
      }
    });

  const memory = janus.command("memory").description("Smart-Library memory service");

  memory
    .command("health")
    .description("Check memory service health")
    .action(async () => {
      const { config } = await loadJanusConfig(process.cwd());
      const client = new MemoryClient(config.components.memory);
      const health = await client.health();
      console.log(JSON.stringify(health, null, 2));
    });

  memory
    .command("query")
    .description("Semantic query against the memory store")
    .requiredOption("-q, --query <text>", "Query text")
    .action(async (options: { query: string }) => {
      const { config } = await loadJanusConfig(process.cwd());
      const client = new MemoryClient(config.components.memory);
      const result = await client.query(options.query);
      console.log(JSON.stringify(result, null, 2));
    });

  memory
    .command("heal")
    .description("Execute and self-heal Python code via sandbox")
    .option("-f, --file <path>", "Python file to heal")
    .option("-c, --code <text>", "Inline Python code to heal")
    .action(async (options: { file?: string; code?: string }) => {
      let code = options.code;
      if (options.file) {
        code = await readFile(options.file, "utf8");
      }
      if (!code) {
        throw new Error("Provide --file or --code");
      }

      const { config } = await loadJanusConfig(process.cwd());
      const client = new MemoryClient(config.components.memory);
      const report = await client.heal(code);
      console.log(JSON.stringify(report, null, 2));

      if (report.status === "Failed") {
        process.exitCode = 1;
      }
    });

  const assets = janus.command("assets").description("AssetConverter Omni32 pipeline");

  assets
    .command("queue")
    .description("Show asset processing queue status")
    .action(async () => {
      const { root, config } = await loadJanusConfig(process.cwd());
      const runner = new AssetRunner(root, config);
      const status = await runner.queue();
      console.log(status.raw);
    });

  assets
    .command("run")
    .description("Run full asset pipeline for a mod")
    .argument("<modId>", "Mod identifier from registry")
    .option("--method <method>", "Upscale method (xbrz, hq2x, waifu2x)", "xbrz")
    .option("--build", "Build resource pack after upscale")
    .action(async (modId: string, options: { method: string; build?: boolean }) => {
      const { root, config } = await loadJanusConfig(process.cwd());
      const runner = new AssetRunner(root, config);
      const result = await runner.runMod(modId, {
        method: options.method,
        build: options.build ?? false,
      });
      console.log(result.stdout);
      if (result.stderr) {
        console.error(result.stderr);
      }
      if (result.exitCode !== 0) {
        process.exitCode = result.exitCode;
      }
    });

  assets
    .command("audit")
    .description("Pre-flight texture audit for a mod")
    .argument("<modId>", "Mod identifier")
    .action(async (modId: string) => {
      const { root, config } = await loadJanusConfig(process.cwd());
      const runner = new AssetRunner(root, config);
      const result = await runner.auditMod(modId);
      console.log(result.stdout);
      if (result.stderr) {
        console.error(result.stderr);
      }
      if (result.exitCode !== 0) {
        process.exitCode = result.exitCode;
      }
    });

  assets
    .command("build")
    .description("Assemble Omni32 resource pack from upscaled assets")
    .option("--deploy", "Deploy to configured Minecraft instance")
    .action(async (options: { deploy?: boolean }) => {
      const { root, config } = await loadJanusConfig(process.cwd());
      const runner = new AssetRunner(root, config);
      const result = await runner.build(options.deploy ?? false);
      console.log(result.stdout);
      if (result.stderr) {
        console.error(result.stderr);
      }
      if (result.exitCode !== 0) {
        process.exitCode = result.exitCode;
      }
    });

  assets
    .command("stats")
    .description("Show asset engine dashboard")
    .action(async () => {
      const { root, config } = await loadJanusConfig(process.cwd());
      const runner = new AssetRunner(root, config);
      const result = await runner.stats();
      console.log(result.stdout);
      if (result.stderr) {
        console.error(result.stderr);
      }
    });
}