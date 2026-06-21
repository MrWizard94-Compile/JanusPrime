import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { VALIDATION_PROFILES } from "@aether/shared";

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
  /** Remedy when !ok. */
  fix?: string | undefined;
}

export interface DoctorReport {
  ok: boolean;
  checks: DoctorCheck[];
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function dirHasPrefix(dir: string, prefix: string, suffix: string): Promise<boolean> {
  try {
    const entries = await readdir(dir);
    return entries.some((e) => e.startsWith(prefix) && e.endsWith(suffix));
  } catch {
    return false;
  }
}

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Harness pre-flight. Verifies the validation gate's own legs BEFORE executor
 * tasks run, so infrastructure breakage surfaces proactively instead of as a
 * mislabeled executor-task failure. Mirrors the gate-infra signature corpus
 * (see validation-kernel/gate-infra.ts).
 */
export async function runGateDoctor(janusRoot: string): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];

  // 1. LSP readiness — JDT.LS installed + configured (else the lsp layer no-ops).
  const aetherConfig = await readJson(join(janusRoot, ".aether", "config.json"));
  const jdtls = (aetherConfig?.["jdtls"] as { home?: string } | undefined) ?? undefined;
  const jdtlsHome = jdtls?.home;
  let lspOk = false;
  let lspDetail = "JDT.LS not configured — the lsp layer will no-op (ran:false).";
  if (jdtlsHome) {
    const launcherPresent = await dirHasPrefix(
      join(jdtlsHome, "plugins"),
      "org.eclipse.equinox.launcher_",
      ".jar",
    );
    lspOk = launcherPresent;
    lspDetail = launcherPresent
      ? `JDT.LS launcher present at ${jdtlsHome}`
      : `jdtls.home set (${jdtlsHome}) but launcher jar missing — extraction likely failed.`;
  }
  checks.push({
    name: "lsp-jdtls",
    ok: lspOk,
    detail: lspDetail,
    fix: lspOk ? undefined : "Run: aether setup jdtls",
  });

  // 2. Root build-script delegation (GATE-1) — typescript-v1 build_command runs at workspace root.
  const rootPkg = await readJson(join(janusRoot, "package.json"));
  const scripts = (rootPkg?.["scripts"] as Record<string, string> | undefined) ?? {};
  const hasTypecheck = typeof scripts["typecheck"] === "string";
  const hasLint = typeof scripts["lint"] === "string";
  checks.push({
    name: "root-build-scripts",
    ok: hasTypecheck && hasLint,
    detail: `workspace-root scripts — typecheck:${hasTypecheck ? "ok" : "MISSING"} lint:${hasLint ? "ok" : "MISSING"}`,
    fix:
      hasTypecheck && hasLint
        ? undefined
        : "Add typecheck/lint scripts to the workspace-root package.json (delegate to the nested workspace).",
  });

  // 3. pnpm workspace resolvable (GATE-2) — at root or one level down (nested monorepo).
  let pnpmRoot: string | null = null;
  if (await exists(join(janusRoot, "pnpm-workspace.yaml"))) {
    pnpmRoot = janusRoot;
  } else {
    try {
      for (const entry of await readdir(janusRoot, { withFileTypes: true })) {
        if (entry.isDirectory() && (await exists(join(janusRoot, entry.name, "pnpm-workspace.yaml")))) {
          pnpmRoot = join(janusRoot, entry.name);
          break;
        }
      }
    } catch {
      // leave null
    }
  }
  checks.push({
    name: "pnpm-workspace",
    ok: pnpmRoot !== null,
    detail: pnpmRoot ? `pnpm workspace at ${pnpmRoot}` : "pnpm-workspace.yaml not found at root or one level down.",
    fix: pnpmRoot ? undefined : "Ensure the pnpm workspace manifest is discoverable for worktree prepare.",
  });

  // 4. Profile layer coverage — Java/forge profiles should carry lsp + ast.
  for (const profileId of ["forge-mod-v1", "neoforge-mixin-v1"]) {
    const profile = VALIDATION_PROFILES[profileId];
    if (!profile) {
      continue;
    }
    const hasLsp = profile.layers.includes("lsp");
    const hasAst = profile.layers.includes("ast");
    checks.push({
      name: `profile-${profileId}`,
      ok: hasLsp && hasAst,
      detail: `layers: ${profile.layers.join(", ")}`,
      fix: hasLsp && hasAst ? undefined : "Add lsp + ast to this Java profile so executor output is structurally + semantically validated.",
    });
  }

  return { ok: checks.every((c) => c.ok), checks };
}
