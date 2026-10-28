import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { CommsService } from "./comms-service.js";

describe("CommsService", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  async function createService(): Promise<{ service: CommsService; root: string }> {
    const root = await mkdtemp(join(tmpdir(), "janus-comms-"));
    roots.push(root);
    return { service: new CommsService(root), root };
  }

  it("appends messages to jsonl and mirrors markdown", async () => {
    const { service, root } = await createService();

    const posted = await service.post({
      author: "Grok",
      recipient: "Claude",
      task_id: "task-test-1",
      status: "INFO",
      body: "Round-trip probe",
    });

    const jsonl = await readFile(join(root, ".aether", "comms.jsonl"), "utf8");
    expect(jsonl.trim()).toContain("Round-trip probe");
    expect(jsonl.trim()).toContain("task-test-1");

    const markdown = await readFile(join(root, "COMMS-CLAUDE-GROK.md"), "utf8");
    expect(markdown).toContain("Grok → Claude");
    expect(markdown).toContain("[INFO]");
    expect(markdown).toContain("Round-trip probe");

    const readBack = await service.read({ task_id: "task-test-1" });
    expect(readBack.messages).toHaveLength(1);
    expect(readBack.messages[0]?.body).toBe("Round-trip probe");
    expect(readBack.messages[0]?.ts).toBe(posted.message.ts);
  });

  it("filters by since timestamp", async () => {
    const { service } = await createService();

    await service.post({
      author: "Claude",
      recipient: "Grok",
      status: "HANDOFF",
      body: "Earlier",
    });

    const firstRead = await service.read();
    const firstTs = firstRead.messages[0]?.ts;
    expect(firstTs).toBeTruthy();

    await new Promise((resolve) => setTimeout(resolve, 5));

    await service.post({
      author: "Grok",
      recipient: "Claude",
      status: "DONE",
      body: "Later",
    });

    const filtered = await service.read({ since: firstTs });
    expect(filtered.messages.length).toBeGreaterThanOrEqual(1);
    expect(filtered.messages.every((msg) => msg.ts >= firstTs!)).toBe(true);
    expect(filtered.messages.some((msg) => msg.body === "Later")).toBe(true);
  });

  it("returns empty list when store is missing", async () => {
    const { service } = await createService();
    const result = await service.read();
    expect(result.messages).toEqual([]);
    expect(result.skipped_invalid_lines).toBe(0);
  });

  it("skips invalid jsonl lines", async () => {
    const { service, root } = await createService();
    await service.post({
      author: "Grok",
      recipient: "Claude",
      status: "INFO",
      body: "Valid line",
    });

    const jsonlPath = join(root, ".aether", "comms.jsonl");
    const { appendFile } = await import("node:fs/promises");
    await appendFile(jsonlPath, "not-json\n", "utf8");

    const result = await service.read();
    expect(result.messages).toHaveLength(1);
    expect(result.skipped_invalid_lines).toBe(1);
  });
});
