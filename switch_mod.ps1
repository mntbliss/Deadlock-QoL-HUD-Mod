param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("enable", "disable")]
    [string]$Action,
    [string]$DeadlockRoot = ""
)

$ErrorActionPreference = "Stop"

function Test-DeadlockInstall([string]$dir) {
    return Test-Path (Join-Path $dir "game\citadel\gameinfo.gi")
}

function Get-JsonDeadlockRoot {
    $file = Join-Path $PSScriptRoot "paths.json"
    if (-not (Test-Path $file)) { return "" }
    $json = Get-Content $file -Raw | ConvertFrom-Json
    if ($json.deadlock_root) { return [string]$json.deadlock_root }
    return ""
}

function Get-SteamDeadlock {
    $steams = @(
        "${env:ProgramFiles(x86)}\Steam",
        "$env:ProgramFiles\Steam"
    )
    $reg = Get-ItemProperty -Path "HKCU:\Software\Valve\Steam" -Name SteamPath -ErrorAction SilentlyContinue
    if ($reg.SteamPath) { $steams += $reg.SteamPath }

    $found = New-Object System.Collections.Generic.List[string]
    foreach ($steam in $steams) {
        if (-not $steam) { continue }
        $found.Add((Join-Path $steam "steamapps\common\Deadlock")) | Out-Null
        $vdf = Join-Path $steam "steamapps\libraryfolders.vdf"
        if (Test-Path $vdf) {
            $text = Get-Content $vdf -Raw
            [regex]::Matches($text, '"path"\s+"([^"]+)"') | ForEach-Object {
                $lib = $_.Groups[1].Value -replace '\\\\', '\'
                $found.Add((Join-Path $lib "steamapps\common\Deadlock")) | Out-Null
            }
        }
    }
    foreach ($letter in @("C", "D", "E", "F", "G", "H")) {
        $found.Add("${letter}:\SteamLibrary\steamapps\common\Deadlock") | Out-Null
    }

    foreach ($dir in $found) {
        if (Test-DeadlockInstall $dir) { return $dir }
    }
    return $null
}

function Resolve-DeadlockRoot {
    if ($DeadlockRoot -and (Test-DeadlockInstall $DeadlockRoot)) { return $DeadlockRoot }
    $fromJson = Get-JsonDeadlockRoot
    if ($fromJson -and (Test-DeadlockInstall $fromJson)) { return $fromJson }
    $parent = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    if (Test-DeadlockInstall $parent) { return $parent }
    $steam = Get-SteamDeadlock
    if ($steam) { return $steam }
    return $null
}

$install = Resolve-DeadlockRoot
if (-not $install) {
    Write-Host "Could not find Deadlock."
    Write-Host "Set deadlock_root in paths.json."
    exit 1
}

$citadel = Join-Path $install "game\citadel"
$gameinfo = Join-Path $citadel "gameinfo.gi"
$backup = Join-Path $citadel "gameinfo.gi.bak_hpbar"
$addons = Join-Path $citadel "addons"
$vpk = Join-Path $addons "pak01_dir.vpk"
$vpkOff = Join-Path $addons "pak01_dir.vpk.off"

function Test-GameinfoWritable {
    try {
        $stream = [System.IO.File]::Open($gameinfo, "Open", "ReadWrite", "None")
        $stream.Close()
        return $true
    }
    catch {
        return $false
    }
}

if (-not (Test-Path $gameinfo)) {
    Write-Host "Could not find gameinfo.gi"
    exit 1
}

if (-not (Test-GameinfoWritable)) {
    Write-Host "Deadlock still has gameinfo.gi locked."
    Write-Host "Fully close the game (and Steam overlay if it stays open), then run this again."
    exit 1
}

function Enable-AddonsPath([string]$text) {
    if ($text -match "citadel/addons") {
        return $text
    }
    $pattern = '(?m)^(\t+)Game(\s+)citadel\r?\n\1Game\2core'
    $replacement = '${1}Mod${2}citadel' + "`n" + '${1}Write${2}citadel' + "`n" + '${1}Game${2}citadel/addons' + "`n" + '${1}Game${2}citadel' + "`n" + '${1}Game${2}core'
    $patched = [regex]::Replace($text, $pattern, $replacement, 1)
    if ($patched -eq $text) {
        throw "Could not patch SearchPaths in gameinfo.gi"
    }
    return $patched
}

if ($Action -eq "enable") {
    $text = [System.IO.File]::ReadAllText($gameinfo)
    if ($text -notmatch "citadel/addons") {
        if (-not (Test-Path $backup)) {
            Copy-Item $gameinfo $backup -Force
            Write-Host "Saved vanilla backup: gameinfo.gi.bak_hpbar"
        }
        $patched = Enable-AddonsPath $text
        [System.IO.File]::WriteAllText($gameinfo, $patched)
        Write-Host "Enabled citadel/addons in gameinfo.gi"
    }
    else {
        Write-Host "addons path already present in gameinfo.gi"
    }

    New-Item $addons -ItemType Directory -Force | Out-Null

    $compiled = Join-Path $PSScriptRoot "compiled\pak01_dir.vpk"
    if (Test-Path $compiled) {
        Copy-Item $compiled $vpk -Force
        Write-Host "Installed compiled\pak01_dir.vpk"
    }

    if (Test-Path $vpkOff) {
        if (Test-Path $vpk) { Remove-Item $vpkOff -Force }
        else { Rename-Item $vpkOff "pak01_dir.vpk" }
    }

    if (-not (Test-Path $vpk)) {
        Write-Host "HUD pack is missing: $vpk"
        exit 1
    }

    Write-Host "QoL HUD pack is active (player bar + minion Panorama bars)."
    exit 0
}

if (-not (Test-Path $backup)) {
    Write-Host "No backup found. Nothing to restore."
    exit 1
}

Copy-Item $backup $gameinfo -Force
Write-Host "Restored gameinfo.gi from backup"

if (Test-Path $vpk) {
    if (Test-Path $vpkOff) { Remove-Item $vpkOff -Force }
    Rename-Item $vpk "pak01_dir.vpk.off"
    Write-Host "Parked HUD pack as pak01_dir.vpk.off"
}

Write-Host "Default HUD restored."
exit 0
