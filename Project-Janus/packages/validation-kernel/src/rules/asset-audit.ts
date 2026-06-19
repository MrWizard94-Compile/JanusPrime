import type { TaskSpec, ValidationError } from "@aether/shared";
import { parseAssetModId } from "./asset-task.js";

export function runAssetAuditRules(spec: TaskSpec, contextRefs: readonly string[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const modId = parseAssetModId(spec, contextRefs);

  if (!modId) {
    errors.push({
      layer: "rules",
      rule: "A001",
      message:
        "Asset task requires mod id via context_ref asset:mod:<id> or constraint mod_id:<id>",
      suggestion: 'Add context_ref "asset:mod:create" or constraint "mod_id:create"',
    });
  }

  const action = parseAssetAction(contextRefs);
  if (!action) {
    errors.push({
      layer: "rules",
      rule: "A002",
      message: "Asset task requires action via context_ref asset:action:audit|run",
      suggestion: 'Add context_ref "asset:action:audit" or "asset:action:run"',
    });
  }

  return errors;
}

export function parseAssetAction(contextRefs: readonly string[]): "audit" | "run" | null {
  const marker = contextRefs.find((ref) => ref.startsWith("asset:action:"));
  if (!marker) {
    return null;
  }

  const action = marker.slice("asset:action:".length);
  if (action === "audit" || action === "run") {
    return action;
  }

  return null;
}