#!/usr/bin/env bash
# Phase 8 backup utility (PRD §8 — zero-cloud, local-first):
# Archives the Study Notes data directory (SQLite DB + image assets) into a
# compressed, timestamped tarball:
#   study-notes-backup-YYYY-MM-DD_HHMMSS.tar.gz
#
# Usage: backup-data.sh [destination-directory]
#        (default destination: ~/study-notes-backups)
set -euo pipefail

DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/study-notes"
BACKUP_DEST="${1:-$HOME/study-notes-backups}"
TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
ARCHIVE_NAME="study-notes-backup-${TIMESTAMP}.tar.gz"

if [ ! -d "$DATA_DIR" ]; then
    echo "❌ Error: Data directory not found at $DATA_DIR" >&2
    echo "   Launch the app once to provision it, or set XDG_DATA_HOME." >&2
    exit 1
fi

mkdir -p "$BACKUP_DEST"

# Force a SQLite WAL checkpoint so every committed transaction currently
# sitting in the -wal file is flushed into study-notes.db before archiving
# (safe to run even while the app is open). Without sqlite3, warn instead of
# failing — a running app may leave recent writes in the WAL.
DB_FILE="$DATA_DIR/study-notes.db"
if [ -f "$DB_FILE" ] && command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$DB_FILE" "PRAGMA wal_checkpoint(TRUNCATE);" || true
elif [ -f "$DB_FILE" ]; then
    echo "⚠️  sqlite3 not found — skipping WAL checkpoint." >&2
    echo "   Close the app first if it may have unsaved in-flight writes." >&2
fi

tar -czf "$BACKUP_DEST/$ARCHIVE_NAME" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"

echo "✅ Backup successfully created at: $BACKUP_DEST/$ARCHIVE_NAME"
echo "📦 Archive size: $(du -h "$BACKUP_DEST/$ARCHIVE_NAME" | cut -f1)"
