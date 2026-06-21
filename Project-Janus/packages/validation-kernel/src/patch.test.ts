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

    await applyPatch(dir, proposal);
    expect(await fileExists("Old.java")).toBe(false);

    await revertWorkspace(dir, proposal);
    expect(await fileExists("Old.java")).toBe(true);
    expect(await readFile(join(dir, "Old.java"), "utf8")).toBe("class Old {}\n");
  });

  it("applies a write and a deletion together, then reverts both", async () => {
    const proposal = {
      task_id: "t",
      files: [{ path: "New.java", content: "class New {}\n" }],
      deleted_paths: ["Old.java"],
    };

    await applyPatch(dir, proposal);
    expect(await fileExists("Old.java")).toBe(false);
    expect(await fileExists("New.java")).toBe(true);

    await revertWorkspace(dir, proposal);
    expect(await fileExists("Old.java")).toBe(true); // deletion undone
    expect(await fileExists("New.java")).toBe(false); // untracked write cleaned
  });
});
