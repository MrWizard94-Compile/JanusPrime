# Janus Comms Watcher - polls for new posts from orchestrator (Claude/Corwin) and outputs notifications
# Run via monitor tool for continuous background watching

param()

$ErrorActionPreference = 'Continue'

$cli = $env:JANUS_CLI
if (-not $cli) {
  $cli = 'node "C:\WPAI\AI-Research\Janus\Project-Janus\packages\cli\dist\bin.js"'
}

$lastFile = "$env:TEMP\janus-comms-watcher-last.txt"
if (-not (Test-Path $lastFile)) {
  (Get-Date).AddHours(-1).ToString("o") | Out-File -FilePath $lastFile -Encoding utf8
}

$lastTs = Get-Content -Path $lastFile -Raw -ErrorAction SilentlyContinue
if (-not $lastTs) { $lastTs = (Get-Date).AddHours(-1).ToString("o") }

Write-Output "Janus comms watcher started. Monitoring for orchestrator posts (author not containing 'Grok'). Polling every 30s."

while ($true) {
  try {
    $cmd = "$cli janus comms read --limit 20 --since `"$lastTs`""
    $rawOutput = Invoke-Expression $cmd 2>&1 | Out-String

    if ($rawOutput -match '^\s*\{') {
      $data = $rawOutput | ConvertFrom-Json -ErrorAction SilentlyContinue

      if ($data -and $data.messages) {
        $messages = $data.messages | Where-Object { $_.ts -and $_.author -and $_.ts -gt $lastTs }

        $orchestratorPosts = $messages | Where-Object { $_.author -notmatch 'Grok' }

        if ($orchestratorPosts) {
          foreach ($msg in ($orchestratorPosts | Sort-Object ts)) {
            $notification = "ORCHESTRATOR POST: [$( $msg.status )] from $( $msg.author ) at $( $msg.ts ) (task: $( $msg.task_id ))`n$( $msg.body )"
            Write-Output $notification
            # Update last even for non-orchestrator to advance
          }
        }

        # Always advance to the latest seen ts to avoid reprocessing
        $latest = ($messages | Sort-Object ts -Descending | Select-Object -First 1).ts
        if ($latest -and $latest -gt $lastTs) {
          $lastTs = $latest
          $lastTs | Out-File -FilePath $lastFile -Encoding utf8
        }
      }
    } elseif ($rawOutput -match 'error|Error') {
      Write-Output "Watcher read error: $rawOutput"
    }
  } catch {
    Write-Output "Watcher exception: $($_.Exception.Message)"
  }

  Start-Sleep -Seconds 30
}
