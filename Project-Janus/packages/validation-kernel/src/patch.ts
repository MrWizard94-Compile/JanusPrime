import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { PatchProposal } from "@aether/shared";
import { assertGitSuccess, runGit } from "@aether/worktree-manager";

export async function applyPatch(
  workspaceRoot: string,
  proposal: PatchProposal,
): Promise<void> {
  for (const file of proposal.files) {
    const targetPath = join(workspaceRoot, file.path);
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, file.content, "utf8");
  }
}

/** Revert only paths touched by a patch — never `git clean` the whole worktree. */
export async function revertWorkspace(
  workspaceRoot: string,
  proposal?: PatchProposal,
): Promise<void> {
  const paths = proposal?.files.map((file) => file.path) ?? [];

  if (paths.length === 0) {
    return;
  }

  const restore = await runGit(workspaceRoot, [
    "restore",
    "--staged",
    "--worktree",
    "--",
    ...paths,
  ]);
  if (restore.exitCode !== 0) {
    // Untracked paths are not restorable; clean only those patch paths.
    const clean = await runGit(workspaceRoot, ["clean", "-fd", "--", ...paths]);
    assertGitSuccess(clean, "clean patched paths");
    return;
  }

  const clean = await runGit(workspaceRoot, ["clean", "-fd", "--", ...paths]);
  if (clean.exitCode !== 0) {
    assertGitSuccess(clean, "clean patched paths");
  }
}