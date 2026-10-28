import type { TaskSpec } from "@aether/shared";

const MOD_ID_PREFIX = "asset:mod:";
const MOD_ID_CONSTRAINT_PREFIX = "mod_id:";

// Mod namespaces are lowercase alnum plus `_`, `-`, `.` (NeoForge/Minecraft
// convention). The build layer interpolates the returned value into a shell
// command, so anything outside this charset is rejected to close the
// command-injection path for task-derived ids.
const MOD_ID_PATTERN = /^[a-z0-9_.-]+$/;

export function parseAssetModId(
  spec: TaskSpec,
  contextRefs: readonly string[],
): string | null {
  const fromRef = contextRefs.find((ref) => ref.startsWith(MOD_ID_PREFIX));
  if (fromRef) {
    const modId = fromRef.slice(MOD_ID_PREFIX.length).trim();
    if (modId.length > 0) {
      return MOD_ID_PATTERN.test(modId) ? modId : null;
    }
  }

  for (const constraint of spec.constraints) {
    if (constraint.startsWith(MOD_ID_CONSTRAINT_PREFIX)) {
      const modId = constraint.slice(MOD_ID_CONSTRAINT_PREFIX.length).trim();
      if (modId.length > 0) {
        return MOD_ID_PATTERN.test(modId) ? modId : null;
      }
    }
  }

  return null;
}