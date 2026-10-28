import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { PatchProposal } from "@aether/shared";
import { runGit } from "@aether/worktree-manager";

/** Captured prior state of a single path touched by a patch. */
export interface PathSnapshot {
  path: string;
  /** Raw bytes before the patch was applied, or null if the path did not exist. */
  content: Buffer | null;
}

/** Ordered snapshot of every path a patch touches, taken before mutation. */
export type WorkspaceSnapshot = PathSnapshot[];

async function readIfExists(absolutePath: string): Promise<Buffer | null> {
  try {
    return await readFile(absolutePath);
  } catch {
    return null;
  }
}

/**
 * Apply a patch to the workspace, returning a snapshot of the prior state of
 * every touched path. The snapshot is the contract that lets {@link revertWorkspace}
 * restore the workspace to *exactly* what it was — uncommitted modifications and
 * untracked files included — instead of resetting to HEAD (which destroys real
 * work when a patch is validated over a dirty tree, e.g. identity validation).
 */
export async function applyPatch(
  workspaceRoot: string,
  proposal: PatchProposal,
): Promise<WorkspaceSnapshot> {
  const snapshot: WorkspaceSnapshot = [];
  const seen = new Set<string>();

  const touched = [
    ...(proposal.deleted_paths ?? []),
    ...proposal.files.map((file) => file.path),
  ];
  for (const relativePath of touched) {
    if (seen.has(relativePath)) {
      continue;
    }
    seen.add(relativePath);
    snapshot.push({
      path: relativePath,
      content: await readIfExists(join(workspaceRoot, relativePath)),
    });
  }

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

  return snapshot;
}

/**
 * Restore the workspace to the exact pre-apply state captured in `snapshot`.
 *
 * Each path is rewritten with its prior bytes, or removed if it did not exist
 * before. The git index is then unstaged for the touched paths to undo the
 * staged deletions {@link applyPatch} created for `deleted_paths`; the working
 * tree content we just wrote is authoritative. This never reverts unrelated
 * paths and never `git clean`s the worktree.
 */
export async function revertWorkspace(
  workspaceRoot: string,
  snapshot?: WorkspaceSnapshot,
): Promise<void> {
  if (!snapshot || snapshot.length === 0) {
    return;
  }

  for (const entry of snapshot) {
    const targetPath = join(workspaceRoot, entry.path);
    if (entry.content === null) {
      await rm(targetPath, { force: true });
    } else {
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, entry.content);
    }
  }

  // Undo index staging from applyPatch (the `git rm` of deleted_paths). A mixed
  // reset restores the index entry for these paths to HEAD without touching the
  // working tree we just rewrote. Untracked paths are simply ignored.
  await runGit(workspaceRoot, ["reset", "-q", "--", ...snapshot.map((entry) => entry.path)]);
}
