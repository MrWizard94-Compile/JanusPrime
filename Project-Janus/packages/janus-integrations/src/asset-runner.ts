import { spawn } from "node:child_process";
import { join } from "node:path";
import type { JanusConfig } from "./config.js";
import { resolveAssetRoot } from "./config.js";

export interface AssetRunResult {
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface AssetQueueStatus {
  raw: string;
}

export class AssetRunner {
  private readonly assetRoot: string;
  private readonly python: string;
  private readonly entry: string;

  constructor(janusRoot: string, config: JanusConfig) {
    this.assetRoot = resolveAssetRoot(janusRoot, config);
    this.python = config.components.assets.python;
    this.entry = config.components.assets.entry;
  }

  async run(args: string[]): Promise<AssetRunResult> {
    const entryPath = join(this.assetRoot, this.entry);
    return this.spawnPython([entryPath, ...args]);
  }

  async queue(): Promise<AssetQueueStatus> {
    const result = await this.run(["queue"]);
    if (result.exitCode !== 0) {
      throw new Error(`Asset queue failed (exit ${result.exitCode}): ${result.stderr || result.stdout}`);
    }
    return { raw: result.stdout };
  }

  async runMod(modId: string, options?: { method?: string; build?: boolean }): Promise<AssetRunResult> {
    const args = ["run", modId];
    if (options?.method) {
      args.push("--method", options.method);
    }
    if (options?.build) {
      args.push("--build");
    }
    return this.run(args);
  }

  async auditMod(modId: string): Promise<AssetRunResult> {
    return this.runSubprocess("pipeline/audit_mod.py", [modId]);
  }

  async build(deploy = false): Promise<AssetRunResult> {
    const args = ["build"];
    if (deploy) {
      args.push("--deploy");
    }
    return this.run(args);
  }

  async stats(): Promise<AssetRunResult> {
    return this.run(["stats"]);
  }

  private async runSubprocess(script: string, args: string[]): Promise<AssetRunResult> {
    const scriptPath = join(this.assetRoot, script);
    return this.spawnPython([scriptPath, ...args]);
  }

  /**
   * Spawn the configured Python interpreter with an argument vector.
   *
   * `shell` is intentionally NOT set: passing an args array with `shell: true`
   * concatenates the args into a shell command line unescaped (Node DEP0190),
   * which is a command-injection vector for any task-derived arg (mod ids,
   * paths). Spawning the interpreter directly passes each arg verbatim through
   * the OS exec boundary with zero shell interpolation.
   */
  private async spawnPython(fullArgs: string[]): Promise<AssetRunResult> {
    const command = this.python;

    return new Promise((resolve, reject) => {
      const child = spawn(command, fullArgs, {
        cwd: this.assetRoot,
        windowsHide: true,
        env: process.env,
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on("error", reject);

      child.on("close", (code) => {
        resolve({
          command,
          args: fullArgs,
          exitCode: code ?? 1,
          stdout,
          stderr,
        });
      });
    });
  }
}