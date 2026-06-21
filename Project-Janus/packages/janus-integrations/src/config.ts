import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";

const JanusConfigSchema = z.object({
  version: z.string(),
  name: z.string(),
  description: z.string().optional(),
  components: z.object({
    orchestrator: z.object({
      root: z.string(),
      state_dir: z.string().default(".aether"),
    }),
    memory: z.object({
      root: z.string(),
      url: z.string().url(),
      api_key_env: z.string().default("JANUS_MEMORY_API_KEY"),
      context_limit: z.number().int().positive().default(3),
      max_context_chars: z.number().int().positive().default(8000),
      allow_query_llm_fallback: z.boolean().default(false),
    }),
    assets: z.object({
      root: z.string(),
      entry: z.string().default("ac.py"),
      python: z.string().default("python"),
    }),
    cognition: z
      .object({
        root: z.string(),
        rest_url: z.string().url(),
        api_key_env: z.string().default("JANUS_REL_API_KEY"),
        bearer_token_env: z.string().default("JANUS_REL_BEARER_TOKEN"),
        log_loop_outcomes: z.boolean().default(true),
        sync_concepts_to_memory: z.boolean().default(true),
        concept_sync_max_chars: z.number().int().positive().default(2000),
      })
      .optional(),
  }),
  self_repair: z
    .object({
      max_validation_retries: z.number().int().positive().default(5),
      max_heal_attempts: z.number().int().positive().default(3),
      seed_on_accept: z.boolean().default(true),
      seed_on_heal: z.boolean().default(true),
    })
    .default({
      max_validation_retries: 5,
      max_heal_attempts: 3,
      seed_on_accept: true,
      seed_on_heal: true,
    }),
  token_policy: z
    .object({
      brief_max_chars: z.number().int().positive().default(12000),
      memory_slice_max_chars: z.number().int().positive().default(2000),
      resolved_context_max_chars: z.number().int().positive().default(3000),
      validation_error_max: z.number().int().positive().default(20),
      rel_context_max_chars: z.number().int().positive().default(800),
    })
    .default({
      brief_max_chars: 12000,
      memory_slice_max_chars: 2000,
      resolved_context_max_chars: 3000,
      validation_error_max: 20,
      rel_context_max_chars: 800,
    }),
  doctrine: z
    .object({
      claude_path: z.string().default("CLAUDE.md"),
      inject_into_brief: z.boolean().default(true),
      inject_into_mcp_instructions: z.boolean().default(true),
      seed_on_boot: z.boolean().default(false),
      brief_excerpt_max_chars: z.number().int().positive().default(4000),
      mcp_instruction_excerpt_max_chars: z.number().int().positive().default(1500),
    })
    .default({
      claude_path: "CLAUDE.md",
      inject_into_brief: true,
      inject_into_mcp_instructions: true,
      seed_on_boot: false,
      brief_excerpt_max_chars: 4000,
      mcp_instruction_excerpt_max_chars: 1500,
    }),
});

export type JanusConfig = z.infer<typeof JanusConfigSchema>;

const CONFIG_FILENAME = "janus.config.json";

export async function findJanusRoot(startDir: string): Promise<string> {
  let current = resolve(startDir);

  for (let depth = 0; depth < 32; depth += 1) {
    try {
      await readFile(join(current, CONFIG_FILENAME), "utf8");
      return current;
    } catch {
      const parent = dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }
  }

  throw new Error(
    `Could not find ${CONFIG_FILENAME} walking up from ${startDir}. Run janus from the unified workspace root.`,
  );
}

/** Load workspace `.env` into `process.env` (does not override existing vars). */
export async function loadEnvFile(janusRoot: string): Promise<void> {
  let raw: string;
  try {
    raw = await readFile(join(janusRoot, ".env"), "utf8");
  } catch {
    return;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export async function loadJanusConfig(startDir: string): Promise<{
  root: string;
  config: JanusConfig;
}> {
  const root = await findJanusRoot(startDir);
  await loadEnvFile(root);
  const raw = await readFile(join(root, CONFIG_FILENAME), "utf8");
  const config = JanusConfigSchema.parse(JSON.parse(raw));
  return { root, config };
}

const ENV_PATH_PREFIX = "env:";

export function expandConfigPath(janusRoot: string, pathValue: string): string {
  let expanded = pathValue;
  if (pathValue.startsWith(ENV_PATH_PREFIX)) {
    const varName = pathValue.slice(ENV_PATH_PREFIX.length);
    if (!varName) {
      throw new Error(`Invalid env path reference: ${pathValue}`);
    }
    const envValue =
      process.env[varName] ??
      (varName === "REL_COGNITION_ROOT" ? process.env["REL_BUILD_CONTEXT"] : undefined);
    if (envValue === undefined || envValue === "") {
      throw new Error(
        `Environment variable ${varName} is not set (required by config path ${pathValue})`,
      );
    }
    expanded = envValue;
  }
  return resolve(janusRoot, expanded);
}

export function resolveComponentPath(janusRoot: string, relativePath: string): string {
  return resolve(janusRoot, relativePath);
}

export function resolveOrchestratorRoot(janusRoot: string, config: JanusConfig): string {
  return resolveComponentPath(janusRoot, config.components.orchestrator.root);
}

export function resolveMemoryRoot(janusRoot: string, config: JanusConfig): string {
  return resolveComponentPath(janusRoot, config.components.memory.root);
}

export function resolveAssetRoot(janusRoot: string, config: JanusConfig): string {
  return resolveComponentPath(janusRoot, config.components.assets.root);
}

export function resolveCognitionRoot(janusRoot: string, config: JanusConfig): string | undefined {
  const cognition = config.components.cognition;
  if (!cognition) {
    return undefined;
  }
  return expandConfigPath(janusRoot, cognition.root);
}

/** Resolve cognition filesystem root when env is configured; undefined if env vars are missing. */
export function tryResolveCognitionRoot(
  janusRoot: string,
  config: JanusConfig,
): string | undefined {
  try {
    return resolveCognitionRoot(janusRoot, config);
  } catch {
    return undefined;
  }
}