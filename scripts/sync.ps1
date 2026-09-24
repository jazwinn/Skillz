<#
.SYNOPSIS
  Bring this machine in line with the Skillz marketplace.

.DESCRIPTION
  Pulls the repo, registers the marketplaces, installs every plugin,
  merges shared settings into ~/.claude/settings.json, and installs
  npm dependencies for bundled skills. Safe to re-run.

.EXAMPLE
  pwsh -File scripts/sync.ps1
  pwsh -File scripts/sync.ps1 -NoPull -DryRunSettings
#>
[CmdletBinding()]
param(
  [switch]$NoPull,
  [switch]$DryRunSettings
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$failures = @()

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  ! $msg" -ForegroundColor Yellow }

# Run a claude CLI command, tolerating failure. Returns $true on success.
function Invoke-Claude([string[]]$ClaudeArgs) {
  $output = & claude @ClaudeArgs 2>&1
  if ($LASTEXITCODE -eq 0) { return $true }
  Write-Warn ("claude " + ($ClaudeArgs -join ' ') + " failed:")
  $output | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
  return $false
}

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
  throw "The 'claude' CLI is not on PATH. Install Claude Code first."
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is not on PATH. It is required to merge settings."
}

# --- 1. Pull -----------------------------------------------------------------
if (-not $NoPull) {
  Write-Step "Pulling latest from git"
  Push-Location $repoRoot
  try {
    $hasRemote = @(& git remote).Count -gt 0
    if (-not $hasRemote) {
      Write-Warn "no git remote configured; skipping pull"
    } elseif ((& git status --porcelain)) {
      Write-Warn "working tree has local changes; skipping pull (commit or stash first)"
    } else {
      & git pull --ff-only
      if ($LASTEXITCODE -eq 0) { Write-Ok "up to date" } else { Write-Warn "git pull failed"; $failures += 'git pull' }
    }
  } finally { Pop-Location }
}

# --- 2. Marketplaces ---------------------------------------------------------
$upstream = Get-Content (Join-Path $repoRoot 'config/upstream.json') -Raw | ConvertFrom-Json
$marketplace = Get-Content (Join-Path $repoRoot '.claude-plugin/marketplace.json') -Raw | ConvertFrom-Json

Write-Step "Registering marketplaces"
$sources = @()
foreach ($m in $upstream.marketplaces) { $sources += [pscustomobject]@{ Name = $m.name; Source = $m.source } }
$sources += [pscustomobject]@{ Name = $marketplace.name; Source = $repoRoot }

foreach ($s in $sources) {
  if (Invoke-Claude @('plugin', 'marketplace', 'add', $s.Source)) {
    Write-Ok "added $($s.Name)"
  } else {
    # Most likely already registered - refresh it instead.
    if (Invoke-Claude @('plugin', 'marketplace', 'update', $s.Name)) {
      Write-Ok "updated $($s.Name)"
    } else {
      $failures += "marketplace $($s.Name)"
    }
  }
}

# --- 3. Plugins --------------------------------------------------------------
Write-Step "Installing plugins"
$pluginIds = @()
foreach ($p in $upstream.plugins) { $pluginIds += $p }
foreach ($p in $marketplace.plugins) { $pluginIds += "$($p.name)@$($marketplace.name)" }

# 'plugin install' is a no-op once a plugin is installed, so an edited plugin
# never reaches ~/.claude/plugins/cache. Always follow it with 'plugin update',
# which re-copies when plugin.json carries a new version.
foreach ($id in $pluginIds) {
  if (Invoke-Claude @('plugin', 'install', $id, '--scope', 'user')) {
    if (Invoke-Claude @('plugin', 'update', $id, '--scope', 'user')) {
      Write-Ok "installed $id"
    } else {
      Write-Warn "installed $id, but the update check failed"
      $failures += "update $id"
    }
  } else {
    $failures += "install $id"
  }
}

# --- 4. Settings -------------------------------------------------------------
Write-Step "Merging shared settings"
$mergeArgs = @((Join-Path $repoRoot 'scripts/merge-settings.mjs'))
if ($DryRunSettings) { $mergeArgs += '--dry-run' }
& node @mergeArgs
if ($LASTEXITCODE -ne 0) { $failures += 'merge-settings' }

# --- 5. Skill dependencies ---------------------------------------------------
Write-Step "Installing skill dependencies"
& node (Join-Path $repoRoot 'scripts/install-deps.mjs')
if ($LASTEXITCODE -ne 0) { $failures += 'install-deps' }

# --- Done --------------------------------------------------------------------
Write-Host ''
if ($failures.Count -gt 0) {
  Write-Host "Finished with $($failures.Count) problem(s):" -ForegroundColor Yellow
  $failures | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
  exit 1
}
Write-Host "Sync complete. Restart Claude Code to load the changes." -ForegroundColor Green
