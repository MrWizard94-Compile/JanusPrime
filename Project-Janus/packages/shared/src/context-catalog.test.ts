import { describe, expect, it } from "vitest";
import {
  CLAUDE_CONTEXT_REF,
  ensureClaudeContextRef,
} from "./context-catalog.js";

describe("ensureClaudeContextRef", () => {
  it("prepends doc:claude when refs are empty", () => {
    expect(ensureClaudeContextRef([])).toEqual([CLAUDE_CONTEXT_REF]);
  });

  it("prepends doc:claude when other refs exist but claude is absent", () => {
    expect(ensureClaudeContextRef(["doc:handoff-protocol", "ref:neoforged"])).toEqual([
      CLAUDE_CONTEXT_REF,
      "doc:handoff-protocol",
      "ref:neoforged",
    ]);
  });

  it("preserves order unchanged when doc:claude is already present", () => {
    const refs = ["doc:handoff-protocol", CLAUDE_CONTEXT_REF, "ref:neoforged"];
    expect(ensureClaudeContextRef(refs)).toEqual(refs);
  });

  it("preserves multiple refs including doc:claude at the front", () => {
    const refs = [CLAUDE_CONTEXT_REF, "doc:handoff-protocol", "ref:neoforged"];
    expect(ensureClaudeContextRef(refs)).toEqual(refs);
  });
});