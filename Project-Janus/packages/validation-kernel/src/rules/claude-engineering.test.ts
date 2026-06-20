import { describe, expect, it } from "vitest";
import { runClaudeEngineeringRules } from "./claude-engineering.js";

describe("runClaudeEngineeringRules", () => {
  it("rejects TODO markers (CLAUDE001)", () => {
    const errors = runClaudeEngineeringRules({
      files: [{ path: "src/a.ts", content: "// TODO fix later\n" }],
    });
    expect(errors.some((error) => error.rule === "CLAUDE001")).toBe(true);
  });

  it("rejects suppressions (CLAUDE002)", () => {
    const errors = runClaudeEngineeringRules({
      files: [{ path: "src/a.ts", content: "// @ts-ignore\n" }],
    });
    expect(errors.some((error) => error.rule === "CLAUDE002")).toBe(true);
  });

  it("rejects hardcoded secrets (CLAUDE003)", () => {
    const errors = runClaudeEngineeringRules({
      files: [
        {
          path: "src/a.ts",
          content: 'const api_key = "super-secret-key";\n',
        },
      ],
    });
    expect(errors.some((error) => error.rule === "CLAUDE003")).toBe(true);
  });

  it("allows env-backed secrets (CLAUDE003 negative)", () => {
    const errors = runClaudeEngineeringRules({
      files: [
        {
          path: "src/a.ts",
          content: 'const api_key = process.env.API_KEY ?? "";\n',
        },
      ],
    });
    expect(errors.some((error) => error.rule === "CLAUDE003")).toBe(false);
  });

  it("rejects dynamic code execution (CLAUDE004)", () => {
    const errors = runClaudeEngineeringRules({
      files: [{ path: "src/a.ts", content: 'eval("1+1");\n' }],
    });
    expect(errors.some((error) => error.rule === "CLAUDE004")).toBe(true);
  });

  it("rejects child_process usage (CLAUDE004)", () => {
    const errors = runClaudeEngineeringRules({
      files: [
        {
          path: "src/a.ts",
          content: 'import { exec } from "child_process";\n',
        },
      ],
    });
    expect(errors.some((error) => error.rule === "CLAUDE004")).toBe(true);
  });
});