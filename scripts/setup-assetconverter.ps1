# Lightweight AssetConverter setup via sparse git clone.
# Fast-path: skip if pipeline already present.

$ErrorActionPreference = "Stop"
$JanusRoot = Split-Path -Parent $PSScriptRoot
$Target = Join-Path $JanusRoot "AssetConverter-sparse"
$Repo = "https://github.com/MrWizard94-Compile/AssetConverter.git"
$SparsePaths = @(
    "/ac.py",
    "/config",
    "/pipeline",
    "/scripts",
    "/docs",
    "/data",
    "/references",
    "/README.md",
    "/.gitignore",
    "/.gitattributes"
)

function Test-PipelineReady {
    param([string]$Root)
    return (
        (Test-Path (Join-Path $Root "ac.py")) -and
        (Test-Path (Join-Path $Root "pipeline\engine.py"))
    )
}

Write-Host "[*] Janus AssetConverter sparse setup"
Write-Host "    Target: $Target"

if (Test-PipelineReady -Root $Target) {
    Write-Host "[+] Pipeline already present - nothing to do"
    Write-Host "    Janus config points to AssetConverter-sparse"
    exit 0
}

$lockPath = Join-Path $Target ".git\index.lock"
if (Test-Path $lockPath) {
    Remove-Item $lockPath -Force -ErrorAction SilentlyContinue
}

function Configure-SparseCheckout {
    param([string]$RepoPath)
    Set-Location $RepoPath
    git config core.longpaths true
    git sparse-checkout init --no-cone
    git sparse-checkout set @SparsePaths
}

if (Test-Path (Join-Path $Target ".git")) {
    Write-Host "[*] Existing sparse repo - refreshing checkout"
    Configure-SparseCheckout -RepoPath $Target
    if (Test-PipelineReady -Root $Target) {
        Write-Host "[+] Sparse checkout refreshed"
        exit 0
    }
    Write-Host "[!] Sparse refresh incomplete - re-cloning"
}

Write-Host "[*] Fresh sparse clone"
Set-Location $JanusRoot

if (Test-Path $Target) {
    Remove-Item $Target -Recurse -Force
}

git clone --filter=blob:none --sparse --depth 1 $Repo $Target
Configure-SparseCheckout -RepoPath $Target

if (-not (Test-PipelineReady -Root $Target)) {
    throw "AssetConverter sparse setup failed - pipeline files missing"
}

Write-Host "[+] AssetConverter-sparse ready"
Write-Host "    Delete AssetConverter/ (failed full clone) to reclaim disk space"