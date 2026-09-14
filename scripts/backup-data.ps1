#Requires -Version 5.1
<#
.SYNOPSIS
    Backs up the Study Notes data directory into a timestamped ZIP archive.

.DESCRIPTION
    Windows counterpart of scripts/backup-data.sh (which is Linux-only by
    design and must not be modified). Archives the Study Notes data directory
    (SQLite DB + image assets) into:
        study-notes-backup-YYYY-MM-DD_HHMMSS.zip
    under ~/study-notes-backups (override with -Destination).

    Supports -WhatIf: with -WhatIf no directories, checkpoints, or archives
    are created or modified.

.EXAMPLE
    .\scripts\backup-data.ps1
.EXAMPLE
    .\scripts\backup-data.ps1 -Destination 'D:\backups' -WhatIf
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$Destination = (Join-Path $HOME 'study-notes-backups')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$DataDir = Join-Path $env:LOCALAPPDATA 'study-notes'
$Timestamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$ArchiveName = "study-notes-backup-$Timestamp.zip"

if (-not (Test-Path -LiteralPath $DataDir -PathType Container)) {
    Write-Error "Data directory not found at $DataDir. Launch the app once to provision it." -ErrorAction Continue
    exit 1
}

if ($PSCmdlet.ShouldProcess($Destination, 'Create backup destination directory')) {
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
}

# Force a SQLite WAL checkpoint so every committed transaction currently
# sitting in the -wal file is flushed into study-notes.db before archiving
# (safe to run even while the app is open). Without sqlite3, warn instead of
# failing — a running app may leave recent writes in the WAL.
$DbFile = Join-Path $DataDir 'study-notes.db'
if ((Test-Path -LiteralPath $DbFile -PathType Leaf) -and (Get-Command sqlite3 -ErrorAction SilentlyContinue)) {
    if ($PSCmdlet.ShouldProcess($DbFile, 'Checkpoint SQLite WAL')) {
        & sqlite3 $DbFile 'PRAGMA wal_checkpoint(TRUNCATE);'
    }
}
elseif (Test-Path -LiteralPath $DbFile -PathType Leaf) {
    Write-Warning 'sqlite3 not found — skipping WAL checkpoint. Close the app first if it may have unsaved in-flight writes.'
}

$ArchivePath = Join-Path $Destination $ArchiveName
if ($PSCmdlet.ShouldProcess($ArchivePath, 'Create backup archive')) {
    # Archiving the folder itself keeps a top-level 'study-notes/' prefix
    # inside the ZIP, which restore-data.ps1 validates before extracting.
    Compress-Archive -LiteralPath $DataDir -DestinationPath $ArchivePath -CompressionLevel Optimal
    $SizeMB = '{0:N1} MB' -f ((Get-Item -LiteralPath $ArchivePath).Length / 1MB)
    Write-Output "Backup successfully created at: $ArchivePath"
    Write-Output "Archive size: $SizeMB"
}
