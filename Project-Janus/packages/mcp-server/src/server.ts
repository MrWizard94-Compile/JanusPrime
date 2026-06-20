import { readFile } from "node:fs/promises";
import { ContextResolver } from "@aether/context";
import { CONTEXT_CATALOG, resolveReceiptPath } from "@aether/shared";
import { TaskQueue } from "@aether/task-queue";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { excerptClaude, loadJanusConfig, loadClaude } from "@janus/integrations";
import { registerJanusMcpResources, resolveJanusRoot } from "./janus-resources.js";

export interface AetherMcpOptions {
  repoRoot: string;
  taskId: string;
}

export async function createAetherMcpServer(options: AetherMcpOptions): Promise<McpServer> {
  const queue = new TaskQueue(options.repoRoot);
  const context = new ContextResolver(options.repoRoot);
  const boundTaskId = options.taskId;

  let claudeInstruction = "";
  const discoveredRoot = await resolveJanusRoot(options.repoRoot);
  const janusRoot = process.env["JANUS_ROOT"] ?? discoveredRoot;
  if (janusRoot) {
    try {
      const { config } = await loadJanusConfig(janusRoot);
      if (config.doctrine.inject_into_mcp_instructions) {
        const claude = await loadClaude(janusRoot, config);
        const excerpt = excerptClaude(claude, config.doctrine.mcp_instruction_excerpt_max_chars);
        claudeInstruction = `\n\nOperational doctrine (CLAUDE.md excerpt):\n${excerpt}`;
      }
    } catch {
      // Non-fatal if doctrine unavailable
    }
  }

  const server = new McpServer(
    {
      name: "aether-mcp",
      version: "0.1.0",
    },
    {
      instructions: [
        "Janus/Aether MCP — task-scoped agent surface. Bound to a single task id.",
        "Read janus://doctrine/claude or aether://context/doc:claude for full operational doctrine.",
        "Use resources: task spec, validation result, unified brief, repair context, memory health.",
        claudeInstruction,
      ].join(" "),
    },
  );

  server.registerResource(
    "task",
    `aether://task/${boundTaskId}`,
    {
      title: "Bound task",
      description: "Current Aether task spec and status",
      mimeType: "application/json",
    },
    async () => {
      const task = await queue.get(boundTaskId);
      if (task.id !== boundTaskId) {
        throw new Error("Task scope violation");
      }

      return {
        contents: [
          {
            uri: `aether://task/${boundTaskId}`,
            mimeType: "application/json",
            text: JSON.stringify(task, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    "validation-last",
    `aether://validation/${boundTaskId}/last`,
    {
      title: "Last validation result",
      description: "Most recent validation receipt and task attempts",
      mimeType: "application/json",
    },
    async () => {
      const task = await queue.get(boundTaskId);
      const receiptPath = resolveReceiptPath(options.repoRoot, boundTaskId);

      let receipt: unknown = null;
      try {
        receipt = JSON.parse(await readFile(receiptPath, "utf8")) as unknown;
      } catch {
        receipt = null;
      }

      return {
        contents: [
          {
            uri: `aether://validation/${boundTaskId}/last`,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                task_id: boundTaskId,
                receipt,
                validation_attempts: task.validation_attempts,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  for (const entry of Object.values(CONTEXT_CATALOG)) {
    server.registerResource(
      `context-${entry.ref.replace(/[^a-zA-Z0-9-]/g, "-")}`,
      `aether://context/${entry.ref}`,
      {
        title: entry.title,
        description: `Resolved documents for ${entry.ref}`,
        mimeType: "text/markdown",
      },
      async () => {
        const task = await queue.get(boundTaskId);
        if (!task.context_refs.includes(entry.ref)) {
          throw new Error(`Context ref ${entry.ref} is not in scope for task ${boundTaskId}`);
        }

        const bundle = await context.resolve([entry.ref]);
        const text = bundle.documents
          .map((document) => `# ${document.path}\n\n${document.content}`)
          .join("\n\n---\n\n");

        return {
          contents: [
            {
              uri: `aether://context/${entry.ref}`,
              mimeType: "text/markdown",
              text,
            },
          ],
        };
      },
    );
  }

  if (janusRoot) {
    const { config } = await loadJanusConfig(janusRoot);
    registerJanusMcpResources(server, {
      janusRoot,
      config,
      boundTaskId,
    });
  }

  server.registerTool(
    "resolve-task-context",
    {
      description: "Resolve all context_refs for the bound task into markdown documents",
      inputSchema: {
        task_id: z.string().optional(),
      },
    },
    async ({ task_id }) => {
      if (task_id && task_id !== boundTaskId) {
        return {
          content: [
            {
              type: "text",
              text: `Task scope violation: server is bound to ${boundTaskId}`,
            },
          ],
          isError: true,
        };
      }

      const task = await queue.get(boundTaskId);
      const bundle = await context.resolve(task.context_refs);
      const text = bundle.documents
        .map((document) => `# ${document.path}\n\n${document.content}`)
        .join("\n\n---\n\n");

      return {
        content: [{ type: "text", text }],
      };
    },
  );

  return server;
}

export async function startAetherMcpServer(options: AetherMcpOptions): Promise<void> {
  const server = await createAetherMcpServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export async function findRepoRootFromCwd(startDir: string): Promise<string> {
  const { runGit } = await import("@aether/worktree-manager");
  const result = await runGit(startDir, ["rev-parse", "--show-toplevel"]);
  if (result.exitCode !== 0) {
    throw new Error("AETHER_REPO_ROOT is unset and cwd is not inside a git repository");
  }
  return result.stdout.trim();
}

export function resolveRepoRoot(): string {
  if (process.env["AETHER_REPO_ROOT"]) {
    return process.env["AETHER_REPO_ROOT"];
  }
  throw new Error("AETHER_REPO_ROOT must be set before starting the MCP server");
}

export function resolveBoundTaskId(): string {
  const taskId = process.env["AETHER_TASK_ID"];
  if (!taskId) {
    throw new Error("AETHER_TASK_ID must be set before starting the MCP server");
  }
  return taskId;
}