import { describe, expect, it } from "vitest";
import { VALIDATION_PROFILES } from "@aether/shared";
import { runRulesLayer } from "./rules.js";

describe("runRulesLayer", () => {
  it("fires CLAUDE003 on typescript-v1 profile when patch has hardcoded secret", () => {
    const filePath = "src/config.ts";
    const result = runRulesLayer(VALIDATION_PROFILES["typescript-v1"], {
      proposal: {
        task_id: "task-typescript-secret",
        files: [
          {
            path: filePath,
            content: 'const api_key = "sk-live-abc123def456";\nexport { api_key };',
          },
        ],
      },
      spec: {
        objective: "configure API client",
        constraints: [],
        files_in_scope: [filePath],
        acceptance_criteria: [],
      },
    });

    expect(result.ran).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.errors.some((error) => error.rule === "CLAUDE003")).toBe(true);
  });
});