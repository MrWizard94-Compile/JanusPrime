import type { PatchProposal, ValidationError } from "@aether/shared";

const PLACEHOLDER_PATTERN = /\b(TODO|FIXME|PLACEHOLDER|not implemented)\b/i;
const SUPPRESSION_PATTERN = /@ts-ignore|@ts-expect-error|@SuppressWarnings/;
const HARDCODED_SECRET_PATTERN =
  /(?:api_key|password|secret|token)\s*=\s*(?:['"][^'"]{2,}['"]|(?!(?:process\.env|os\.environ|getenv)\b)[^\s;,\n]{8,})/i;
const DYNAMIC_CODE_EXEC_PATTERN = /\beval\s*\(|new\s+Function\s*\(/;
const CHILD_PROCESS_PATTERN = /child_process/;

export function runSoulEngineeringRules(proposal: PatchProposal): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const file of proposal.files) {
    if (PLACEHOLDER_PATTERN.test(file.content)) {
      errors.push({
        layer: "rules",
        rule: "SOUL001",
        file: file.path,
        message: "Placeholder or deferred implementation forbidden (SOUL §4, §8)",
        suggestion: "Deliver complete, wired-up implementation before submit",
      });
    }

    if (SUPPRESSION_PATTERN.test(file.content)) {
      errors.push({
        layer: "rules",
        rule: "SOUL002",
        file: file.path,
        message: "Warning/error suppression forbidden (SOUL §1 zero-tolerance)",
        suggestion: "Fix root cause instead of suppressing diagnostics",
      });
    }

    if (HARDCODED_SECRET_PATTERN.test(file.content)) {
      errors.push({
        layer: "rules",
        rule: "SOUL003",
        file: file.path,
        message: "Hardcoded secret or credential forbidden (SOUL §10 security)",
        suggestion: "Load secrets from environment or a secrets manager, never literals in patch content",
      });
    }

    if (DYNAMIC_CODE_EXEC_PATTERN.test(file.content) || CHILD_PROCESS_PATTERN.test(file.content)) {
      errors.push({
        layer: "rules",
        rule: "SOUL004",
        file: file.path,
        message: "Dynamic code execution or child_process forbidden (SOUL §10 security)",
        suggestion: "Remove eval/new Function/child_process; use safe static APIs instead",
      });
    }
  }

  return errors;
}