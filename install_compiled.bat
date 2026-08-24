@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo  INSTALL: prebuilt compiled\pak01_dir.vpk  (no Bun / CSDK)
echo.

if not exist "%~dp0compiled\pak01_dir.vpk" (
    echo Missing compiled\pak01_dir.vpk
    echo Someone needs to run enable_mod.bat first so this folder gets a pack.
    goto :end
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0switch_mod.ps1" -Action enable
if errorlevel 1 goto :end

echo.
echo  Mod is ON. Fully close Deadlock, then launch again.
echo.

:end
pause
