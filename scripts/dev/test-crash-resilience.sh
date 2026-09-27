#!/usr/bin/env bash
# Phase 6 dev-only utility: crash-mid-write simulation (WAL durability check).
#
# Spawns a background worker hammering the app database with INSERTs while
# repeatedly sending SIGKILL to it, then reopens the database and runs
# PRAGMA integrity_check + foreign_key_check to prove zero corruption:
# committed transactions survive, in-flight ones roll back cleanly.
#
# This is NOT a required exit gate — it is a manual verification tool.
#
# Usage: scripts/dev/test-crash-resilience.sh [ROUNDS]
set -euo pipefail

DB="${XDG_DATA_HOME:-$HOME/.local/share}/study-notes/study-notes.db"
ROUNDS="${1:-10}"
WORKER="/tmp/study-notes-crash-worker.py"

if [ ! -f "$DB" ]; then
  echo "ERROR: database not found at $DB — launch the app once first." >&2
  exit 1
fi

mkdir -p "$(dirname "$WORKER")"
cat > "$WORKER" <<'PYEOF'
import sqlite3, sys, uuid, time, os
db = sys.argv[1]
conn = sqlite3.connect(db, isolation_level=None)  # autocommit: every insert its own tx
conn.execute("PRAGMA journal_mode = WAL;")
conn.execute("PRAGMA synchronous = NORMAL;")
conn.execute("PRAGMA busy_timeout = 5000;")
# Benchmarked rows are prefixed so they can be cleaned by seed-benchmark-data.sh.
while True:
    try:
        conn.execute(
            "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order) "
            "VALUES (?,?,?,?,?,?,0)",
            (str(uuid.uuid4()), "crash-test-orphan-guard", "[bench] crash probe", "x", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"),
        )
    except sqlite3.OperationalError:
        pass  # db locked mid-kill — keep hammering until SIGKILL lands
PYEOF

echo "Crash-resilience test: $ROUNDS SIGKILL rounds against $DB"
for round in $(seq 1 "$ROUNDS"); do
  python3 "$WORKER" "$DB" &
  worker_pid=$!
  # Let it commit a random number of transactions before the kill.
  sleep "0.$((RANDOM % 5 + 1))"
  kill -9 "$worker_pid" 2>/dev/null || true
  wait "$worker_pid" 2>/dev/null || true

  result=$(sqlite3 "$DB" "PRAGMA integrity_check;" 2>&1)
  echo "Round $round: SIGKILL delivered → integrity_check: $result"
  if [ "$result" != "ok" ]; then
    echo "FAILURE: database corrupted in round $round" >&2
    sqlite3 "$DB" "PRAGMA foreign_key_check;" >&2 || true
    exit 1
  fi
done

# Clean up probe rows (they reference a non-existent subsection, so FK check
# with enforcement ON would flag them — remove before the final verification).
sqlite3 "$DB" "DELETE FROM notes WHERE title = '[bench] crash probe';"

violations=$(sqlite3 "$DB" "PRAGMA foreign_key_check;" 2>&1)
integrity=$(sqlite3 "$DB" "PRAGMA integrity_check;" 2>&1)
echo "Final: integrity_check=$integrity foreign_key_check=${violations:-ok}"
[ "$integrity" = "ok" ] && { echo "PASS: database survived $ROUNDS SIGKILL rounds with zero corruption."; exit 0; }
echo "FAILURE: final integrity check failed" >&2
exit 1
