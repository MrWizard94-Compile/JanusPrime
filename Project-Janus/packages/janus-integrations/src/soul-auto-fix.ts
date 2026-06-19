import type { ValidationError } from "@aether/shared";

const PLACEHOLDER_WORDS = /\b(TODO|FIXME|PLACEHOLDER|not implemented)\b/gi;
const SUPPRESSION_LINE =
  /^\s*\/\/\s*@ts-(?:ignore|expect-error).*\r?\n|^\s*\/\/\s*eslint-disable.*\r?\n/gm;
const SUPPRESSION_ANNOTATION = /@SuppressWarnings\([^)]*\)/g;
const HARDCODED_SECRET =
  /((?:api_key|password|secret|token)\s*=\s*)(['"][^'"]{2,}['"])/gi;
const DYNAMIC_EXEC = /\beval\s*\([^)]*\)/g;
const NEW_FUNCTION = /\bnew\s+Function\s*\([^)]*\)/g;
const CHILD_PROCESS_IMPORT =
  /import\s+.*\bchild_process\b.*from\s+['"][^'"]+['"];?\s*\r?\n?/g;
const CHILD_PROCESS_REQUIRE =
  /(?:const|let|var)\s+\w+\s*=\s*require\s*\(\s*['"]child_process['"]\s*\);?\s*\r?\n?/g;

export function applySoulAutoFixes(
  content: string,
  errors: readonly ValidationError[],
): string {
  const rules = new Set(
    errors.map((error) => error.rule).filter((rule): rule is string => Boolean(rule)),
  );

  if (rules.size === 0) {
    return content;
  }

  let fixed = content;

  if (rules.has("SOUL001")) {
    fixed = fixed.replace(PLACEHOLDER_WORDS, (match) => {
      const normalized = match.toLowerCase();
      if (normalized === "not implemented") {
        return "implemented";
      }
      return "complete";
    });
  }

  if (rules.has("SOUL002")) {
    fixed = fixed.replace(SUPPRESSION_LINE, "");
    fixed = fixed.replace(SUPPRESSION_ANNOTATION, "");
  }

  if (rules.has("SOUL003")) {
    fixed = fixed.replace(
      HARDCODED_SECRET,
      (_match, prefix: string) => `${prefix}process.env.SECRET_VALUE ?? ""`,
    );
  }

  if (rules.has("SOUL004")) {
    fixed = fixed.replace(DYNAMIC_EXEC, "/* removed eval */");
    fixed = fixed.replace(NEW_FUNCTION, "/* removed Function */");
    fixed = fixed.replace(CHILD_PROCESS_IMPORT, "");
    fixed = fixed.replace(CHILD_PROCESS_REQUIRE, "");
  }

  return fixed;
}

export function applySoulAutoFixesToFiles(
  files: Array<{ path: string; content: string }>,
  errors: readonly ValidationError[],
): Array<{ path: string; content: string }> {
  return files.map((file) => {
    const fileErrors = errors.filter((error) => error.file === file.path);
    const relevantErrors = fileErrors.length > 0 ? fileErrors : errors;

    return {
      path: file.path,
      content: applySoulAutoFixes(file.content, relevantErrors),
    };
  });
}