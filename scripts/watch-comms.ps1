# Forwards to watch-comms.py (canonical watcher).
$py = Join-Path $PSScriptRoot "watch-comms.py"
if (-not (Test-Path $py)) {
    Write-Error "Missing $py"
    exit 1
}
& python $py @args
exit $LASTEXITCODE