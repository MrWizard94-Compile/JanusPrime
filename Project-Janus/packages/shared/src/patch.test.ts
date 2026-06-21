import { describe, expect, it } from "vitest";
import { PatchProposalSchema, hashPatch } from "./patch.js";

describe("PatchProposalSchema deleted_paths", () => {
  it("accepts a deletion-only proposal (files defaults to [])", () => {
    const parsed = PatchProposalSchema.parse({
      task_id: "t1",
      deleted_paths: ["src/Old.java"],
    });
    expect(parsed.files).toEqual([]);
    expect(parsed.deleted_paths).toEqual(["src/Old.java"]);
  });

  it("accepts a write-only proposal (no deleted_paths)", () => {
    const parsed = PatchProposalSchema.parse({
      task_id: "t1",
      files: [{ path: "src/New.java", content: "class New {}" }],
    });
    expect(parsed.deleted_paths).toBeUndefined();
  });

  it("rejects a proposal with neither a file change nor a deletion", () => {
    const result = PatchProposalSchema.safeParse({ task_id: "t1", files: [] });
    expect(result.success).toBe(false);
  });

  it("rejects an empty deleted path string", () => {
    const result = PatchProposalSchema.safeParse({
      task_id: "t1",
      deleted_paths: [""],
    });
    expect(result.success).toBe(false);
  });
});

describe("hashPatch with deletions", () => {
  it("is stable regardless of deleted_paths order", () => {
    const a = hashPatch({
      task_id: "t1",
      files: [],
      deleted_paths: ["b.java", "a.java"],
    });
    const b = hashPatch({
      task_id: "t1",
      files: [],
      deleted_paths: ["a.java", "b.java"],
    });
    expect(a).toBe(b);
  });

  it("differs when a deletion is added", () => {
    const base = hashPatch({
      task_id: "t1",
      files: [{ path: "a.java", content: "x" }],
    });
    const withDeletion = hashPatch({
      task_id: "t1",
      files: [{ path: "a.java", content: "x" }],
      deleted_paths: ["b.java"],
    });
    expect(base).not.toBe(withDeletion);
  });
});
