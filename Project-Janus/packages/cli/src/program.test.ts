import { describe, expect, it } from "vitest";
import { getCliName } from "./argv.js";
import { buildProgram } from "./program.js";

describe("buildProgram cli name", () => {
  it("uses janus program name when getCliName detects janus invocation", () => {
    const argv = ["node.exe", "C:\\Users\\me\\janus.cmd", "status"];
    const program = buildProgram(getCliName(argv));
    expect(program.name()).toBe("janus");
  });

  it("uses aether program name when getCliName detects aether invocation", () => {
    const argv = ["node", "bin.js", "task", "list"];
    const program = buildProgram(getCliName(argv));
    expect(program.name()).toBe("aether");
  });

  it("defaults to aether when buildProgram is called without cliName", () => {
    expect(buildProgram().name()).toBe("aether");
  });
});