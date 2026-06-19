import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  JanusUnifiedService,
  loadJanusConfig,
  loadSoul,
  MemoryClient,
  AssetRunner,
  type JanusConfig,
} from "@janus/integrations";

export interface JanusMcpContext {
  janusRoot: string;
  config: JanusConfig;
  boundTaskId: string;
}

export function registerJanusMcpResources(
  server: McpServer,
  context: JanusMcpContext,
): void {
  const unified = new JanusUnifiedService(context.janusRoot, context.config);
  const memory = new MemoryClient(context.config.components.memory);
  const assets = new AssetRunner(context.janusRoot, context.config);

  server.registerResource(
    "janus-doctrine-soul",
    "janus://doctrine/soul",
    {
      title: "SOUL.md — Janus single source of truth",
      description: "Operational doctrine, invariants, token policy, validation rules",
      mimeType: "text/markdown",
    },
    async () => {
      const soul = await loadSoul(context.janusRoot, context.config);
      return {
        contents: [
          {
            uri: "janus://doctrine/soul",
            mimeType: "text/markdown",
            text: soul,
          },
        ],
      };
    },
  );

  server.registerResource(
    "janus-system-status",
    "janus://system/status",
    {
      title: "Janus system status",
      description: "Unified health across orchestrator, memory, and asset engine",
      mimeType: "application/json",
    },
    async () => {
      const status = await unified.getSystemStatus();
      return {
        contents: [
          {
            uri: "janus://system/status",
            mimeType: "application/json",
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    "janus-memory-health",
    "janus://memory/health",
    {
      title: "Memory service health",
      description: "Smart-Library API and Ollama availability",
      mimeType: "application/json",
    },
    async () => {
      const health = await memory.health();
      return {
        contents: [
          {
            uri: "janus://memory/health",
            mimeType: "application/json",
            text: JSON.stringify(health, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    "janus-assets-queue",
    "janus://assets/queue",
    {
      title: "Asset processing queue",
      description: "Omni32 mod queue status from AssetConverter",
      mimeType: "text/plain",
    },
    async () => {
      const queue = await assets.queue();
      return {
        contents: [
          {
            uri: "janus://assets/queue",
            mimeType: "text/plain",
            text: queue.raw,
          },
        ],
      };
    },
  );

  server.registerResource(
    "janus-task-brief",
    `janus://task/${context.boundTaskId}/brief`,
    {
      title: "Token-efficient executor brief",
      description: "Unified brief with memory context slices for the bound task",
      mimeType: "application/json",
    },
    async () => {
      const brief = await unified.buildUnifiedBrief(context.boundTaskId);
      return {
        contents: [
          {
            uri: `janus://task/${context.boundTaskId}/brief`,
            mimeType: "application/json",
            text: JSON.stringify(brief, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    "janus-task-repair",
    `janus://task/${context.boundTaskId}/repair`,
    {
      title: "Repair context",
      description: "Validation errors plus memory-retrieved fix patterns",
      mimeType: "application/json",
    },
    async () => {
      const repair = await unified.buildRepairContext(context.boundTaskId);
      return {
        contents: [
          {
            uri: `janus://task/${context.boundTaskId}/repair`,
            mimeType: "application/json",
            text: JSON.stringify(repair, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "janus-memory-query",
    {
      description: "Semantic query against Smart-Library memory store",
      inputSchema: {
        query: z.string().min(1),
      },
    },
    async ({ query }) => {
      try {
        const result = await memory.query(query);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: message }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "janus-repair-context",
    {
      description: "Build repair context for the bound task from validation errors and memory",
      inputSchema: {
        task_id: z.string().optional(),
      },
    },
    async ({ task_id }) => {
      if (task_id && task_id !== context.boundTaskId) {
        return {
          content: [
            {
              type: "text",
              text: `Task scope violation: server is bound to ${context.boundTaskId}`,
            },
          ],
          isError: true,
        };
      }

      try {
        const repair = await unified.buildRepairContext(context.boundTaskId);
        return {
          content: [{ type: "text", text: JSON.stringify(repair, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: message }],
          isError: true,
        };
      }
    },
  );
}

export async function resolveJanusRoot(startDir: string): Promise<string | null> {
  try {
    const { root } = await loadJanusConfig(startDir);
    return root;
  } catch {
    return null;
  }
}