import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadJanusConfig } from "@janus/integrations";
import { registerJanusMcpResources, resolveJanusRoot } from "./janus-resources.js";

const projectJanusRoot = join(import.meta.dirname, "../../..");

describe("resolveJanusRoot", () => {
  it("finds janus config when cwd is Project-Janus", async () => {
    const root = await resolveJanusRoot(projectJanusRoot);
    expect(root).toBeTruthy();
    expect(root).toContain("Janus");
    expect(root).not.toContain("Project-Janus");
  });

  it("returns null when no janus.config.json exists in ancestor chain", async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), "janus-mcp-no-config-"));
    const root = await resolveJanusRoot(emptyDir);
    expect(root).toBeNull();
  });
});

describe("registerJanusMcpResources", () => {
  const registerResource = vi.fn();
  const registerTool = vi.fn();
  let server: McpServer;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers Janus MCP resources and tools without throwing", async () => {
    const { root, config } = await loadJanusConfig(projectJanusRoot);
    server = new McpServer({ name: "test-mcp", version: "0.0.0" });
    vi.spyOn(server, "registerResource").mockImplementation(registerResource);
    vi.spyOn(server, "registerTool").mockImplementation(registerTool);

    expect(() =>
      registerJanusMcpResources(server, {
        janusRoot: root,
        config,
        boundTaskId: "task-test-1",
      }),
    ).not.toThrow();

    const expectedResources = config.components.cognition ? 7 : 6;
    expect(registerResource).toHaveBeenCalledTimes(expectedResources);
    expect(registerTool).toHaveBeenCalledTimes(2);

    const resourceNames = registerResource.mock.calls.map((call) => call[0]);
    expect(resourceNames).toContain("janus-doctrine-claude");
    expect(resourceNames).toContain("janus-task-brief");
    expect(resourceNames).toContain("janus-task-repair");
    if (config.components.cognition) {
      expect(resourceNames).toContain("janus-rel-state-summary");
    }
  });
});