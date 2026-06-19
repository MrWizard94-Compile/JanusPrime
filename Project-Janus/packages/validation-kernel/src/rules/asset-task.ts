import type { TaskSpec } from "@aether/shared";

const MOD_ID_PREFIX = "asset:mod:";
const MOD_ID_CONSTRAINT_PREFIX = "mod_id:";

export function parseAssetModId(
  spec: TaskSpec,
  contextRefs: readonly string[],
): string | null {
  const fromRef = contextRefs.find((ref) => ref.startsWith(MOD_ID_PREFIX));
  if (fromRef) {
    const modId = fromRef.slice(MOD_ID_PREFIX.length).trim();
    if (modId.length > 0) {
      return modId;
    }
  }

  for (const constraint of spec.constraints) {
    if (constraint.startsWith(MOD_ID_CONSTRAINT_PREFIX)) {
      const modId = constraint.slice(MOD_ID_CONSTRAINT_PREFIX.length).trim();
      if (modId.length > 0) {
        return modId;
      }
    }
  }

  return null;
}