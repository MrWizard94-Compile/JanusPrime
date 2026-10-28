import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { AetherConfig, PatchProposal, ValidationError } from "@aether/shared";
import {
  resolveJdtlsConfigDir,
  resolveWorkspaceJavaHome,
  type ResolvedWorkspaceJava,
} from "@aether/workload-manager";
import {
  createProtocolConnection,
  DiagnosticSeverity,
  StreamMessageReader,
  StreamMessageWriter,
  type PublishDiagnosticsParams,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import type { LayerResult } from "../types.js";

export async function runLspLayer(
  proposal: PatchProposal,
  workspaceRoot: string,
  config: AetherConfig,
): Promise<LayerResult> {
  const started = Date.now();
  const javaFiles = proposal.files.filter((file) => file.path.endsWith(".java"));

  if (javaFiles.length === 0) {
    return {
      layer: "lsp",
      ran: false,
      passed: true,
      errors: [],
      duration_ms: Date.now() - started,
    };
  }

  if (!config.jdtls?.home) {
    return {
      layer: "lsp",
      ran: false,
      passed: true,
      errors: [],
      duration_ms: Date.now() - started,
    };
  }

  const timeoutMs = config.validation?.lsp_timeout_ms ?? 60_000;

  try {
    const errors = await collectJdtDiagnostics(workspaceRoot, javaFiles, config, timeoutMs);
    return {
      layer: "lsp",
      ran: true,
      passed: errors.length === 0,
      errors,
      duration_ms: Date.now() - started,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      layer: "lsp",
      ran: true,
      passed: false,
      errors: [
        {
          layer: "lsp",
          message: `JDT.LS validation failed: ${message}`,
        },
      ],
      duration_ms: Date.now() - started,
    };
  }
}

async function collectJdtDiagnostics(
  workspaceRoot: string,
  javaFiles: PatchProposal["files"],
  config: AetherConfig,
  timeoutMs: number,
): Promise<ValidationError[]> {
  const workspaceJava = await resolveWorkspaceJavaHome(workspaceRoot);
  const launcher = await findLauncherJar(config.jdtls?.home ?? "");
  const javaPath = resolveJdtlsProcessJavaPath(config, workspaceJava);
  const { dataDir, ephemeral } = await resolveJdtlsDataDir(config, workspaceRoot);

  // Prime the project's `.classpath` with the build tool's resolved dependency
  // jars before JDT.LS imports. Buildship's own Gradle import does not replicate
  // ForgeGradle's dependency replacement and resolves the wrong Minecraft jar
  // (false "deprecated since" diagnostics); the gradle `eclipse` task does.
  const primed = await primeGradleEclipse(workspaceRoot, config);

  const configDir = resolveJdtlsConfigDir(config.jdtls?.home ?? "");
  const args = [
    "-Declipse.application=org.eclipse.jdt.ls.core.id1",
    "-Dosgi.bundles.defaultStartLevel=4",
    "-jar",
    launcher,
    "-configuration",
    configDir,
    "-data",
    dataDir,
  ];

  const child = spawn(javaPath, args, {
    cwd: workspaceRoot,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (!child.stdin || !child.stdout) {
    await rm(dataDir, { recursive: true, force: true });
    throw new Error("Failed to create JDT.LS stdio pipes");
  }

  let stderr = "";
  child.stderr.on("data", (chunk: Buffer | string) => {
    stderr += chunk.toString();
  });

  const exitPromise = watchJdtlsExit(child);

  const reader = new StreamMessageReader(child.stdout);
  const writer = new StreamMessageWriter(child.stdin);
  const connection = createProtocolConnection(reader, writer);

  const diagnosticsByUri = new Map<string, ValidationError[]>();
  const pendingUris = new Set(
    javaFiles.map((file) => pathToFileURL(join(workspaceRoot, file.path)).toString()),
  );

  connection.onNotification(
    "textDocument/publishDiagnostics",
    (params: PublishDiagnosticsParams) => {
      const mapped = params.diagnostics
        .filter(
          (diag) =>
            (diag.severity ?? DiagnosticSeverity.Error) <= DiagnosticSeverity.Warning,
        )
        .map((diag) => {
          const error: ValidationError = {
            layer: "lsp",
            file: uriToRelativePath(params.uri, workspaceRoot),
            line: diag.range.start.line + 1,
            message: diag.message,
          };
          if (diag.source) {
            error.suggestion = `Source: ${diag.source}`;
          }
          return error;
        });

      diagnosticsByUri.set(params.uri, mapped);
      pendingUris.delete(params.uri);
    },
  );

  try {
    connection.listen();

    const rootUri = pathToFileURL(workspaceRoot).toString();
    await Promise.race([
      connection.sendRequest("initialize", {
        processId: process.pid,
        rootUri,
        capabilities: {},
        workspaceFolders: [{ uri: rootUri, name: "aether-workspace" }],
        initializationOptions: {
          settings: buildJdtlsWorkspaceSettings(workspaceJava, primed),
        },
      }),
      exitPromise,
    ]);

    await connection.sendNotification("initialized", {});

    const gradleImportDelayMs =
      config.validation?.lsp_gradle_import_delay_ms ?? (workspaceJava ? 3_000 : 0);
    if (gradleImportDelayMs > 0) {
      await delay(gradleImportDelayMs);
    }

    for (const file of javaFiles) {
      const absolutePath = join(workspaceRoot, file.path);
      const document = TextDocument.create(
        pathToFileURL(absolutePath).toString(),
        "java",
        1,
        file.content,
      );

      await connection.sendNotification("textDocument/didOpen", {
        textDocument: {
          uri: document.uri,
          languageId: document.languageId,
          version: document.version,
          text: document.getText(),
        },
      });
    }

    await waitForDiagnostics(pendingUris, diagnosticsByUri, timeoutMs);

    await connection.sendRequest("shutdown", null);
    await connection.sendNotification("exit", null);
    child.kill("SIGTERM");

    return [...diagnosticsByUri.values()].flat();
  } catch (error) {
    child.kill("SIGTERM");
    if (error instanceof JdtlsProcessExitError) {
      throw new Error(
        `JDT.LS exited with code ${error.exitCode ?? "unknown"}${stderr.trim() ? `: ${trimOutput(stderr)}` : ""}`,
      );
    }
    throw error;
  } finally {
    // Only delete throwaway temp dirs. A configured persistent data dir keeps
    // JDT.LS's imported Gradle/Forge classpath warm across runs — nuking it
    // would force a multi-minute cold re-import (and the timeout) every time.
    if (ephemeral) {
      await rm(dataDir, { recursive: true, force: true });
    }
  }
}

/**
 * Resolve the JDT.LS `-data` workspace directory.
 *
 * When `jdtls.workspace_data_dir` is configured, use a stable per-workspace
 * subdirectory under it so each workload keeps its own warm Gradle import cache
 * across validation runs (cold Forge imports are the dominant LSP cost and the
 * cause of the 60s diagnostics timeouts). Falls back to an ephemeral temp dir
 * when no persistent root is configured.
 */
async function resolveJdtlsDataDir(
  config: AetherConfig,
  workspaceRoot: string,
): Promise<{ dataDir: string; ephemeral: boolean }> {
  const persistentRoot = config.jdtls?.workspace_data_dir;
  if (persistentRoot) {
    const key = createHash("sha1").update(workspaceRoot).digest("hex").slice(0, 16);
    const dataDir = join(persistentRoot, key);
    await mkdir(dataDir, { recursive: true });
    return { dataDir, ephemeral: false };
  }

  const dataDir = await mkdtemp(join(tmpdir(), "aether-jdtls-"));
  return { dataDir, ephemeral: true };
}

class JdtlsProcessExitError extends Error {
  readonly exitCode: number | null;

  constructor(exitCode: number | null) {
    super(`JDT.LS process exited with code ${exitCode ?? "unknown"}`);
    this.name = "JdtlsProcessExitError";
    this.exitCode = exitCode;
  }
}

function watchJdtlsExit(child: ChildProcessWithoutNullStreams): Promise<never> {
  return new Promise((_, reject) => {
    child.once("exit", (code) => {
      reject(new JdtlsProcessExitError(code));
    });
  });
}

function trimOutput(output: string): string {
  const lines = output.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.slice(-4).join("\n");
}

async function waitForDiagnostics(
  pendingUris: Set<string>,
  diagnosticsByUri: Map<string, ValidationError[]>,
  timeoutMs: number,
): Promise<void> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const unresolved = [...pendingUris].filter((uri) => !diagnosticsByUri.has(uri));
    if (unresolved.length === 0) {
      return;
    }
    await delay(250);
  }

  throw new Error(`Timed out waiting for JDT.LS diagnostics after ${timeoutMs}ms`);
}

async function findLauncherJar(jdtlsHome: string): Promise<string> {
  const pluginsDir = join(jdtlsHome, "plugins");
  const entries = await readdir(pluginsDir);
  const launcher = entries.find((entry) => entry.startsWith("org.eclipse.equinox.launcher_"));
  if (!launcher) {
    throw new Error(`No equinox launcher found in ${pluginsDir}`);
  }
  return join(pluginsDir, launcher);
}

function uriToRelativePath(uri: string, workspaceRoot: string): string {
  const absolute = decodeURIComponent(new URL(uri).pathname).replace(
    /^\/([A-Za-z]:\/)/,
    "$1",
  );
  const root = workspaceRoot.replace(/\\/g, "/");
  const normalized = absolute.replace(/\\/g, "/");
  if (normalized.startsWith(root)) {
    return normalized.slice(root.length + 1);
  }
  return normalized;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Run the Gradle `eclipse` task so the workspace `.classpath` is regenerated with
 * the build tool's fully-resolved dependency jars (e.g. ForgeGradle's recompiled,
 * deobfuscated Minecraft artifact). Returns true when the task ran successfully —
 * the caller then disables JDT.LS's own Gradle import so it trusts this classpath.
 *
 * Best-effort: when there is no Gradle wrapper, the feature is disabled, or the
 * task fails, returns false and the LSP layer falls back to JDT.LS's own import.
 * `.classpath`/`.project`/`.settings` are regenerable IDE artifacts (gitignored
 * in MDK projects), so regenerating them never touches tracked source.
 */
async function primeGradleEclipse(
  workspaceRoot: string,
  config: AetherConfig,
): Promise<boolean> {
  if (config.validation?.lsp_prime_gradle_eclipse === false) {
    return false;
  }

  const wrapper = await findGradleWrapper(workspaceRoot);
  if (!wrapper) {
    return false;
  }

  const timeoutMs = config.validation?.build_timeout_ms ?? 300_000;
  return new Promise<boolean>((resolve) => {
    // On Windows a .bat can't be spawned directly (and `shell:true` + an args
    // array reintroduces DEP0190); route through cmd.exe /c with the wrapper
    // path quoted. The trailing args are constant, so there is no injection
    // surface. On POSIX gradlew is an executable shell script.
    const child =
      process.platform === "win32"
        ? spawn("cmd.exe", ["/c", `"${wrapper}" eclipse --console=plain`], {
            cwd: workspaceRoot,
            windowsHide: true,
          })
        : spawn(wrapper, ["eclipse", "--console=plain"], {
            cwd: workspaceRoot,
            windowsHide: true,
          });

    let settled = false;
    const finish = (value: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      finish(false);
    }, timeoutMs);

    child.on("error", () => finish(false));
    child.on("close", (code) => finish(code === 0));
  });
}

