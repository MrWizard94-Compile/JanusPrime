<#
.SYNOPSIS
  Initialize/dispatch the JanusPrime executor on a task. Grok primary, Qwen2.5-coder:7b fallback.

.DESCRIPTION
  Orchestrator delegation tool. Given a task id, it:
    1. Builds the token-capped executor brief (`janus brief -t <id>`).
    2. Composes an executor prompt (EXECUTOR.md role preamble + brief + gate contract).
    3. Dispatches the PRIMARY executor — Grok CLI, headless, agentic, operating the
       validation gate itself per EXECUTOR.md.
    4. On Grok unavailability/failure, dispatches the FALLBACK executor — the Janus
       Qwen2.5-coder:7b agent (Ollama /v1 tool-loop -> gate).

  This is the orchestrator's *delegation* surface — it spawns the executor; it does not
  itself author patches. Executor selection + endpoints come from janus.config.json `executor`.

.PARAMETER TaskId
  The task id to dispatch (e.g. task-aceef6df-...).

.PARAMETER Executor
  Force a specific executor: grok | qwen | auto (default: auto = primary then fallback).

.PARAMETER DryRun
  Build the brief + prompt and print the dispatch plan without launching an executor.

.EXAMPLE
  pwsh -File scripts\dispatch-executor.ps1 -TaskId task-aceef6df-77d5-45cc-9705-db3a072becf2
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$TaskId,
  [ValidateSet("auto", "grok", "qwen")][string]$Executor = "auto",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$JanusRoot = "C:\WPAI\AI-Research\Janus"
$JanusCli  = "node `"$JanusRoot\Project-Janus\packages\cli\dist\bin.js`""
$configPath = Join-Path $JanusRoot "janus.config.json"

function Write-Step($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }
function Write-Ok($t)   { Write-Host "  [OK]   $t" -ForegroundColor Green }
function Write-Warn2($t){ Write-Host "  [WARN] $t" -ForegroundColor Yellow }
function Write-Err2($t) { Write-Host "  [FAIL] $t" -ForegroundColor Red }

$cfg = (Get-Content $configPath -Raw | ConvertFrom-Json).executor
if (-not $cfg) { Write-Err2 "No `executor` block in janus.config.json"; exit 1 }

# 1. Brief --------------------------------------------------------------------
Write-Step "1. Build brief ($TaskId)"
$briefRaw = & cmd /c "node `"$JanusRoot\Project-Janus\packages\cli\dist\bin.js`" brief -t $TaskId 2>&1"
try { $brief = $briefRaw | ConvertFrom-Json } catch {
  Write-Err2 "brief failed: $briefRaw"; exit 1
}
$workspace = $brief.workspace_root
if (-not $workspace) { $workspace = $JanusRoot }
Write-Ok "brief ready ($($brief.token_estimate_chars) chars) | workspace: $workspace"

# 2. Compose executor prompt --------------------------------------------------
Write-Step "2. Compose executor prompt"
$executorDoc = Join-Path $JanusRoot "EXECUTOR.md"
$preamble = if (Test-Path $executorDoc) { Get-Content $executorDoc -Raw } else { "" }
$promptDir = Join-Path $JanusRoot ".aether\dispatch"
New-Item -ItemType Directory -Force -Path $promptDir | Out-Null
$promptFile = Join-Path $promptDir "$TaskId.prompt.md"
$briefFile  = Join-Path $promptDir "$TaskId.brief.json"
$briefRaw | Out-File -FilePath $briefFile -Encoding utf8

$prompt = @"
You are the EXECUTOR for JanusPrime task $TaskId. Operate ONLY through the validation gate.

# Executor gate (EXECUTOR.md)
$preamble

# Your brief (authoritative work spec)
``````json
$briefRaw
``````

