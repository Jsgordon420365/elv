# ver 20260714142500.4

$ErrorActionPreference = "Stop"
$webapp = Join-Path $PSScriptRoot "webapp"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js is not installed or is not available on PATH."
}

Push-Location $webapp
try {
    if (-not (Test-Path (Join-Path $webapp "node_modules"))) {
        Write-Host "Installing webapp dependencies..."
        npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE." }
    }
    node -e "const s=require('node:net').createServer();s.once('error',()=>process.exit(1));s.once('listening',()=>s.close(()=>process.exit(0)));s.listen(3004,'::')"
    if ($LASTEXITCODE -ne 0) {
        throw "ELV's fixed vault-origin port 3004 is already in use. If ELV is already running, open http://localhost:3004. Otherwise stop only the unrelated listener before retrying."
    }
    $env:NEXT_PUBLIC_DEMO_MODE = "1"
    Write-Host ""
    Write-Host "ELV LegalFlowNC fixed vault origin: http://localhost:3004" -ForegroundColor Cyan
    Write-Host "IMPORTANT: IndexedDB vaults are bound to the exact browser origin. Always use this URL." -ForegroundColor Yellow
    Write-Host "The development server will remain attached to this PowerShell window."
    Start-Process "http://localhost:3004"
    npm run dev -- -p 3004
    if ($LASTEXITCODE -ne 0) { throw "npm run dev failed with exit code $LASTEXITCODE." }
} finally {
    Pop-Location
}

# Version history
# 20260714142500.0 - Added PowerShell Node check, dependency install, demo environment, browser open, and Next.js startup.
# 20260714142500.1 - Added a non-destructive exact-port check and forced the required port instead of silently moving to another app URL.
# 20260714142500.2 - Replaced the slow Windows listener query with a bounded Node.js bind probe.
# 20260714142500.3 - Probed Next.js's IPv6 bind address used on this Windows host.
# 20260714142500.4 - Fixed ELV to port 3004 so IndexedDB vault records do not appear lost through silent origin changes.
