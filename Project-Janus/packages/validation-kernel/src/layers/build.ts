import { spawn } from "node:child_process";
import type { AetherConfig, Task, ValidationProfile, ValidationError } from "@aether/shared";
import { parseAssetModId } from "../rules/asset-task.js";
import type { LayerResult } from "../types.js";

export async function runBuildLayer(
  profile: ValidationProfile,
  workspaceRoot: string,
  config: AetherConfig,
  task?: Task,
): Promise<LayerResult> {
  const started = Date.now();

  if (!profile.build_command) {
    return {
      layer: "build",
      ran: false,
      passed: true,
      errors: [],
      duration_ms: Date.now() - started,
    };
  }

  const timeoutMs = config.validation?.build_timeout_ms ?? 300_000;
  const command = resolveBuildCommand(profile, task);
  const cwd = resolveBuildCwd(profile, workspaceRoot);
  const result = await runCommand(cwd, command, timeoutMs);

  if (result.timedOut) {
    return {
      layer: "build",
      ran: true,
      passed: false,
      errors: [
        {
          layer: "build",
          rule: "B001",
          message: `Build command timed out after ${timeoutMs}ms: ${command}`,
        },
      ],
      duration_ms: Date.now() - started,
    };
  }

  if (result.exitCode !== 0) {
    return {
      layer: "build",
      ran: true,
      passed: false,
      errors: [
        {
          layer: "build",
          rule: "B001",
          message: `Build command failed (exit ${result.exitCode}): ${command}`,
          suggestion: trimOutput(result.stderr || result.stdout),
        },
      ],
      duration_ms: Date.now() - started,
    };
  }

  return {
    layer: "build",
    ran: true,
    passed: true,
    errors: [],
    duration_ms: Date.now() - started,
  };
}

function resolveBuildCommand(profile: ValidationProfile, task?: Task): string {
  if (profile.id === "asset-audit-v1" && task) {
    const modId = parseAssetModId(task.spec, task.context_refs);
    if (!modId) {
      return "python pipeline/audit_mod.py __missing_mod_id__";
    }
    return `python pipeline/audit_mod.py ${modId}`;
  }

  const command = profile.build_command ?? "";
  if (process.platform === "win32" && command.startsWith("./gradlew")) {
    return command.replace("./gradlew", "gradlew.bat");
  }
  return command;
}

function resolveBuildCwd(profile: ValidationProfile, workspaceRoot: string): string {
  if (profile.id === "asset-audit-v1") {
    return workspaceRoot;
  }
  return workspaceRoot;
}

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

async function runCommand(
  cwd: string,
  command: string,
  timeoutMs: number,
): Promise<CommandResult> {
  return new Promise((resolve) => {
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

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        timedOut,
      });
    });
  });
}

function trimOutput(output: string): string {
  const lines = output.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.slice(-8).join("\n");
}