async function findGradleWrapper(workspaceRoot: string): Promise<string | null> {
  const candidates =
    process.platform === "win32"
      ? [join(workspaceRoot, "gradlew.bat")]
      : [join(workspaceRoot, "gradlew")];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next
    }
  }
  return null;
}

function resolveJdtlsProcessJavaPath(
  config: AetherConfig,
  workspaceJava: ResolvedWorkspaceJava | null,
): string {
  const configuredJavaPath = config.jdtls?.java_path ?? "java";
  if (!workspaceJava || workspaceJava.version < 21) {
    return configuredJavaPath;
  }

  const workspaceJavaBinary = join(
    workspaceJava.home,
    "bin",
    process.platform === "win32" ? "java.exe" : "java",
  );
  return workspaceJavaBinary;
}

function buildJdtlsWorkspaceSettings(
  workspaceJava: ResolvedWorkspaceJava | null,
  primedGradleEclipse = false,
): Record<string, unknown> {
  // JDT.LS reads preferences from a nested `java.*` object (the shape the VS Code
  // Java client sends). When we've primed an authoritative `.classpath` via
  // `gradlew eclipse`, disable JDT.LS's own Buildship Gradle import so it consumes
  // that classpath (Eclipse importer) instead of re-resolving a divergent one.
  const runtimes = workspaceJava
    ? [
        {
          name: `JavaSE-${workspaceJava.version}`,
          path: workspaceJava.home,
          default: true,
        },
      ]
    : undefined;

  const configuration: Record<string, unknown> = {
    updateBuildConfiguration: primedGradleEclipse ? "disabled" : "automatic",
  };
  if (runtimes) {
    configuration["runtimes"] = runtimes;
  }

  return {
    java: {
      import: {
        gradle: {
          enabled: !primedGradleEclipse,
          wrapper: { enabled: true },
        },
        maven: { enabled: false },
      },
      configuration,
    },
  };
}