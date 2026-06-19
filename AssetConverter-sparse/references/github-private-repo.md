# Make `MrWizard94-Compile/AssetConverter` Private (Windows, no `gh` CLI)

Research date: 2026-06-19  
Workspace: `C:\Users\Bulkl\OneDrive\Desktop\AssetConverter`

## Current state (verified on this machine)

| Check | Result |
|-------|--------|
| Remote | `https://github.com/MrWizard94-Compile/AssetConverter.git` |
| Visibility | **public** (`"private": false`, `"visibility": "public"`) |
| Your permission | **admin** (authenticated API check) |
| `$env:GITHUB_TOKEN` | **not set** |
| `$env:GH_TOKEN` | **not set** |
| Git credential helper | `manager` (Git Credential Manager) |
| Windows stored creds | `git:https://github.com` and `copilot-cli/https://github.com:MrWizard94-Compile` |
| `git credential fill` | **works** — returns username `MrWizard94-Compile` and a GitHub OAuth token |
| `curl.exe` | available (`curl 8.19.0`) |
| `git lfs` | installed (`git-lfs/3.7.1`) |

**Important:** Plain `git push` / `git pull` cannot change repository visibility. Visibility is a GitHub server setting and must be changed via the **GitHub REST API** or the **GitHub website**.

---

## Method 1 (recommended): `curl.exe` + token from Git Credential Manager

This machine already has a working GitHub token in Windows Credential Manager. You do **not** need `gh` CLI.

### PowerShell: one-shot script

