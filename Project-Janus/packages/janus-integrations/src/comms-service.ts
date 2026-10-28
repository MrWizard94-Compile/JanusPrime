import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  CommsMessageSchema,
  CommsPostInputSchema,
  CommsReadFilterSchema,
  formatCommsMarkdownEntry,
  COMMS_JSONL_FILE,
  COMMS_MARKDOWN_RELATIVE,
  type CommsMessage,
  type CommsPostInput,
  type CommsReadFilter,
} from "@aether/shared";

export interface CommsPostResult {
  message: CommsMessage;
}

export interface CommsReadResult {
  messages: CommsMessage[];
  skipped_invalid_lines: number;
}

export class CommsService {
  private readonly jsonlPath: string;
  private readonly markdownPath: string;

  constructor(janusRoot: string, stateDir = ".aether") {
    this.jsonlPath = join(janusRoot, stateDir, COMMS_JSONL_FILE);
    this.markdownPath = join(janusRoot, COMMS_MARKDOWN_RELATIVE);
  }

  async post(input: CommsPostInput): Promise<CommsPostResult> {
    const parsed = CommsPostInputSchema.parse(input);
    const message: CommsMessage = CommsMessageSchema.parse({
      ts: new Date().toISOString(),
      ...parsed,
    });

    await mkdir(dirname(this.jsonlPath), { recursive: true });
    await appendFile(this.jsonlPath, `${JSON.stringify(message)}\n`, "utf8");
    await appendFile(this.markdownPath, `\n${formatCommsMarkdownEntry(message)}`, "utf8");

    return { message };
  }

  async read(filter: CommsReadFilter = {}): Promise<CommsReadResult> {
    const parsed = CommsReadFilterSchema.parse(filter);
    let raw = "";
    try {
      raw = await readFile(this.jsonlPath, "utf8");
    } catch (error) {
      if (isEnoent(error)) {
        return { messages: [], skipped_invalid_lines: 0 };
      }
      throw error;
    }

    const messages: CommsMessage[] = [];
    let skipped = 0;
    const sinceMs =
      parsed.since !== undefined ? new Date(parsed.since).getTime() : undefined;

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      let record: unknown;
      try {
        record = JSON.parse(trimmed);
      } catch {
        skipped += 1;
        continue;
      }

      const parsedMessage = CommsMessageSchema.safeParse(record);
      if (!parsedMessage.success) {
        skipped += 1;
        continue;
      }

      const msg = parsedMessage.data;
      if (parsed.task_id !== undefined && msg.task_id !== parsed.task_id) {
        continue;
      }

      if (sinceMs !== undefined) {
        const msgMs = new Date(msg.ts).getTime();
        if (Number.isNaN(msgMs) || msgMs < sinceMs) {
          continue;
        }
      }

      messages.push(msg);
    }

    messages.sort((a, b) => a.ts.localeCompare(b.ts));

    const limit = parsed.limit ?? 100;
    const sliced = messages.length > limit ? messages.slice(-limit) : messages;

    return { messages: sliced, skipped_invalid_lines: skipped };
  }
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "ENOENT"
  );
}