# Rules
- Set `$env:JANUS_CLI = "node $JanusRoot\Project-Janus\packages\cli\dist\bin.js"`.
- Do NOT hand-edit files outside the patch flow. Stage a patch, `aether patch submit -f patch.json` (dry-run), then `--apply` on pass. On failure, `& `$env:JANUS_CLI repair -t $TaskId`, revise, retry until pass or abandon with a clear reason in task.result.
- Warnings = failures. No stubs, TODOs, or suppressions.
- When done, append a terse [DONE]/[BLOCKED] entry for task $TaskId to COMMS-CLAUDE-GROK.md.
"@
$prompt | Out-File -FilePath $promptFile -Encoding utf8
Write-Ok "prompt -> $promptFile"

if ($DryRun) {
  Write-Step "DRY RUN — dispatch plan"
  Write-Host "  primary:  $($cfg.primary)  fallback: $($cfg.fallback)  (requested: $Executor)"
  Write-Host "  workspace: $workspace"
  exit 0
}

# 3. Executor availability ----------------------------------------------------
$grokModel = $cfg.providers.grok.model
if (-not $grokModel) { $grokModel = "grok-build" }

function Test-Grok {
  if (-not (Get-Command grok -ErrorAction SilentlyContinue)) { return $false }
  try {
    $ping = & grok -p "Reply with exactly: READY" -m $grokModel --output-format json --no-memory --disable-web-search 2>&1 | Out-String
    return ($ping -match '"text"\s*:\s*"READY"')
  } catch { return $false }
}
function Test-Qwen {
  try {
    $tags = Invoke-RestMethod -Uri "$($cfg.providers.qwen.base_url -replace '/v1$','')/api/tags" -TimeoutSec 8
    return [bool]($tags.models | Where-Object { $_.name -eq $cfg.providers.qwen.model })
  } catch { return $false }
}

# 4. Dispatch -----------------------------------------------------------------
function Invoke-Grok {
  Write-Step "Dispatch: GROK (primary, model $grokModel)"
  # Plain output (not --output-format json): JSON mode forces grok to serialize
  # every tool result as JSON, which throws tool_output_error on multi-line
  # read_file output during agentic runs. Plain streams tool output untouched.
  & grok --prompt-file "$promptFile" -m $grokModel --permission-mode bypassPermissions --cwd "$workspace" --no-alt-screen
  return $LASTEXITCODE
}
function Invoke-Qwen {
  Write-Step "Dispatch: QWEN (fallback)"
  # The Qwen agent (Ollama /v1 tool-loop -> gate) is delegated for implementation.
  # Wire-up point: `janus dispatch -t <id> --executor qwen` once that task lands.
  $qwenCli = & cmd /c "node `"$JanusRoot\Project-Janus\packages\cli\dist\bin.js`" dispatch --help 2>&1"
  if ($qwenCli -match "executor") {
    & cmd /c "node `"$JanusRoot\Project-Janus\packages\cli\dist\bin.js`" dispatch -t $TaskId --executor qwen"
    return $LASTEXITCODE
  }
  Write-Warn2 "Qwen fallback agent not yet implemented (delegated). Ollama model is reachable; brief at $briefFile."
  Write-Warn2 "Wire `janus dispatch --executor qwen` (Ollama /v1 tool-loop -> gate), then re-run."
  return 3
}

$order = switch ($Executor) {
  "grok" { @("grok") }
  "qwen" { @("qwen") }
  default { @($cfg.primary, $cfg.fallback) }
}

$rc = 1
foreach ($e in $order) {
  if ($e -eq "grok") {
    if (Test-Grok) { $rc = Invoke-Grok; if ($rc -eq 0) { break } else { Write-Warn2 "Grok dispatch returned $rc; trying next." } }
    else { Write-Warn2 "Grok unavailable (not on PATH or relay/auth down)." }
  } elseif ($e -eq "qwen") {
    if (Test-Qwen) { $rc = Invoke-Qwen; if ($rc -eq 0) { break } }
    else { Write-Warn2 "Qwen unavailable (Ollama $($cfg.providers.qwen.model) not reachable)." }
  }
}

Write-Step "Result"
if ($rc -eq 0) { Write-Ok "Executor dispatch complete for $TaskId. Review rollup: $JanusCli task show $TaskId" }
else { Write-Err2 "No executor completed the dispatch (rc=$rc). Brief preserved at $briefFile." }
exit $rc
