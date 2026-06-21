import { describe, expect, it } from "vitest";
import { applyClaudeAutoFixes } from "./claude-auto-fix.js";

describe("applyClaudeAutoFixes", () => {
  it("removes placeholder markers for CLAUDE001", () => {
    const fixed = applyClaudeAutoFixes("const x = 'TODO';\n", [
      { layer: "rules", rule: "CLAUDE001", message: "placeholder" },
    ]);
    expect(fixed).not.toContain("TODO");
  });

  it("removes suppression directives for CLAUDE002", () => {
    const fixed = applyClaudeAutoFixes("// @ts-ignore\nconst x = 1;\n", [
      { layer: "rules", rule: "CLAUDE002", message: "suppression" },
    ]);
    expect(fixed).not.toContain("@ts-ignore");
  });

  it("replaces hardcoded secrets for CLAUDE003", () => {
    const fixed = applyClaudeAutoFixes('const api_key = "super-secret-key";\n', [
      { layer: "rules", rule: "CLAUDE003", message: "secret" },
    ]);
    expect(fixed).toContain("process.env.SECRET_VALUE");
    expect(fixed).not.toContain("super-secret-key");
  });

  it("removes dynamic execution for CLAUDE004", () => {
    const fixed = applyClaudeAutoFixes('eval("1+1");\n', [
      { layer: "rules", rule: "CLAUDE004", message: "eval" },
    ]);
    expect(fixed).not.toContain('eval("1+1")');
  });

  it("returns source unchanged when no matching rules", () => {
    const source = "const x = 1;\n";
    expect(applyClaudeAutoFixes(source, [])).toBe(source);
  });
});