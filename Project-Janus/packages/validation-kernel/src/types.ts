import type { ValidationError } from "@aether/shared";

export interface LayerResult {
  layer: "lsp" | "ast" | "rules" | "build";
  ran: boolean;
  passed: boolean;
  errors: ValidationError[];
  duration_ms: number;
}

export interface GateInfraDiagnosis {
  /** Stable id of the matched harness-infra signature, e.g. "GATE-7". */
  signature_id: string;
  /** Where the breakage lives — a validation layer, or an out-of-band phase. */
  phase: LayerResult["layer"] | "provision" | "setup";
  /** What broke in the harness (not in the executor's patch). */
  summary: string;
  /** The known remedy — the seed corpus for self-healing. */
  fix: string;
  /** The error fragment that matched the signature. */
  matched_text: string;
}

export interface ValidationResult {
  passed: boolean;
  profile_id: string;
  workspace_root: string;
  layers: LayerResult[];
  errors: ValidationError[];
  /**
   * Failures attributable to the validation HARNESS itself (broken build
   * command, missing tool, malformed path) rather than the executor's patch.
   * Present only when at least one signature matched. Consumers must NOT retry
   * the executor patch on these — they need a kernel/setup repair.
   */
  harness_infra?: GateInfraDiagnosis[];
}