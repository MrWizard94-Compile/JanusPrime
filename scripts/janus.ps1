#!/usr/bin/env pwsh
# Canonical JanusPrime CLI wrapper — use when global npm janus shim is stale.
$JanusRoot = Split-Path $PSScriptRoot -Parent
$Bin = Join-Path $JanusRoot "Project-Janus\packages\cli\dist\bin.js"
if (-not (Test-Path $Bin)) {
    Write-Error "Janus CLI not built. Run: pnpm run build (in Project-Janus/)"
    exit 1
}
& node $Bin @args
exit $LASTEXITCODE