Run from any directory in PowerShell. Uses `curl.exe` (not PowerShell's `curl` alias).

```powershell
# 1) Pull token from Git Credential Manager (does not print token if you only use $token)
$credText = @"
protocol=https
host=github.com

"@ | git credential fill

$token = ($credText | Select-String '^password=').ToString().Substring(9)

# 2) Make the repo private
curl.exe -s -X PATCH `
  -H "Authorization: Bearer $token" `
  -H "Accept: application/vnd.github+json" `
  -H "X-GitHub-Api-Version: 2022-11-28" `
  -H "Content-Type: application/json" `
  -d "{\"private\":true,\"visibility\":\"private\"}" `
  https://api.github.com/repos/MrWizard94-Compile/AssetConverter

# 3) Verify
curl.exe -s -H "Authorization: Bearer $token" `
  -H "Accept: application/vnd.github+json" `
  https://api.github.com/repos/MrWizard94-Compile/AssetConverter `
  | Select-String '"private"|"visibility"'
```

Expected verify output after success:

```text
  "private": true,
  "visibility": "private",
```

### API details

- **Endpoint:** `PATCH https://api.github.com/repos/MrWizard94-Compile/AssetConverter`
- **Body:** `{"private": true, "visibility": "private"}`
- **Auth header:** `Authorization: Bearer <TOKEN>`
- **Required token scope:** classic PAT with `repo`, or fine-grained PAT with **Administration: Read and write** on this repository

### Unauthenticated PATCH (for reference)

Without a token, the API rejects the request (401 Unauthorized). Confirmed on this machine.

```powershell
curl.exe -s -X PATCH `
  -H "Accept: application/vnd.github+json" `
  -H "Content-Type: application/json" `
  -d "{\"private\":true}" `
  https://api.github.com/repos/MrWizard94-Compile/AssetConverter
```

---

## Method 2: `curl.exe` + explicit `GITHUB_TOKEN` env var

Use this if you prefer a PAT you control, or if `git credential fill` stops working.

### Create a token (GitHub website)

1. Open: https://github.com/settings/tokens
2. **Fine-grained token (recommended):**
   - Resource owner: `MrWizard94-Compile`
   - Repository access: **Only select repositories** → `AssetConverter`
   - Permissions → **Administration: Read and write**
3. **Classic token (alternative):**
   - Enable scope: **`repo`** (full control of private repositories)

### Set token for current PowerShell session only

```powershell
$env:GITHUB_TOKEN = "ghp_your_token_here"   # or github_pat_... for fine-grained

curl.exe -s -X PATCH `
  -H "Authorization: Bearer $env:GITHUB_TOKEN" `
  -H "Accept: application/vnd.github+json" `
  -H "X-GitHub-Api-Version: 2022-11-28" `
  -H "Content-Type: application/json" `
  -d "{\"private\":true,\"visibility\":\"private\"}" `
  https://api.github.com/repos/MrWizard94-Compile/AssetConverter
```

To persist for future terminals (optional):

```powershell
[System.Environment]::SetEnvironmentVariable("GITHUB_TOKEN", "ghp_your_token_here", "User")
```

Restart PowerShell after setting a user-level env var.

---

## Method 3: PowerShell `Invoke-RestMethod` (no `curl`)

```powershell
$credText = @"
protocol=https
host=github.com

"@ | git credential fill
$token = ($credText | Select-String '^password=').ToString().Substring(9)

$headers = @{
  Authorization = "Bearer $token"
  Accept        = "application/vnd.github+json"
}

$body = @{
  private    = $true
  visibility = "private"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method PATCH `
  -Uri "https://api.github.com/repos/MrWizard94-Compile/AssetConverter" `
  -Headers $headers `
  -Body $body `
  -ContentType "application/json"
```

---

## Method 4: GitHub website (no API)

1. Open https://github.com/MrWizard94-Compile/AssetConverter
2. **Settings** → **General**
3. Scroll to **Danger Zone**
4. **Change repository visibility** → **Make private**
5. Confirm repository name: `MrWizard94-Compile/AssetConverter`

---

## What does **not** work

| Approach | Why it fails |
|----------|--------------|
| `git remote set-url` | Only changes clone URL, not visibility |
| `git config` | No Git setting controls GitHub repo visibility |
| `git push` alone | Pushes commits only; cannot flip public/private |
| PowerShell `curl` alias | Maps to `Invoke-WebRequest`; use **`curl.exe`** instead |
| Unauthenticated API PATCH | Returns 401 without Bearer token |

---

## After making the repo private

Existing remotes keep working if you are authenticated:

```powershell
git remote -v
# origin  https://github.com/MrWizard94-Compile/AssetConverter.git

git fetch origin
git push origin main
```

If clone/fetch fails with 404 or auth errors:

1. Confirm you are logged in as `MrWizard94-Compile` in Git Credential Manager
2. Re-run `git credential fill` test (see Troubleshooting)
3. Or switch remote to SSH: `git@github.com:MrWizard94-Compile/AssetConverter.git`

---

## Troubleshooting

### Test stored GitHub credentials

```powershell
@"
protocol=https
host=github.com

"@ | git credential fill
```

You should see `username=MrWizard94-Compile` and a `password=` line (token).  
**Do not paste tokens into chat, logs, or commit them.**

### Test token validity

```powershell
$credText = @"
protocol=https
host=github.com

"@ | git credential fill
$token = ($credText | Select-String '^password=').ToString().Substring(9)
curl.exe -s -o NUL -w "HTTP %{http_code}`n" -H "Authorization: Bearer $token" https://api.github.com/user
```

Expected: `HTTP 200`

### Common API errors

| HTTP | Meaning | Fix |
|------|---------|-----|
| 401 | Bad/missing token | Refresh creds in Windows Credential Manager or create new PAT |
| 403 | Token lacks `repo` / Administration permission | Regenerate token with correct scopes |
| 404 | Repo not found or no access | Confirm owner/repo name and account login |

### View / refresh credentials in Windows

```powershell
cmdkey /list | Select-String -Pattern "git|github" -CaseSensitive:$false
```

Remove stale entry (if needed):

```powershell
cmdkey /delete:LegacyGeneric:target=git:https://github.com
```

Next `git fetch` or `git credential fill` will prompt for re-authentication.

---

## Recommended `.gitattributes` for large PNG / image repos

This repo currently tracks only selected root files (see `.gitignore`). When you start committing many textures or upscaled PNGs, add a root `.gitattributes` like below.

### Baseline (no Git LFS) — good for smaller PNG sets

```gitattributes
# Treat images as binary (no textual diff/merge)
*.png  binary
*.jpg  binary
*.jpeg binary
*.webp binary
*.gif  binary
*.tga  binary
*.bmp  binary
*.psd  binary
*.ico  binary

# Optional: normalize line endings for text files only
*.py   text eol=lf
*.md   text eol=lf
*.json text eol=lf
*.yml  text eol=lf
*.yaml text eol=lf
```

Why `binary`:

- Prevents Git from corrupting image bytes with line-ending conversion
- Skips useless text diffs on PNG data
- Keeps `git grep` and merge behavior sane for assets

### Optional Git LFS track (recommended when PNGs are large or numerous)

GitHub hard-limits single files to **100 MB**. LFS also keeps clone size manageable when you have thousands of textures.

`git-lfs` is already installed on this machine (`3.7.1`).

```powershell
cd C:\Users\Bulkl\OneDrive\Desktop\AssetConverter
git lfs install
git lfs track "*.png"
git lfs track "*.psd"
# Optional larger formats:
# git lfs track "*.tga"
```

That creates/updates `.gitattributes` entries like:

```gitattributes
*.png filter=lfs diff=lfs merge=lfs -text
*.psd filter=lfs diff=lfs merge=lfs -text
```

Then commit both files:

```powershell
git add .gitattributes
git commit -m "Track large image assets with Git LFS"
```

### When to use LFS vs plain Git for PNGs

| Situation | Recommendation |
|-----------|----------------|
| A few small PNGs (< 1–5 MB each) | `binary` only, no LFS |
| Hundreds/thousands of PNGs | **Git LFS** |
| Individual files approaching 50–100 MB | **Git LFS** (required before 100 MB limit) |
| Generated/cache output you can rebuild | Keep in `.gitignore` instead of LFS |

### Suggested ignore rules for generated assets (this project)

If upscaled outputs are reproducible, prefer ignoring them and only versioning scripts/config:

```gitignore
# Generated / cache image outputs (adjust paths to your pipeline)
output/
**/output/
*_upscaled/
*.tmp.png
```

Keep source art in Git (or LFS) only when it is canonical and not reproducible from scripts.

---

## Security notes

1. Never commit tokens to the repository.
2. Prefer session-only `$env:GITHUB_TOKEN` over hard-coding in scripts.
3. Fine-grained PATs with repo-only access are safer than classic broad `repo` tokens.
4. If a token is ever exposed in a terminal log or chat, **revoke it immediately** at https://github.com/settings/tokens and re-authenticate Git Credential Manager.

---

## Quick reference (copy/paste)

**Make private (uses stored GCM token):**

```powershell
$credText = @"`nprotocol=https`nhost=github.com`n`n"@ | git credential fill
$token = ($credText | Select-String '^password=').ToString().Substring(9)
curl.exe -s -X PATCH -H "Authorization: Bearer $token" -H "Accept: application/vnd.github+json" -H "Content-Type: application/json" -d "{\"private\":true,\"visibility\":\"private\"}" https://api.github.com/repos/MrWizard94-Compile/AssetConverter
```

**Check visibility (public, no auth):**

```powershell
curl.exe -s https://api.github.com/repos/MrWizard94-Compile/AssetConverter | Select-String '"private"|"visibility"'
```