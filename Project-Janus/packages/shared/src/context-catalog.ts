export interface ContextEntry {
  ref: string;
  title: string;
  files: readonly string[];
}

export const CLAUDE_CONTEXT_REF = "doc:claude" as const;
export const REL_STATE_CONTEXT_REF = "doc:rel-state" as const;

/** Live REL excerpts — orchestrator assignee only (CLAUDE token policy). */
export const ORCHESTRATOR_ONLY_CONTEXT_REFS: ReadonlySet<string> = new Set([
  REL_STATE_CONTEXT_REF,
]);

/** Ensure every task carries canonical doctrine per CLAUDE.md §2. */
export function ensureClaudeContextRef(contextRefs: readonly string[]): string[] {
  if (contextRefs.includes(CLAUDE_CONTEXT_REF)) {
    return [...contextRefs];
  }
  return [CLAUDE_CONTEXT_REF, ...contextRefs];
}

export const CONTEXT_CATALOG: Record<string, ContextEntry> = {
  "doc:claude": {
    ref: "doc:claude",
    title: "CLAUDE.md — Janus operational doctrine (SSOT)",
    files: ["../CLAUDE.md"],
  },
  "arch:framedblocks-mixin-pattern": {
    ref: "arch:framedblocks-mixin-pattern",
    title: "FramedBlocks mixin migration pattern",
    files: [
      "references/framedblocks/overview.md",
      "references/validation/domain-rules-v1.md",
      "references/neoforged/overview.md",
    ],
  },
  "doc:handoff-protocol": {
    ref: "doc:handoff-protocol",
    title: "Phase 0 handoff protocol",
    files: ["docs/phase0/handoff-protocol.md"],
  },
  "ref:neoforged": {
    ref: "ref:neoforged",
    title: "NeoForge reference",
    files: ["references/neoforged/overview.md"],
  },
  "ref:jdt-lsp": {
    ref: "ref:jdt-lsp",
    title: "JDT.LS reference",
    files: ["references/jdt-lsp/overview.md"],
  },
  "ref:validation-rules": {
    ref: "ref:validation-rules",
    title: "Domain validation rules v1",
    files: ["references/validation/domain-rules-v1.md"],
  },
  "arch:janus-unified": {
    ref: "arch:janus-unified",
    title: "JanusPrime unified system architecture",
    files: ["../references/unified-architecture.md"],
  },
  "doc:rel-state": {
    ref: "doc:rel-state",
    title: "REL cognitive state (live orchestrator context)",
    files: ["../references/rel-state-bridge.md"],
  },
};

export function resolveContextRefs(refs: readonly string[]): ContextEntry[] {
  const resolved: ContextEntry[] = [];

  for (const ref of refs) {
    const entry = CONTEXT_CATALOG[ref];
    if (!entry) {
      throw new Error(`Unknown context ref "${ref}"`);
    }
    resolved.push(entry);
  }

  return resolved;
}