REM ver 20260714142500.4
@echo off
setlocal
cd /d "%~dp0webapp"
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or is not available on PATH.
  exit /b 1
)
if not exist "node_modules\" (
  echo Installing webapp dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)
node -e "const s=require('node:net').createServer();s.once('error',()=>process.exit(1));s.once('listening',()=>s.close(()=>process.exit(0)));s.listen(3004,'::')"
if errorlevel 1 (
  echo ERROR: ELV's fixed vault-origin port 3004 is already in use. If ELV is already running, open http://localhost:3004. Otherwise stop only the unrelated listener before retrying.
  exit /b 1
)
set NEXT_PUBLIC_DEMO_MODE=1
echo.
echo ELV LegalFlowNC fixed vault origin: http://localhost:3004
echo IMPORTANT: IndexedDB vaults are bound to the exact browser origin. Always use this URL.
echo The development server will remain attached to this window.
start "" "http://localhost:3004"
call npm run dev -- -p 3004
set DEMO_EXIT=%ERRORLEVEL%
endlocal & exit /b %DEMO_EXIT%

REM Version history
REM 20260714142500.0 - Added one-command Node check, dependency install, demo environment, browser open, and Next.js startup.
REM 20260714142500.1 - Added a non-destructive exact-port check and forced the required port instead of silently moving to another app URL.
REM 20260714142500.2 - Replaced the slow Windows listener query with a bounded Node.js bind probe.
REM 20260714142500.3 - Probed Next.js's IPv6 bind address and propagated the development server exit code.
REM 20260714142500.4 - Fixed ELV to port 3004 so IndexedDB vault records do not appear lost through silent origin changes.
