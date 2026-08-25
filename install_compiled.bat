@echo off
setlocal EnableExtensions
cd /d "%~dp0"

call :main
echo.
pause
exit /b %ERRORLEVEL%

:main
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0switch_mod.ps1" -Action log -Kind install
echo.

if not exist "%~dp0compiled\pak01_dir.vpk" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0switch_mod.ps1" -Action log -Kind missing
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0switch_mod.ps1" -Action enable
if errorlevel 1 exit /b 1

echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0switch_mod.ps1" -Action log -Kind close
exit /b 0
