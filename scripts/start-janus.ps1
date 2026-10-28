<#
.SYNOPSIS
  Fire up JanusPrime + prepare the orchestrator (Claude) for work.

.DESCRIPTION
  One-shot bootstrap that runs the CLAUDE.md §9 checklist:
    1. Bring up Janus services (Smart-Library memory + Ollama + REL cognition) via docker compose.
    2. Verify the unified system (janus status): memory, assets, cognition.
    3. Gate-infra pre-flight (janus janus doctor): LSP, build scripts, pnpm workspace, profiles.
    4. Doctrine freshness (janus doctrine status); auto-seed if stale.
    5. Print an orchestrator-ready banner with task rollup and the role boundary.

  Read-only and idempotent. Performs NO executor work (no gradlew, no janus execute) —
  the orchestrator delegates execution via `janus brief` + the validation gate.

.PARAMETER SkipDocker
  Skip the docker compose step (use when services are managed externally).

.EXAMPLE
  pwsh -File C:\WPAI\AI-Research\Janus\scripts\start-janus.ps1
#>
[CmdletBinding()]
param(
  [switch]$SkipDocker
)

$ErrorActionPreference = "Stop"
$JanusRoot = "C:\WPAI\AI-Research\Janus"
$compose = Join-Path $JanusRoot "docker-compose.yml"

function Write-Section($text) { Write-Host "`n=== $text ===" -ForegroundColor Cyan }
function Write-Ok($text)      { Write-Host "  [OK]   $text" -ForegroundColor Green }
function Write-Warn2($text)   { Write-Host "  [WARN] $text" -ForegroundColor Yellow }
function Write-Err2($text)    { Write-Host "  [FAIL] $text" -ForegroundColor Red }

function Test-Cmd($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

Write-Host "JanusPrime bootstrap — orchestrator prep" -ForegroundColor Magenta
Write-Host "Workspace: $JanusRoot"

if (-not (Test-Cmd "janus")) {
  Write-Err2 "janus CLI not found on PATH. Build/link it: pnpm -C $JanusRoot\Project-Janus -r run build"
  exit 1
}

# 1. Services -----------------------------------------------------------------
Write-Section "1. Services (docker compose)"
if ($SkipDocker) {
  Write-Warn2 "Skipped (--SkipDocker)."
} elseif (-not (Test-Path $compose)) {
  Write-Warn2 "No docker-compose.yml at $compose — skipping service bring-up."
} elseif (-not (Test-Cmd "docker")) {
  Write-Warn2 "docker not on PATH — skipping. Start Smart-Library/Ollama/REL manually if needed."
} else {
  $dockerUp = $true
  try { docker info *> $null } catch { $dockerUp = $false }
  if (-not $dockerUp) {
    Write-Warn2 "Docker daemon not reachable — skipping service bring-up."
  } else {
    try {
      docker compose -f $compose up -d 2>&1 | Out-Null
      Write-Ok "docker compose up -d (memory + ollama + cognition)"
    } catch {
      Write-Warn2 "docker compose up failed: $($_.Exception.Message)"
    }
  }
}

# 2. System status ------------------------------------------------------------
Write-Section "2. Unified status (janus status)"
$status = $null
try {
  $raw = janus status 2>&1 | Out-String
  $status = $raw | ConvertFrom-Json
} catch {
  Write-Err2 "janus status failed to parse. Raw:`n$raw"
  exit 1
}

$mem = $status.memory.status
$assets = $status.assets.queue_available
$cog = $status.cognition.status
if ($mem -eq "ok") { Write-Ok "memory: $mem" } else { Write-Warn2 "memory: $mem" }
if ($assets)       { Write-Ok "assets: queue available" } else { Write-Warn2 "assets: queue unavailable" }
if ($cog -eq "ok"){ Write-Ok "cognition (REL): $cog" } else { Write-Warn2 "cognition: $cog" }

# 3. Gate-infra doctor --------------------------------------------------------
Write-Section "3. Gate-infra pre-flight (janus janus doctor)"
try {
  $doctor = (janus janus doctor 2>&1 | Out-String) | ConvertFrom-Json
  if ($doctor.ok) {
    Write-Ok "gate infra healthy ($($doctor.checks.Count) checks)"
  } else {
    foreach ($c in $doctor.checks) {
      if (-not $c.ok) { Write-Err2 "$($c.name): $($c.detail)" }
    }
  }
} catch {
  Write-Warn2 "doctor failed: $($_.Exception.Message)"
}

# 4. Doctrine freshness -------------------------------------------------------
Write-Section "4. Doctrine (janus doctrine status)"
try {
  $doc = (janus doctrine status 2>&1 | Out-String) | ConvertFrom-Json
  if ($doc.fresh) {
    Write-Ok "doctrine fresh (hash $($doc.content_hash.Substring(0,12)), $($doc.stored_count) records)"
  } else {
    Write-Warn2 "doctrine stale — seeding..."
    janus doctrine seed 2>&1 | Out-Null
    $doc2 = (janus doctrine status 2>&1 | Out-String) | ConvertFrom-Json
    if ($doc2.fresh) { Write-Ok "doctrine re-seeded -> fresh" } else { Write-Err2 "doctrine still stale after seed" }
  }
} catch {
  Write-Warn2 "doctrine check failed: $($_.Exception.Message)"
}

# 5. Ready banner -------------------------------------------------------------
Write-Section "5. Orchestrator ready"
if ($status.tasks) {
  $t = $status.tasks
  $by = $t.by_status
  $parts = @()
  foreach ($p in $by.PSObject.Properties) { $parts += "$($p.Name)=$($p.Value)" }
  Write-Host "  Tasks: $($t.total) total ($($parts -join ', '))"
  if ($by.failed) { Write-Warn2 "$($by.failed) failed task(s) — triage candidates for `janus repair`." }
}

Write-Host ""
Write-Host "  ROLE: Orchestrator (Claude). Own architecture, decompose, brief, review rollups." -ForegroundColor Magenta
Write-Host "  Delegate execution to the executor via `janus brief` + the validation gate." -ForegroundColor Magenta
Write-Host "  Role guards active (.claude/settings.json): workload edits + gate/build commands are blocked." -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Next: review pending briefs, decompose new work, or pull a rollup with `janus task show <id>`." -ForegroundColor Gray
Write-Host "JanusPrime ready." -ForegroundColor Green
