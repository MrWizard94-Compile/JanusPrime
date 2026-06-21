import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { PatchProposal } from "@aether/shared";
import { assertGitSuccess, runGit } from "@aether/worktree-manager";

export async function applyPatch(
  workspaceRoot: string,
  proposal: PatchProposal,
): Promise<void> {
  for (const relativePath of proposal.deleted_paths ?? []) {
    const targetPath = join(workspaceRoot, relativePath);
    await rm(targetPath, { force: true });
    await runGit(workspaceRoot, ["rm", "-f", "--", relativePath]);
  }

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
  const paths = [
    ...(proposal?.files.map((file) => file.path) ?? []),
    ...(proposal?.deleted_paths ?? []),
  ];

  if (paths.length === 0) {
    return;
  }

  // Restore tracked content (modified files + deletions) from HEAD. Run per
  // path: a single batched `git restore` aborts wholesale when any pathspec is
  // an untracked new file, which would leave a staged deletion un-reverted (the
  // mixed write+delete case). A per-path restore that fails for an untracked
  // path is harmless — `git clean` removes it below.
  for (const path of paths) {
    await runGit(workspaceRoot, ["restore", "--staged", "--worktree", "--", path]);
  }

  // Remove any untracked files the patch introduced.
  const clean = await runGit(workspaceRoot, ["clean", "-fd", "--", ...paths]);
  assertGitSuccess(clean, "clean patched paths");
}