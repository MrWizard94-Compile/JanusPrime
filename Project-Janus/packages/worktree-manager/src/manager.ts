import { access, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  formatBranchName,
  formatWorktreeName,
  resolveWorktreesDir,
} from "@aether/shared";
import { assertGitSuccess, runGit } from "./git.js";

export interface WorktreeEntry {
  name: string;
  path: string;
  branch: string;
  task_id: string;
}

export interface CreateWorktreeOptions {
  taskId: string;
  baseBranch?: string;
  sequence?: number;
  /**
   * Tear down any existing worktree/branch for this task and rebuild from
   * baseBranch. Without this, create() is idempotent and returns the existing
   * worktree as-is (which may be pinned to a stale base).
   */
  recreate?: boolean;
}

export class WorktreeManager {
  private readonly repoRoot: string;

  constructor(repoRoot: string) {
    this.repoRoot = repoRoot;
  }

  async list(): Promise<WorktreeEntry[]> {
    const result = await runGit(this.repoRoot, [
      "worktree",
      "list",
      "--porcelain",
    ]);
    assertGitSuccess(result, "worktree list");

    const entries: WorktreeEntry[] = [];
    let currentPath = "";
    let currentBranch = "";

    const flush = (): void => {
      if (!currentPath.includes(".worktrees")) {
        currentPath = "";
        currentBranch = "";
        return;
      }

      const name = currentPath.split(/[\\/]/).pop() ?? currentPath;
      const taskId = extractTaskIdFromBranch(currentBranch) ?? name;
      entries.push({
        name,
        path: currentPath,
        branch: currentBranch,
        task_id: taskId,
      });
      currentPath = "";
      currentBranch = "";
    };

    for (const line of result.stdout.split(/\r?\n/)) {
      if (line.startsWith("worktree ")) {
        if (currentPath) {
          flush();
        }
        currentPath = line.slice("worktree ".length).trim();
        currentBranch = "";
        continue;
      }

      if (line.startsWith("branch ")) {
        currentBranch = line.slice("branch ".length).trim().replace(/^refs\/heads\//, "");
        continue;
      }

      if (line === "" && currentPath) {
        flush();
      }
    }

    if (currentPath) {
      flush();
    }

    return entries;
  }

  async create(options: CreateWorktreeOptions): Promise<WorktreeEntry> {
    const baseBranch = options.baseBranch ?? "main";
    const sequence = options.sequence ?? 1;
    const name = formatWorktreeName(options.taskId, sequence);
    const branch = formatBranchName(options.taskId);
    const worktreesDir = resolveWorktreesDir(this.repoRoot);
    const worktreePath = join(worktreesDir, name);

    await mkdir(worktreesDir, { recursive: true });

    const existing = await this.findByTaskId(options.taskId);
    if (existing && !options.recreate) {
      return existing;
    }
    if (existing) {
      // recreate requested — tear the stale worktree down so it rebuilds from baseBranch.
      await this.destroy(options.taskId);
    }

    const branchExists = await runGit(this.repoRoot, [
      "show-ref",
      "--verify",
      `refs/heads/${branch}`,
    ]);

    if (branchExists.exitCode !== 0) {
      const createBranch = await runGit(this.repoRoot, [
        "branch",
        branch,
        baseBranch,
      ]);
      assertGitSuccess(createBranch, `branch create ${branch}`);
    } else if (options.baseBranch) {
      // Branch lingers from a prior run (no live worktree holds it now). Re-point
      // it to the explicitly requested base so we never validate stale code.
      const resetBranch = await runGit(this.repoRoot, [
        "branch",
        "-f",
        branch,
        baseBranch,
      ]);
      assertGitSuccess(resetBranch, `branch reset ${branch} -> ${baseBranch}`);
    }

    // A directory can linger on disk if a previous teardown failed (Windows can
    // refuse to delete worktrees containing node_modules/build). `worktree add`
    // aborts on a non-empty target, so clear any orphaned dir first.
    await this.clearOrphanedDir(worktreePath);

    const add = await runGit(this.repoRoot, [
      "worktree",
      "add",
      worktreePath,
      branch,
    ]);
    assertGitSuccess(add, `worktree add ${worktreePath}`);

    return {
      name,
      path: worktreePath,
      branch,
      task_id: options.taskId,
    };
  }

  async destroy(taskId: string): Promise<void> {
    const entry = await this.findByTaskId(taskId);
    if (!entry) {
      throw new Error(`No worktree found for task: ${taskId}`);
    }

    await this.removeWorktreePath(entry.path);

    const deleteBranch = await runGit(this.repoRoot, ["branch", "-D", entry.branch]);
    if (deleteBranch.exitCode !== 0 && !isBranchAlreadyGone(deleteBranch.stderr)) {
      const detail = deleteBranch.stderr.trim() || deleteBranch.stdout.trim();
      throw new Error(`Git branch delete failed (exit ${deleteBranch.exitCode}): ${detail}`);
    }
  }

  private async removeWorktreePath(worktreePath: string): Promise<void> {
    const remove = await runGit(this.repoRoot, [
      "worktree",
      "remove",
      worktreePath,
      "--force",
    ]);
    if (remove.exitCode === 0) {
      return;
    }

    // Windows fails `worktree remove` with "Directory not empty" when the tree
    // contains node_modules/build artifacts git did not create. Force-remove the
    // directory ourselves, then prune git's now-dangling worktree metadata.
    await rm(worktreePath, { recursive: true, force: true });
    const prune = await runGit(this.repoRoot, ["worktree", "prune"]);
    assertGitSuccess(prune, "worktree prune");
  }

  private async clearOrphanedDir(worktreePath: string): Promise<void> {
    try {
      await access(worktreePath);
    } catch {
      return;
    }
    await rm(worktreePath, { recursive: true, force: true });
    const prune = await runGit(this.repoRoot, ["worktree", "prune"]);
    assertGitSuccess(prune, "worktree prune");
  }

  async findByTaskId(taskId: string): Promise<WorktreeEntry | null> {
    const entries = await this.list();
    return entries.find((entry) => entry.task_id === taskId) ?? null;
  }
}

function isBranchAlreadyGone(stderr: string): boolean {
  return /not found|cannot delete branch .* not found/i.test(stderr);
}

function extractTaskIdFromBranch(branch: string): string | null {
  const match = /^aether\/(task-[0-9a-f-]+)$/i.exec(branch);
  if (!match?.[1]) {
    return null;
  }
  return match[1];
}