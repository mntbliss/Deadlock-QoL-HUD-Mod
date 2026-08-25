@echo off
setlocal EnableExtensions
cd /d "%~dp0"

call :main
echo.
pause
exit /b %ERRORLEVEL%

:main
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0switch_mod.ps1" -Action log -Kind disable
echo.

set "DEADLOCK_ROOT="
where bun >nul 2>&1
if not errorlevel 1 (
    for /f "usebackq delims=" %%I in (`bun "%~dp0build\print_deadlock.ts"`) do set "DEADLOCK_ROOT=%%I"
)

if defined DEADLOCK_ROOT (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0switch_mod.ps1" -Action disable -DeadlockRoot "%DEADLOCK_ROOT%"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0switch_mod.ps1" -Action disable
)
if errorlevel 1 exit /b 1
exit /b 0
