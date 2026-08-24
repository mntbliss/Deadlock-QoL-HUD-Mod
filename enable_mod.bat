@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo  ENABLE: compile + install mntbliss QoL HUD
echo.

where bun >nul 2>&1
if errorlevel 1 (
    echo Install Bun from https://bun.sh then run this again.
    goto :end
)

if not exist "%~dp0node_modules\" (
    echo Installing dependencies...
    bun install
    if errorlevel 1 goto :end
)

bun run build
if errorlevel 1 (
    echo Compile/pack failed.
    goto :end
)

set "DEADLOCK_ROOT="
for /f "usebackq delims=" %%I in (`bun "%~dp0build\print_deadlock.ts"`) do set "DEADLOCK_ROOT=%%I"
if not defined DEADLOCK_ROOT (
    echo Could not resolve Deadlock path.
    goto :end
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0switch_mod.ps1" -Action enable -DeadlockRoot "%DEADLOCK_ROOT%"
if errorlevel 1 goto :end

echo.
echo  Mod is ON. Fully close Deadlock, then launch again.
echo.

:end
pause
