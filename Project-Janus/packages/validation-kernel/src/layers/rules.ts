import type { PatchProposal, TaskSpec, ValidationProfile, ValidationError } from "@aether/shared";
import { runAssetAuditRules } from "../rules/asset-audit.js";
import { runNeoForgeMixinRules } from "../rules/neoforge-mixin.js";
import { runClaudeEngineeringRules } from "../rules/claude-engineering.js";
import { runTypeScriptRules } from "../rules/typescript.js";
import type { LayerResult } from "../types.js";

export interface RulesLayerContext {
  proposal: PatchProposal;
  spec: TaskSpec;
  context_refs?: readonly string[];
}

export function runRulesLayer(
  profile: ValidationProfile,
  context: RulesLayerContext,
): LayerResult {
  const started = Date.now();
  let errors: ValidationError[] = runClaudeEngineeringRules(context.proposal);

  if (profile.id === "neoforge-mixin-v1") {
    errors = errors.concat(
      runNeoForgeMixinRules({ proposal: context.proposal, spec: context.spec }),
    );
  } else if (profile.id === "typescript-v1") {
    errors = errors.concat(runTypeScriptRules(context.proposal, context.spec));
  } else if (profile.id === "asset-audit-v1") {
    errors = errors.concat(runAssetAuditRules(context.spec, context.context_refs ?? []));
  }

  return {
    layer: "rules",
    ran: true,
    passed: errors.length === 0,
    errors,
    duration_ms: Date.now() - started,
  };
}