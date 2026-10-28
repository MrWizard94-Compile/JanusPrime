import { z } from "zod";

export const AetherConfigSchema = z.object({
  jdtls: z
    .object({
      java_path: z.string().min(1).default("java"),
      home: z.string().min(1),
      workspace_data_dir: z.string().min(1).optional(),
    })
    .optional(),
  validation: z
    .object({
      build_timeout_ms: z.number().int().positive().default(300_000),
      // Cold JDT.LS Gradle/Forge imports routinely exceed 60s before the first
      // diagnostics are published; 180s covers a cold import while a configured
      // jdtls.workspace_data_dir keeps subsequent runs warm.
      lsp_timeout_ms: z.number().int().positive().default(180_000),
      /** Extra delay after JDT.LS initialize before didOpen; helps Gradle import complete. */
      lsp_gradle_import_delay_ms: z.number().int().nonnegative().optional(),
      /**
       * Run `gradlew eclipse` before JDT.LS launches so the project's `.classpath`
       * carries the build tool's fully-resolved (e.g. ForgeGradle-deobfuscated)
       * dependency jars. When priming succeeds the LSP layer disables JDT.LS's own
       * Buildship Gradle import so it consumes that authoritative classpath instead
       * of re-resolving a different Minecraft artifact. Default on. */
      lsp_prime_gradle_eclipse: z.boolean().optional(),
    })
    .optional(),
});

export type AetherConfig = z.infer<typeof AetherConfigSchema>;

export const DEFAULT_AETHER_CONFIG: AetherConfig = {
  validation: {
    build_timeout_ms: 300_000,
    lsp_timeout_ms: 180_000,
  },
};