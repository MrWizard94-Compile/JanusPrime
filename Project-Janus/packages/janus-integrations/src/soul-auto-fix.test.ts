import { describe, expect, it } from "vitest";
import { applySoulAutoFixes } from "./soul-auto-fix.js";

describe("applySoulAutoFixes", () => {
  it("removes placeholder markers for SOUL001", () => {
    const fixed = applySoulAutoFixes("const x = 'TODO';\n", [
      { layer: "rules", rule: "SOUL001", message: "placeholder" },
    ]);
    expect(fixed).not.toMatch(/\bTODO\b/i);
  });

  it("removes suppression directives for SOUL002", () => {
    const fixed = applySoulAutoFixes("// @ts-ignore\nconst x = 1;\n", [
      { layer: "rules", rule: "SOUL002", message: "suppression" },
    ]);
    expect(fixed).not.toContain("@ts-ignore");
  });

  it("replaces hardcoded secrets for SOUL003", () => {
    const fixed = applySoulAutoFixes('const api_key = "super-secret-key";\n', [
      { layer: "rules", rule: "SOUL003", message: "secret" },
    ]);
    expect(fixed).toContain("process.env.SECRET_VALUE");
    expect(fixed).not.toContain("super-secret-key");
  });

  it("removes dynamic execution for SOUL004", () => {
    const fixed = applySoulAutoFixes('eval("1+1");\n', [
      { layer: "rules", rule: "SOUL004", message: "eval" },
    ]);
    expect(fixed).not.toContain("eval(");
  });

  it("returns unchanged content when no matching rules", () => {
    const source = "const ok = 1;\n";
    expect(applySoulAutoFixes(source, [])).toBe(source);
  });
});