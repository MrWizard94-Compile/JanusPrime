import { describe, expect, it } from "vitest";
import {
  SOUL_CONTEXT_REF,
  ensureSoulContextRef,
} from "./context-catalog.js";

describe("ensureSoulContextRef", () => {
  it("prepends doc:soul when refs are empty", () => {
    expect(ensureSoulContextRef([])).toEqual([SOUL_CONTEXT_REF]);
  });

  it("prepends doc:soul when other refs exist but soul is absent", () => {
    expect(ensureSoulContextRef(["doc:handoff-protocol", "ref:neoforged"])).toEqual([
      SOUL_CONTEXT_REF,
      "doc:handoff-protocol",
      "ref:neoforged",
    ]);
  });

  it("preserves order unchanged when doc:soul is already present", () => {
    const refs = ["doc:handoff-protocol", SOUL_CONTEXT_REF, "ref:neoforged"];
    expect(ensureSoulContextRef(refs)).toEqual(refs);
  });

  it("preserves multiple refs including doc:soul at the front", () => {
    const refs = [SOUL_CONTEXT_REF, "doc:handoff-protocol", "ref:neoforged"];
    expect(ensureSoulContextRef(refs)).toEqual(refs);
  });
});