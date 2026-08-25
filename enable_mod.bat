@echo off
setlocal EnableExtensions
cd /d "%~dp0"

call :main
echo.
pause
exit /b %ERRORLEVEL%

:main
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0switch_mod.ps1" -Action log -Kind enable
echo.

where bun >nul 2>&1
if errorlevel 1 (
    if exist "%~dp0compiled\pak01_dir.vpk" (
        powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0switch_mod.ps1" -Action enable
        if errorlevel 1 exit /b 1
        echo.
        powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0switch_mod.ps1" -Action log -Kind close
        exit /b 0
    )
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0switch_mod.ps1" -Action log -Kind bun
    echo Install Bun from https://bun.sh  or use install_compiled.bat
    exit /b 1
)

if not exist "%~dp0node_modules\" (
    bun install
    if errorlevel 1 exit /b 1
)

bun run build
if errorlevel 1 (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0switch_mod.ps1" -Action log -Kind fail
    exit /b 1
)

set "DEADLOCK_ROOT="
for /f "usebackq delims=" %%I in (`bun "%~dp0build\print_deadlock.ts"`) do set "DEADLOCK_ROOT=%%I"
if not defined DEADLOCK_ROOT (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0switch_mod.ps1" -Action log -Kind nodeadlock
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0switch_mod.ps1" -Action enable -DeadlockRoot "%DEADLOCK_ROOT%"
if errorlevel 1 exit /b 1

echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0switch_mod.ps1" -Action log -Kind close
exit /b 0
