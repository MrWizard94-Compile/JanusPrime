import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyPatch, revertWorkspace } from "./patch.js";

let dir: string;

function git(args: string[]): void {
  execFileSync("git", args, { cwd: dir, stdio: "pipe" });
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(join(dir, path));
    return true;
  } catch {
    return false;
  }
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "aether-patch-test-"));
  git(["init"]);
  git(["config", "user.email", "test@example.com"]);
  git(["config", "user.name", "Test"]);
  git(["config", "core.autocrlf", "false"]);
  await writeFile(join(dir, "Old.java"), "class Old {}\n");
  git(["add", "."]);
  git(["commit", "-m", "seed"]);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("applyPatch / revertWorkspace deletions", () => {
  it("deletes a tracked file and revert restores its original content", async () => {
    const proposal = { task_id: "t", files: [], deleted_paths: ["Old.java"] };

    const snapshot = await applyPatch(dir, proposal);
    expect(await fileExists("Old.java")).toBe(false);

    await revertWorkspace(dir, snapshot);
    expect(await fileExists("Old.java")).toBe(true);
    expect(await readFile(join(dir, "Old.java"), "utf8")).toBe("class Old {}\n");
  });

  it("applies a write and a deletion together, then reverts both", async () => {
    const proposal = {
      task_id: "t",
      files: [{ path: "New.java", content: "class New {}\n" }],
      deleted_paths: ["Old.java"],
    };

    const snapshot = await applyPatch(dir, proposal);
    expect(await fileExists("Old.java")).toBe(false);
    expect(await fileExists("New.java")).toBe(true);

    await revertWorkspace(dir, snapshot);
    expect(await fileExists("Old.java")).toBe(true); // deletion undone
    expect(await fileExists("New.java")).toBe(false); // untracked write cleaned
  });

  it("preserves uncommitted modifications when a patch is validated over a dirty tree", async () => {
    // Identity-validation regression: a patch whose files mirror pre-existing
    // uncommitted edits must revert to those edits, not to HEAD.
    await writeFile(join(dir, "Old.java"), "class Old { int dirty; }\n");
    const proposal = {
      task_id: "t",
      files: [{ path: "Old.java", content: "class Old { int dirty; }\n" }],
    };

    const snapshot = await applyPatch(dir, proposal);
    await revertWorkspace(dir, snapshot);

    expect(await readFile(join(dir, "Old.java"), "utf8")).toBe(
      "class Old { int dirty; }\n",
    );
  });

  it("preserves untracked files a patch rewrites in place", async () => {
    // The data-loss case: an untracked file present before apply must survive
    // revert (previously `git clean` destroyed it permanently).
    await writeFile(join(dir, "pack.mcmeta"), "ORIGINAL\n");
    const proposal = {
      task_id: "t",
      files: [{ path: "pack.mcmeta", content: "ORIGINAL\n" }],
    };

    const snapshot = await applyPatch(dir, proposal);
    await revertWorkspace(dir, snapshot);

    expect(await fileExists("pack.mcmeta")).toBe(true);
    expect(await readFile(join(dir, "pack.mcmeta"), "utf8")).toBe("ORIGINAL\n");
  });
});
