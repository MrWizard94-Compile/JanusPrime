import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expandConfigPath, findJanusRoot, loadEnvFile, loadJanusConfig } from "./config.js";

const projectJanusRoot = join(import.meta.dirname, "../../..");
const janusRoot = join(import.meta.dirname, "../../../..");

describe("janus config", () => {
  it("finds janus.config.json from Project-Janus subdirectory", async () => {
    const root = await findJanusRoot(join(projectJanusRoot, "packages/janus-integrations"));
    expect(root).toContain("Janus");
  });

  it("loads and parses config", async () => {
    const { config } = await loadJanusConfig(projectJanusRoot);
    expect(config.name).toBe("janusprime");
    expect(config.components.memory.url).toBe("http://localhost:8000");
    expect(config.components.assets.root).toBe("../../../../../Projects/AssetConverter");
    expect(config.doctrine.claude_path).toBe("CLAUDE.md");
    expect(config.doctrine.inject_into_brief).toBe(true);
    expect(config.components.cognition?.root).toBe("env:REL_COGNITION_ROOT");
  });
});

describe("loadEnvFile", () => {
  let tempRoot = "";

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
      tempRoot = "";
    }
  });

  it("loads unset vars from .env without overriding existing", async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "janus-env-"));
    await writeFile(
      join(tempRoot, ".env"),
      "JANUS_TEST_ENV_VAR=from-file\n# comment\nEXISTING=from-dotenv\n",
      "utf8",
    );
    vi.stubEnv("EXISTING", "already-set");
    delete process.env["JANUS_TEST_ENV_VAR"];

    await loadEnvFile(tempRoot);

    expect(process.env["JANUS_TEST_ENV_VAR"]).toBe("from-file");
    expect(process.env["EXISTING"]).toBe("already-set");
  });
});

describe("expandConfigPath", () => {
  const janusRoot = "C:\\Users\\me\\Janus";

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolves relative paths against janus root", () => {
    expect(expandConfigPath(janusRoot, "Project-Janus")).toBe(
      "C:\\Users\\me\\Janus\\Project-Janus",
    );
  });

  it("expands env: prefix from process.env", () => {
    vi.stubEnv("REL_COGNITION_ROOT", "C:/REL_Codex_Variant");
    expect(expandConfigPath(janusRoot, "env:REL_COGNITION_ROOT")).toBe(
      "C:\\REL_Codex_Variant",
    );
  });

  it("falls back to REL_BUILD_CONTEXT when REL_COGNITION_ROOT is unset", () => {
    delete process.env.REL_COGNITION_ROOT;
    vi.stubEnv("REL_BUILD_CONTEXT", "D:/REL");
    expect(expandConfigPath(janusRoot, "env:REL_COGNITION_ROOT")).toBe("D:\\REL");
  });

  it("throws when env: variable is unset", () => {
    delete process.env.REL_COGNITION_ROOT;
    delete process.env.REL_BUILD_CONTEXT;
    expect(() => expandConfigPath(janusRoot, "env:REL_COGNITION_ROOT")).toThrow(
      "Environment variable REL_COGNITION_ROOT is not set",
    );
  });

  it("throws when env: variable is empty", () => {
    vi.stubEnv("REL_COGNITION_ROOT", "");
    expect(() => expandConfigPath(janusRoot, "env:REL_COGNITION_ROOT")).toThrow(
      "Environment variable REL_COGNITION_ROOT is not set",
    );
  });
});