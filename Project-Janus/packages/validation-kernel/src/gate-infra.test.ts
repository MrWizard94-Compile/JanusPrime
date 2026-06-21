import { describe, expect, it } from "vitest";
import {
  GATE_INFRA_SIGNATURES,
  classifyText,
  classifyError,
  diagnoseResult,
  isHarnessInfraFailure,
} from "./gate-infra.js";
import type { ValidationResult } from "./types.js";

function failingResult(
  errors: ValidationResult["errors"],
  passed = false,
): ValidationResult {
  return {
    passed,
    profile_id: "typescript-v1",
    workspace_root: "/ws",
    layers: [{ layer: "build", ran: true, passed, errors, duration_ms: 1 }],
    errors,
  };
}

describe("classifyText", () => {
  it("matches GATE-1 missing build script", () => {
    const d = classifyText('npm error Missing script: "typecheck"');
    expect(d?.signature_id).toBe("GATE-1");
    expect(d?.phase).toBe("build");
    expect(d?.fix).toMatch(/workspace-root package.json/);
  });

  it("matches GATE-2 nested workspace / missing deps", () => {
    expect(classifyText("Cannot find module '@aether/shared'")?.signature_id).toBe("GATE-2");
    expect(classifyText("ERR_MODULE_NOT_FOUND")?.signature_id).toBe("GATE-2");
  });

  it("matches GATE-3 stale worktree on provision", () => {
    const d = classifyText("fatal: 'wt/task-1' already exists");
    expect(d?.signature_id).toBe("GATE-3");
    expect(d?.phase).toBe("provision");
  });

  it("matches GATE-4 windows worktree remove failure", () => {
    const d = classifyText("error: failed to delete '.../worktrees/x': Directory not empty");
    expect(d?.signature_id).toBe("GATE-4");
    expect(d?.phase).toBe("provision");
  });

  it("matches GATE-5 gradlew not recognized on win32", () => {
    const d = classifyText("'gradlew.bat' is not recognized as an internal or external command");
    expect(d?.signature_id).toBe("GATE-5");
  });

  it("matches GATE-7 tar drive-letter as remote host", () => {
    const d = classifyText("tar: Cannot connect to C: resolve failed");
    expect(d?.signature_id).toBe("GATE-7");
    expect(d?.phase).toBe("setup");
  });

  it("falls back to GATE-GENERIC for unrecognised exec failures", () => {
    expect(classifyText("spawn foo ENOENT")?.signature_id).toBe("GATE-GENERIC");
    expect(classifyText("bash: bar: command not found")?.signature_id).toBe("GATE-GENERIC");
  });

  it("returns null for genuine executor-output failures", () => {
    expect(classifyText("Type 'string' is not assignable to type 'number'.")).toBeNull();
    expect(classifyText("")).toBeNull();
  });
});

describe("classifyError", () => {
  it("checks the suggestion field when the message does not match", () => {
    const d = classifyError({
      layer: "build",
      message: "build failed",
      suggestion: "'gradlew.bat' is not recognized as an internal or external command",
    });
    expect(d?.signature_id).toBe("GATE-5");
  });
});

describe("diagnoseResult", () => {
  it("returns empty for a passing result", () => {
    expect(diagnoseResult(failingResult([], true))).toEqual([]);
  });

  it("dedupes by signature id", () => {
    const result = failingResult([
      { layer: "build", message: "Cannot find module 'a'" },
      { layer: "build", message: "Cannot find module 'b'" },
    ]);
    const diag = diagnoseResult(result);
    expect(diag).toHaveLength(1);
    expect(diag[0]?.signature_id).toBe("GATE-2");
  });

  it("surfaces multiple distinct signatures", () => {
    const result = failingResult([
      { layer: "build", message: 'Missing script: "lint"' },
      { layer: "build", message: "tar: Cannot connect to C: resolve failed" },
    ]);
    const ids = diagnoseResult(result).map((d) => d.signature_id).sort();
    expect(ids).toEqual(["GATE-1", "GATE-7"]);
  });
});

describe("isHarnessInfraFailure", () => {
  it("is true when an infra signature matches a failing result", () => {
    expect(
      isHarnessInfraFailure(failingResult([{ layer: "build", message: "ERR_MODULE_NOT_FOUND" }])),
    ).toBe(true);
  });

  it("is false for genuine executor failures", () => {
    expect(
      isHarnessInfraFailure(
        failingResult([{ layer: "ast", message: "Unexpected token at line 4" }]),
      ),
    ).toBe(false);
  });

  it("is false for a passing result regardless of content", () => {
    expect(isHarnessInfraFailure(failingResult([], true))).toBe(false);
  });
});

describe("GATE_INFRA_SIGNATURES corpus", () => {
  it("has unique ids and well-formed entries (seed corpus integrity)", () => {
    const ids = GATE_INFRA_SIGNATURES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const sig of GATE_INFRA_SIGNATURES) {
      expect(sig.pattern).toBeInstanceOf(RegExp);
      expect(sig.summary.length).toBeGreaterThan(0);
      expect(sig.fix.length).toBeGreaterThan(0);
    }
  });
});
