import { describe, expect, it } from "vitest";
import { getCliName, normalizeArgv } from "./argv.js";

describe("normalizeArgv", () => {
  it("prepends janus subcommand when invoked as janus binary", () => {
    const argv = ["/usr/bin/node", "/usr/local/bin/janus", "status"];
    expect(normalizeArgv(argv)).toEqual([
      "/usr/bin/node",
      "/usr/local/bin/janus",
      "janus",
      "status",
    ]);
  });

  it("prepends janus subcommand when invoked as janus.CMD on Windows", () => {
    const argv = ["C:\\Program Files\\nodejs\\node.exe", "C:\\Users\\me\\janus.CMD", "brief", "-t", "task-1"];
    expect(normalizeArgv(argv)).toEqual([
      "C:\\Program Files\\nodejs\\node.exe",
      "C:\\Users\\me\\janus.CMD",
      "janus",
      "brief",
      "-t",
      "task-1",
    ]);
  });

  it("prepends janus subcommand when invoked as janus.cmd on Windows", () => {
    const argv = ["C:\\Program Files\\nodejs\\node.exe", "C:\\Users\\me\\janus.cmd", "brief", "-t", "task-1"];
    expect(normalizeArgv(argv)).toEqual([
      "C:\\Program Files\\nodejs\\node.exe",
      "C:\\Users\\me\\janus.cmd",
      "janus",
      "brief",
      "-t",
      "task-1",
    ]);
  });

  it("leaves argv unchanged when invoked as aether", () => {
    const argv = ["/usr/bin/node", "/usr/local/bin/aether", "janus", "status"];
    expect(normalizeArgv(argv)).toEqual(argv);
  });

  it("leaves argv unchanged when invoked as aether.cmd on Windows", () => {
    const argv = ["node.exe", "aether.cmd", "task", "list"];
    expect(normalizeArgv(argv)).toEqual(argv);
  });

  it("prepends janus when first arg is a janus-only subcommand (bin.js dev path)", () => {
    const argv = ["node", "packages/cli/dist/bin.js", "status"];
    expect(normalizeArgv(argv)).toEqual(["node", "packages/cli/dist/bin.js", "janus", "status"]);
  });

  it("leaves aether top-level commands unchanged", () => {
    const argv = ["node", "bin.js", "task", "list"];
    expect(normalizeArgv(argv)).toEqual(argv);
  });
});

describe("getCliName", () => {
  it("returns janus when invoked as janus binary", () => {
    const argv = ["/usr/bin/node", "/usr/local/bin/janus", "status"];
    expect(getCliName(argv)).toBe("janus");
  });

  it("returns janus when invoked as janus.cmd on Windows", () => {
    const argv = ["node.exe", "C:\\Users\\me\\janus.cmd", "brief", "-t", "task-1"];
    expect(getCliName(argv)).toBe("janus");
  });

  it("returns janus when first arg is a janus-only subcommand", () => {
    const argv = ["node", "packages/cli/dist/bin.js", "status"];
    expect(getCliName(argv)).toBe("janus");
  });

  it("returns aether when invoked as aether", () => {
    const argv = ["/usr/bin/node", "/usr/local/bin/aether", "janus", "status"];
    expect(getCliName(argv)).toBe("aether");
  });

  it("returns aether for aether top-level commands", () => {
    const argv = ["node", "bin.js", "task", "list"];
    expect(getCliName(argv)).toBe("aether");
  });
});