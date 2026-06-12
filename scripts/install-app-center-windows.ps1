Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RepoRoot
$env:NODE_ENV = "development"
$env:NPM_CONFIG_REGISTRY = "https://registry.npmjs.org/"
$env:NPM_CONFIG_AUDIT = "false"
$env:NPM_CONFIG_FUND = "false"

function Invoke-Checked([string]$File, [string[]]$Arguments) {
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$File $($Arguments -join ' ') failed with exit code $LASTEXITCODE" }
}
function Refresh-Path {
  $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $user = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machine;$user"
}
function Ensure-Node {
  Refresh-Path
  $major = 0
  try { $major = [int](node -p "process.versions.node.split('.')[0]" 2>$null) } catch {}
  if ((Get-Command node -ErrorAction SilentlyContinue) -and (Get-Command npm -ErrorAction SilentlyContinue) -and $major -ge 20) {
    Write-Host "Node: $(node --version)"
    Write-Host "npm:  $(npm --version)"
    return
  }
  Write-Host "Node.js 20+ is required. Attempting winget install..." -ForegroundColor Yellow
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    Invoke-Checked "winget" @("install", "--id", "OpenJS.NodeJS.LTS", "-e", "--accept-source-agreements", "--accept-package-agreements")
    Refresh-Path
  }
  $major = 0
  try { $major = [int](node -p "process.versions.node.split('.')[0]" 2>$null) } catch {}
  if (-not ((Get-Command node -ErrorAction SilentlyContinue) -and (Get-Command npm -ErrorAction SilentlyContinue) -and $major -ge 20)) {
    try { Start-Process "https://nodejs.org/" } catch {}
    throw "Install Node.js 20+ or 24 LTS, open a new terminal, then run INSTALL.bat again."
  }
}

Write-Host "============================================================"
Write-Host " Echo App Center - Windows app installer builder"
Write-Host "============================================================"
Ensure-Node
try { npm config delete production --location=project 2>$null | Out-Null } catch {}
npm config set registry https://registry.npmjs.org/ --location=project | Out-Null

if ((Test-Path "node_modules") -and ((Test-Path "node_modules\.bin\electron-builder.cmd") -or (Test-Path "node_modules\.bin\electron-builder"))) {
  Write-Host "Dependencies already installed. Skipping npm install."
} else {
  Write-Host "Installing dependencies from npm..."
  Invoke-Checked "npm" @("install", "--include=dev", "--no-audit", "--no-fund", "--registry", "https://registry.npmjs.org/")
}

Write-Host "Running final checks..."
Invoke-Checked "npm" @("run", "final-check")
Write-Host "Building the Windows .exe installer. This can take several minutes the first time."
Invoke-Checked "npm" @("run", "package:windows")

$installer = Get-ChildItem -Path "release" -Filter "*.exe" -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $installer) { throw "No installer .exe was created in release/." }
Write-Host "Starting installer: $($installer.FullName)"
Write-Host "The installer will ask where to install Echo App Center and will add it to Windows apps."
Start-Process -FilePath $installer.FullName -Wait
Write-Host "Echo App Center installer finished."
