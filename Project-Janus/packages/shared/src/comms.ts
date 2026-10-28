import { z } from "zod";

export const COMMS_STATUSES = ["INFO", "ASK", "BLOCKED", "HANDOFF", "DONE"] as const;

export type CommsStatus = (typeof COMMS_STATUSES)[number];

export const CommsStatusSchema = z.enum(COMMS_STATUSES);

const AGENT_NAME_MAX = 64;
const BODY_MAX = 16_000;
const TASK_ID_MAX = 128;

const AgentNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(AGENT_NAME_MAX)
  .regex(/^[A-Za-z][A-Za-z0-9 ._-]*$/, "Invalid agent name");

export const CommsMessageSchema = z.object({
  ts: z.string().datetime(),
  author: AgentNameSchema,
  recipient: AgentNameSchema,
  task_id: z.string().trim().min(1).max(TASK_ID_MAX).optional(),
  status: CommsStatusSchema,
  body: z.string().trim().min(1).max(BODY_MAX),
});

export type CommsMessage = z.infer<typeof CommsMessageSchema>;

export const CommsPostInputSchema = z.object({
  author: AgentNameSchema,
  recipient: AgentNameSchema,
  task_id: z.string().trim().min(1).max(TASK_ID_MAX).optional(),
  status: CommsStatusSchema,
  body: z.string().trim().min(1).max(BODY_MAX),
});

export type CommsPostInput = z.infer<typeof CommsPostInputSchema>;

export const CommsReadFilterSchema = z.object({
  task_id: z.string().trim().min(1).max(TASK_ID_MAX).optional(),
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export type CommsReadFilter = z.infer<typeof CommsReadFilterSchema>;

export const COMMS_JSONL_FILE = "comms.jsonl";
export const COMMS_MARKDOWN_RELATIVE = "COMMS-CLAUDE-GROK.md";

export function formatCommsMarkdownStamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid ISO timestamp for comms markdown stamp");
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}`;
}

export function formatCommsMarkdownEntry(message: CommsMessage): string {
  const stamp = formatCommsMarkdownStamp(message.ts);
  const header = `### [${stamp}] ${message.author} → ${message.recipient} · [${message.status}]`;
  return `${header}\n\n${message.body}\n\n---\n`;
}
