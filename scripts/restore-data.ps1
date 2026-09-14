#Requires -Version 5.1
<#
.SYNOPSIS
    Restores a Study Notes backup ZIP created by backup-data.ps1.

.DESCRIPTION
    Windows counterpart of scripts/restore-data.sh (which is Linux-only by
    design and must not be modified). Restores a study-notes-backup-*.zip
    archive into %LOCALAPPDATA%\study-notes. If existing data is found, a
    safety snapshot is taken first so a bad restore is always reversible.

    Supports -WhatIf: with -WhatIf nothing is copied, snapshotted, or
    extracted.

.EXAMPLE
    .\scripts\restore-data.ps1 "$HOME\study-notes-backups\study-notes-backup-2026-09-14_120000.zip"
.EXAMPLE
    .\scripts\restore-data.ps1 'D:\backups\study-notes-backup-2026-09-14_120000.zip' -WhatIf
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$DataDir = Join-Path $env:LOCALAPPDATA 'study-notes'

$Resolved = Resolve-Path -LiteralPath $BackupFile -ErrorAction SilentlyContinue
if (-not $Resolved) {
    Write-Error "Usage: $($MyInvocation.MyCommand.Name) <path-to-study-notes-backup.zip> (file not found: $BackupFile)" -ErrorAction Continue
    exit 1
}
$BackupPath = $Resolved.Path

# Refuse to clobber with an archive that doesn't even look like ours.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$Zip = [System.IO.Compression.ZipFile]::OpenRead($BackupPath)
try {
    $LooksLikeBackup = @($Zip.Entries | Where-Object { $_.FullName -like 'study-notes/*' }).Count -gt 0
}
finally {
    $Zip.Dispose()
}
if (-not $LooksLikeBackup) {
    Write-Error "$BackupPath does not look like a Study Notes backup (expected a top-level 'study-notes/' directory inside the archive)." -ErrorAction Continue
    exit 1
}

# Safety snapshot of current data before overwriting anything.
$SafetyBackup = $null
if (Test-Path -LiteralPath $DataDir -PathType Container) {
    $SafetyBackup = "$DataDir-pre-restore-$(Get-Date -Format 'yyyyMMdd_HHmmss').bak"
    Write-Warning "Existing data found. Creating safety snapshot at $SafetyBackup..."
    if ($PSCmdlet.ShouldProcess($SafetyBackup, 'Create safety snapshot of existing data')) {
        Copy-Item -LiteralPath $DataDir -Destination $SafetyBackup -Recurse -Force
    }
}

# The app must not be writing while we swap the directory contents.
if (Get-Process -Name 'study-notes' -ErrorAction SilentlyContinue) {
    Write-Error 'study-notes is running. Close it before restoring.' -ErrorAction Continue
    exit 1
}

$ParentDir = Split-Path -Parent $DataDir
if ($PSCmdlet.ShouldProcess($DataDir, "Extract backup archive $BackupPath")) {
    if ($PSCmdlet.ShouldProcess($ParentDir, 'Create data parent directory')) {
        New-Item -ItemType Directory -Force -Path $ParentDir | Out-Null
    }
    Expand-Archive -LiteralPath $BackupPath -DestinationPath $ParentDir -Force
    Write-Output "Restore complete! Data directory restored to: $DataDir"
    if ($SafetyBackup) {
        Write-Output "Previous data kept at: $SafetyBackup"
    }
}
