#!/usr/bin/env bash
# Phase 8 restore utility:
# Restores a study-notes-backup-*.tar.gz archive created by backup-data.sh
# into the XDG data directory. If existing data is found, a safety snapshot
# is taken first so a bad restore is always reversible.
#
# Usage: restore-data.sh <path-to-study-notes-backup.tar.gz>
set -euo pipefail

BACKUP_FILE="${1:-}"
DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/study-notes"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    echo "Usage: $0 <path-to-study-notes-backup.tar.gz>" >&2
    exit 1
fi

# Refuse to clobber with an archive that doesn't even look like ours.
if ! tar -tzf "$BACKUP_FILE" | grep -q "^study-notes/"; then
    echo "❌ Error: $BACKUP_FILE does not look like a Study Notes backup" >&2
    echo "   (expected a top-level 'study-notes/' directory inside the archive)." >&2
    exit 1
fi

# Safety snapshot of current data before overwriting anything.
if [ -d "$DATA_DIR" ]; then
    SAFETY_BACKUP="${DATA_DIR}-pre-restore-$(date +%Y%m%d_%H%M%S).bak"
    echo "⚠️  Existing data found. Creating safety snapshot at $SAFETY_BACKUP..."
    cp -r "$DATA_DIR" "$SAFETY_BACKUP"
fi

# The app must not be writing while we swap the directory contents.
if pgrep -x study-notes >/dev/null 2>&1; then
    echo "❌ Error: study-notes is running. Close it before restoring." >&2
    exit 1
fi

mkdir -p "$(dirname "$DATA_DIR")"
tar -xzf "$BACKUP_FILE" -C "$(dirname "$DATA_DIR")"

echo "✅ Restore complete! Data directory restored to: $DATA_DIR"
[ -n "${SAFETY_BACKUP:-}" ] && echo "↩️  Previous data kept at: $SAFETY_BACKUP"
exit 0
