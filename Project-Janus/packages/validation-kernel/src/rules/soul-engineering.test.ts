import { describe, expect, it } from "vitest";
import { runSoulEngineeringRules } from "./soul-engineering.js";

describe("soul engineering rules", () => {
  it("rejects TODO markers (SOUL001)", () => {
    const errors = runSoulEngineeringRules({
      task_id: "t1",
      files: [{ path: "src/a.ts", content: "// TODO: fix later\nconst x = 1;" }],
    });
    expect(errors.some((error) => error.rule === "SOUL001")).toBe(true);
  });

  it("rejects suppressions (SOUL002)", () => {
    const errors = runSoulEngineeringRules({
      task_id: "t1",
      files: [{ path: "src/a.ts", content: "// @ts-ignore\nconst x: any = 1;" }],
    });
    expect(errors.some((error) => error.rule === "SOUL002")).toBe(true);
  });

  it("rejects hardcoded secrets (SOUL003)", () => {
    const errors = runSoulEngineeringRules({
      task_id: "t1",
      files: [
        {
          path: "src/config.ts",
          content: 'const api_key = "sk-live-abc123def456";\nexport { api_key };',
        },
      ],
    });
    expect(errors.some((error) => error.rule === "SOUL003")).toBe(true);
  });

  it("allows env-backed secrets (SOUL003 negative)", () => {
    const errors = runSoulEngineeringRules({
      task_id: "t1",
      files: [
        {
          path: "src/config.ts",
          content: "const token = process.env.API_TOKEN;\nexport { token };",
        },
      ],
    });
    expect(errors.some((error) => error.rule === "SOUL003")).toBe(false);
  });

  it("rejects dynamic code execution (SOUL004)", () => {
    const errors = runSoulEngineeringRules({
      task_id: "t1",
      files: [{ path: "src/run.ts", content: 'const fn = eval("1 + 1");' }],
    });
    expect(errors.some((error) => error.rule === "SOUL004")).toBe(true);
  });

  it("rejects child_process usage (SOUL004)", () => {
    const errors = runSoulEngineeringRules({
      task_id: "t1",
      files: [
        {
          path: "src/spawn.ts",
          content: 'import { exec } from "child_process";\nexec("ls");',
        },
      ],
    });
    expect(errors.some((error) => error.rule === "SOUL004")).toBe(true);
  });
});