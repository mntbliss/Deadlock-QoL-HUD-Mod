param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("enable", "disable", "log")]
    [string]$Action,
    [string]$DeadlockRoot = "",
    [string]$Kind = ""
)

$ErrorActionPreference = "Stop"

function Emoji([int]$Code) {
    return [char]::ConvertFromUtf32($Code)
}

function Write-ModLog([string]$Icon, [string]$Status, [string]$Message, [string]$Color = "Green") {
    Write-Host "[$Icon] [" -NoNewline
    Write-Host $Status -ForegroundColor $Color -NoNewline
    Write-Host "] $Message"
}

if ($Action -eq "log") {
    switch ($Kind) {
        "enable" { Write-ModLog (Emoji 0x2705) "OK" "enable mntbliss QoL HUD" "Green" }
        "disable" { Write-ModLog (Emoji 0x2705) "OK" "disable mntbliss QoL HUD" "Green" }
        "install" { Write-ModLog (Emoji 0x1F4E6) "OK" "install prebuilt pack" "Green" }
        "close" { Write-ModLog (Emoji 0x1F44B) "OK" "fully close deadlock, then launch" "Green" }
        "fail" { Write-ModLog (Emoji 0x274C) "ERROR" "compile failed, fully close deadlock" "Red" }
        "bun" { Write-ModLog (Emoji 0x274C) "ERROR" "bun not found" "Red" }
        "missing" { Write-ModLog (Emoji 0x274C) "ERROR" "missing compiled\pak01_dir.vpk" "Red" }
        "nodeadlock" { Write-ModLog (Emoji 0x274C) "ERROR" "could not find deadlock" "Red" }
        default { Write-ModLog (Emoji 0x274C) "ERROR" "unknown log kind" "Red"; exit 1 }
    }
    exit 0
}

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
    Write-ModLog (Emoji 0x274C) "ERROR" "could not find Deadlock" "Red"
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
    Write-ModLog (Emoji 0x274C) "ERROR" "could not find gameinfo.gi" "Red"
    exit 1
}

if (-not (Test-GameinfoWritable)) {
    Write-ModLog (Emoji 0x274C) "ERROR" "compile failed, fully close deadlock" "Red"
    Write-ModLog (Emoji 0x26A0) "WARN" "gameinfo.gi is locked" "DarkYellow"
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
        }
        $patched = Enable-AddonsPath $text
        [System.IO.File]::WriteAllText($gameinfo, $patched)
    }

    New-Item $addons -ItemType Directory -Force | Out-Null

    $compiled = Join-Path $PSScriptRoot "compiled\pak01_dir.vpk"
    if (Test-Path $compiled) {
        try {
            Copy-Item $compiled $vpk -Force
        }
        catch {
            Write-ModLog (Emoji 0x274C) "ERROR" "compile failed, fully close deadlock" "Red"
            Write-ModLog (Emoji 0x26A0) "WARN" "locking pak01_dir.vpk" "DarkYellow"
            exit 1
        }
    }

    if (Test-Path $vpkOff) {
        if (Test-Path $vpk) { Remove-Item $vpkOff -Force }
        else { Rename-Item $vpkOff "pak01_dir.vpk" }
    }

    if (-not (Test-Path $vpk)) {
        Write-ModLog (Emoji 0x274C) "ERROR" "compile failed, fully close deadlock" "Red"
        Write-ModLog (Emoji 0x274C) "ERROR" "hud pack is missing" "Red"
        exit 1
    }

    Write-ModLog (Emoji 0x2705) "OK" "copied to game" "Green"
    exit 0
}

if (-not (Test-Path $backup)) {
    Write-ModLog (Emoji 0x26A0) "WARN" "no backup found" "DarkYellow"
    exit 1
}

Copy-Item $backup $gameinfo -Force

if (Test-Path $vpk) {
    if (Test-Path $vpkOff) { Remove-Item $vpkOff -Force }
    Rename-Item $vpk "pak01_dir.vpk.off"
}

Write-ModLog (Emoji 0x2705) "OK" "default hud restored" "Green"
exit 0
