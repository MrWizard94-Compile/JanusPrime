# Ollama API — reference for the Qwen executor

Source: https://github.com/ollama/ollama/blob/main/docs/api.md (fetched 2026-06-21)
Local endpoint (docker-compose `ollama` service): `http://localhost:11434`
Default model already wired in `docker-compose.yml`: `qwen2.5-coder:7b`

## POST /api/chat (non-streaming, structured)

Request:
```json
{
  "model": "qwen2.5-coder:7b",
  "stream": false,
  "messages": [
    { "role": "system", "content": "<doctrine + output contract>" },
    { "role": "user",   "content": "<unified brief / repair context>" }
  ],
  "format": { "<JSON schema object>": "..." },
  "options": { "temperature": 0.1, "num_ctx": 16384 }
}
```

- `format` accepts either the string `"json"` (free JSON, model must be told the shape)
  or a **JSON Schema object** — Ollama constrains decoding to that schema. We use the
  schema form so qwen MUST return a valid `PatchProposal`.
- `options.num_ctx` — context window in tokens. qwen2.5-coder:7b supports up to 32768;
  we set 16384 to fit brief + repair context without thrashing VRAM.
- `options.temperature` — keep low (0.1) for deterministic code edits.
- `stream:false` → single JSON response object.

Response (non-streaming):
```json
{
  "model": "qwen2.5-coder:7b",
  "message": { "role": "assistant", "content": "<the JSON string matching format>" },
  "done": true,
  "total_duration": 123, "eval_count": 456, "prompt_eval_count": 789
}
```
`message.content` is a STRING containing JSON when `format` is set — parse it again.

## GET /api/tags
Lists locally pulled models. Used by the executor's preflight to verify
`qwen2.5-coder:7b` is present before dispatch; if absent → actionable error
(pull it: `docker exec janusprime-ollama ollama pull qwen2.5-coder:7b`).

## POST /api/pull
`{ "model": "qwen2.5-coder:7b", "stream": false }` — downloads the model.
Used by `janus executor pull` convenience command.

## Output contract for the executor

qwen is constrained to this schema (mirrors `PatchProposalSchema` minus task_id,
which the executor injects):
```json
{
  "type": "object",
  "properties": {
    "summary": { "type": "string" },
    "files": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": { "path": {"type":"string"}, "content": {"type":"string"} },
        "required": ["path", "content"]
      }
    },
    "deleted_paths": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["summary", "files"]
}
```
Files carry FULL file content (not diffs) — 7B models are unreliable at unified
diff hunks, and `PatchProposal.files` already model whole-file content, so the
gate's apply step is a direct write. `summary` is qwen's natural-language note
back to Claude for the final-review step.
```
