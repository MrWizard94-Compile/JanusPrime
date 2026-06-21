export interface ValidationProfile {
  id: string;
  description: string;
  layers: readonly ("lsp" | "ast" | "rules" | "build")[];
  build_command: string | null;
}

export const VALIDATION_PROFILES: Record<string, ValidationProfile> = {
  "neoforge-mixin-v1": {
    id: "neoforge-mixin-v1",
    description: "NeoForge mixin validation: LSP, AST rules, domain rules, Gradle compile",
    layers: ["lsp", "ast", "rules", "build"],
    build_command: "./gradlew compileJava",
  },
  "forge-mod-v1": {
    id: "forge-mod-v1",
    description: "Forge mod validation: CLAUDE rules and full Gradle build (non-mixin workloads)",
    layers: ["lsp", "rules", "build"],
    build_command: "./gradlew build",
  },
  "typescript-v1": {
    id: "typescript-v1",
    description: "TypeScript package validation: rules and typecheck build",
    layers: ["rules", "build"],
    build_command: "pnpm typecheck",
  },
  "asset-audit-v1": {
    id: "asset-audit-v1",
    description: "AssetConverter texture audit: policy rules and audit script",
    layers: ["rules", "build"],
    build_command: "python pipeline/audit_mod.py",
  },
  "python-sandbox-v1": {
    id: "python-sandbox-v1",
    description: "Python sandbox validation via Smart-Library heal endpoint",
    layers: ["rules", "build"],
    build_command: "python -m pytest tests/ -q --tb=no",
  },
};

export function getValidationProfile(id: string): ValidationProfile {
  const profile = VALIDATION_PROFILES[id];
  if (!profile) {
    const known = Object.keys(VALIDATION_PROFILES).join(", ");
    throw new Error(`Unknown validation profile "${id}". Known profiles: ${known}`);
  }
  return profile;
}