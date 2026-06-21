import type { ValidationError } from "@aether/shared";
import type { GateInfraDiagnosis, ValidationResult } from "./types.js";

/**
 * Gate-infra self-healing.
 *
 * The self-repair loop heals executor OUTPUT (patches). It is blind to failures
 * of the validation HARNESS itself — a broken build command, a missing tool, a
 * malformed path. Those surface as gate failures but are NOT the executor's
 * fault, and retrying the patch never fixes them.
 *
 * This module classifies a failure as harness-infra and surfaces the known
 * remedy. The registry doubles as the memory seed corpus ("Gate-Infra Repair"):
 * every entry below was a real bug fixed by hand during the Base Wars build, so
 * a recurrence is recognised instead of re-derived. See
 * references/gate-infra-self-healing.md.
 */
export interface GateInfraSignature {
  id: string;
  phase: GateInfraDiagnosis["phase"];
  /** Matches the error message/suggestion text of a harness failure. */
  pattern: RegExp;
  summary: string;
  fix: string;
}

export const GATE_INFRA_SIGNATURES: readonly GateInfraSignature[] = [
  {
    id: "GATE-1",
    phase: "build",
    pattern:
      /(?:missing script|command\s+"?[\w:-]+"?\s+not found|no such script|run ".*" not found)/i,
    summary:
      "Profile build_command has no matching script at the gate's workspace root.",
    fix: "Add a delegating script (e.g. typecheck/lint) to the workspace-root package.json so the build_command resolves where the kernel runs it.",
  },
  {
    id: "GATE-2",
    phase: "build",
    pattern:
      /(?:node_modules missing|cannot find module|ERR_MODULE_NOT_FOUND|did you mean to install)/i,
    summary:
      "Dependencies absent at the build cwd — the pnpm workspace is nested below the worktree/repo root.",
    fix: "Resolve the nested pnpm workspace (resolvePnpmRoot) and install there before running the build.",
  },
  {
    id: "GATE-3",
    phase: "provision",
    pattern: /worktree.*already exists|fatal: .*already exists/i,
    summary:
      "worktree create reused a stale worktree/branch instead of rebuilding from the requested base.",
    fix: "Pass --recreate (tear down + rebuild from base); re-point the lingering task branch; clear any orphaned directory before `worktree add`.",
  },
  {
    id: "GATE-4",
    phase: "provision",
    pattern: /directory not empty|failed to delete.*worktree|worktree remove.*failed/i,
    summary:
      "Windows git worktree remove fails on a tree containing node_modules/build artifacts.",
    fix: "Fall back to recursive directory removal + `git worktree prune` when `worktree remove --force` fails.",
  },
  {
    id: "GATE-5",
    phase: "build",
    pattern:
      /'?gradlew(?:\.bat)?'? is not recognized|cannot run program.*gradlew|gradlew.*not found/i,
    summary:
      "Windows build layer invoked gradlew without the `.\\` prefix, so cmd can't run it from cwd.",
    fix: "Emit `.\\gradlew.bat` on win32 in resolveBuildCommand / the gradle wrapper resolver.",
  },
  {
    id: "GATE-7",
    phase: "setup",
    pattern: /cannot connect to [A-Za-z]:|tar.*resolve failed|not recoverable: exiting/i,
    summary:
      "GNU tar read a Windows drive-letter path (C:\\...) as a remote host during tool extraction.",
    fix: "Pass `--force-local` to tar so drive-letter colons are treated as local paths.",
  },
  {
    id: "GATE-GENERIC",
    phase: "build",
    pattern:
      /is not recognized as an internal or external command|command not found|\bENOENT\b|exit (?:code )?127|no such file or directory/i,
    summary:
      "A harness command could not be executed (missing binary / unresolved path).",
    fix: "Verify the tool is installed and the command resolves on this platform; fix the kernel/setup invocation, not the executor patch.",
  },
];

function matchSignature(text: string): GateInfraSignature | null {
  if (!text) {
    return null;
  }
  for (const signature of GATE_INFRA_SIGNATURES) {
    if (signature.pattern.test(text)) {
      return signature;
    }
  }
  return null;
}

/** Classify an arbitrary error string (build output, caught exception). */
export function classifyText(text: string): GateInfraDiagnosis | null {
  const signature = matchSignature(text);
  if (!signature) {
    return null;
  }
  return {
    signature_id: signature.id,
    phase: signature.phase,
    summary: signature.summary,
    fix: signature.fix,
    matched_text: text.slice(0, 400),
  };
}

/** Classify a single validation error (checks message + suggestion). */
export function classifyError(error: ValidationError): GateInfraDiagnosis | null {
  return (
    classifyText(error.message) ?? (error.suggestion ? classifyText(error.suggestion) : null)
  );
}

/**
 * Diagnose a failed validation result. Returns one diagnosis per distinct
 * matched signature (deduped). Empty when nothing matches an infra signature
 * (i.e. the failure is genuine executor output).
 */
export function diagnoseResult(result: ValidationResult): GateInfraDiagnosis[] {
  if (result.passed) {
    return [];
  }
  const byId = new Map<string, GateInfraDiagnosis>();
  for (const error of result.errors) {
    const diagnosis = classifyError(error);
    if (diagnosis && !byId.has(diagnosis.signature_id)) {
      byId.set(diagnosis.signature_id, diagnosis);
    }
  }
  return [...byId.values()];
}

/**
 * True when a failure is (at least partly) the harness's own fault. Consumers
 * must route these to a kernel/setup repair, NOT a retry of the executor patch.
 */
export function isHarnessInfraFailure(result: ValidationResult): boolean {
  return !result.passed && diagnoseResult(result).length > 0;
}
