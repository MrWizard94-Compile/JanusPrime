import { access, readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

export interface PrepareResult {
  workspace_root: string;
  commands: string[];
  exit_code: number;
  skipped: boolean;
}

export async function prepareWorktreeDependencies(
  workspaceRoot: string,
): Promise<PrepareResult> {
  const gradleWrapper = await findGradleWrapper(workspaceRoot);
  if (gradleWrapper) {
    const command = `${gradleWrapper} compileJava`;
    const result = await runShellCommand(workspaceRoot, command, 600_000);

    if (result.exitCode !== 0) {
      const detail = result.stderr.trim() || result.stdout.trim();
      throw new Error(
        `Worktree prepare failed on "${command}" (exit ${result.exitCode}): ${detail}`,
      );
    }

    return {
      workspace_root: workspaceRoot,
      commands: [command],
      exit_code: result.exitCode,
      skipped: false,
    };
  }

  // The pnpm workspace manifest may live one level below the git/worktree root
  // (nested monorepo: JanusPrime's workspace is under Project-Janus/). Resolve
  // the directory that actually owns the lockfile/workspace before installing,
  // otherwise `pnpm install` runs against an empty root and dependencies never
  // land where the build command needs them.
  const pnpmRoot = await resolvePnpmRoot(workspaceRoot);
  const packageJsonPath = join(pnpmRoot, "package.json");

  try {
    await access(packageJsonPath);
  } catch {
    return {
      workspace_root: pnpmRoot,
      commands: [],
      exit_code: 0,
      skipped: true,
    };
  }

  const commands = ["pnpm install --frozen-lockfile", "pnpm build"];
  let lastExitCode = 0;

  for (const command of commands) {
    const result = await runShellCommand(pnpmRoot, command);
    lastExitCode = result.exitCode;

    if (result.exitCode !== 0) {
      const detail = result.stderr.trim() || result.stdout.trim();
      throw new Error(
        `Worktree prepare failed on "${command}" (exit ${result.exitCode}): ${detail}`,
      );
    }
  }

  return {
    workspace_root: pnpmRoot,
    commands,
    exit_code: lastExitCode,
    skipped: false,
  };
}

async function resolvePnpmRoot(workspaceRoot: string): Promise<string> {
  if (await hasPnpmManifest(workspaceRoot)) {
    return workspaceRoot;
  }

  try {
    const entries = await readdir(workspaceRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (
        !entry.isDirectory() ||
        entry.name === "node_modules" ||
        entry.name.startsWith(".")
      ) {
        continue;
      }
      const candidate = join(workspaceRoot, entry.name);
      if (await hasPnpmManifest(candidate)) {
        return candidate;
      }
    }
  } catch {
    // Unreadable directory — fall back to the workspace root.
  }

  return workspaceRoot;
}

async function hasPnpmManifest(dir: string): Promise<boolean> {
  for (const manifest of ["pnpm-workspace.yaml", "pnpm-lock.yaml"]) {
    try {
      await access(join(dir, manifest));
      return true;
    } catch {
      // Try the next manifest marker.
    }
  }
  return false;
}

async function findGradleWrapper(workspaceRoot: string): Promise<string | null> {
  const windowsWrapper = join(workspaceRoot, "gradlew.bat");
  const unixWrapper = join(workspaceRoot, "gradlew");

  try {
    await access(windowsWrapper);
    return ".\\gradlew.bat";
  } catch {
    try {
      await access(unixWrapper);
      return "./gradlew";
    } catch {
      return null;
    }
  }
}

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runShellCommand(
  cwd: string,
  command: string,
  timeoutMs = 300_000,
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`Command timed out after ${timeoutMs}ms: ${command}`));
        return;
      }
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}