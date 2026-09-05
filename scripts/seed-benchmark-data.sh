#!/usr/bin/env bash
# Phase 6 load-testing utility: populates the local SQLite database with a
# configurable benchmark dataset (default: 10 sections / 50 subsections /
# 5,000 notes) to validate the 002 performance indexes and smooth rendering
# at scale. The app must be closed while seeding (WAL allows either way,
# but a closed app guarantees a clean view of the numbers).
#
# Usage:
#   scripts/seed-benchmark-data.sh [SECTIONS] [SUBSECTIONS_PER_SECTION] [NOTES_PER_SUBSECTION]
#   scripts/seed-benchmark-data.sh 10 5 100          # 5,000 notes (default)
#   scripts/seed-benchmark-data.sh 4 5 500           # 10,000 notes
#
# Requires: sqlite3 CLI, python3 (deterministic content generation).
set -euo pipefail

DB="${XDG_DATA_HOME:-$HOME/.local/share}/study-notes/study-notes.db"

SECTIONS="${1:-10}"
SUBS_PER_SECTION="${2:-5}"
NOTES_PER_SUB="${3:-100}"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "ERROR: sqlite3 CLI is required (pacman -S sqlite)." >&2
  exit 1
fi
if [ ! -f "$DB" ]; then
  echo "ERROR: database not found at $DB — launch the app once to create it." >&2
  exit 1
fi

echo "Seeding $SECTIONS sections × $SUBS_PER_SECTION subsections × $NOTES_PER_SUB notes"
echo "  → $((SECTIONS * SUBS_PER_SECTION * NOTES_PER_SUB)) notes into $DB"

python3 - "$DB" "$SECTIONS" "$SUBS_PER_SECTION" "$NOTES_PER_SUB" <<'PYEOF'
import sqlite3, sys, uuid, time

db_path, sections, subs_per, notes_per = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
conn = sqlite3.connect(db_path)
conn.execute("PRAGMA foreign_keys = ON;")

# Idempotent: clear previous benchmark run.
conn.execute("DELETE FROM assets WHERE note_id IN (SELECT id FROM notes WHERE title LIKE '[bench]%')")
conn.execute("DELETE FROM notes WHERE title LIKE '[bench]%'")
conn.execute("DELETE FROM subsections WHERE name LIKE '[bench]%'")
conn.execute("DELETE FROM main_sections WHERE name LIKE '[bench]%'")

CODE_SNIPPET = """```rust
fn binary_search(arr: &[i64], target: i64) -> Option<usize> {
    let mut lo = 0usize;
    let mut hi = arr.len();
    while lo < hi {
        let mid = (lo + hi) / 2;
        match arr[mid].cmp(&target) {
            std::cmp::Ordering::Less => lo = mid + 1,
            std::cmp::Ordering::Greater => hi = mid,
            std::cmp::Ordering::Equal => return Some(mid),
        }
    }
    None
}
```"""

def note_content(i, sub):
    return (
        f"## Benchmark Note {i}\n\n"
        f"Load-testing note for **[bench] {sub}**.\n\n"
        f"- Query complexity: O(log N) with migration 002 indexes\n"
        f"- Generated: deterministic seed dataset\n\n"
        f"{CODE_SNIPPET}\n\n"
        f"> WAL mode keeps concurrent reads smooth while this row was written.\n"
    )

start = time.perf_counter()
now = "2026-01-01T00:00:00Z"
counts = {"sections": 0, "subs": 0, "notes": 0}

with conn:
    for s in range(sections):
        ms_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO main_sections (id, name, color, created_at, updated_at, sort_order) VALUES (?,?,?,?,?,?)",
            (ms_id, f"[bench] Domain {s:02d}", "#388bfd", now, now, s),
        )
        counts["sections"] += 1
        for b in range(subs_per):
            sub_id = str(uuid.uuid4())
            conn.execute(
                "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order) VALUES (?,?,?,?,?,?)",
                (sub_id, ms_id, f"[bench] Topic {s:02d}.{b:02d}", now, now, b),
            )
            counts["subs"] += 1
            for n in range(notes_per):
                note_id = str(uuid.uuid4())
                conn.execute(
                    "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order) VALUES (?,?,?,?,?,?,?)",
                    (note_id, sub_id, f"[bench] Note {s:02d}{b:02d}{n:04d}", note_content(n, sub_id), now, now, n),
                )
                counts["notes"] += 1

duration_ms = (time.perf_counter() - start) * 1000

# Exercise the indexed sort/list query paths and time them.
t0 = time.perf_counter()
rows = conn.execute(
    "SELECT id FROM notes WHERE subsection_id IN (SELECT id FROM subsections WHERE main_section_id IN "
    "(SELECT id FROM main_sections WHERE name LIKE '[bench]%')) ORDER BY updated_at DESC LIMIT 200"
).fetchall()
list_ms = (time.perf_counter() - t0) * 1000

t0 = time.perf_counter()
plan = conn.execute(
    "EXPLAIN QUERY PLAN SELECT id FROM notes WHERE subsection_id = ? ORDER BY updated_at DESC LIMIT 50",
    (next(conn.execute("SELECT id FROM subsections LIMIT 1"))[0],),
).fetchall()
plan_ms = (time.perf_counter() - t0) * 1000

integrity = conn.execute("PRAGMA integrity_check;").fetchone()[0]
conn.close()

print(f"  Created: {counts['sections']} sections, {counts['subs']} subsections, {counts['notes']} notes in {duration_ms:.0f} ms")
print(f"  Indexed hierarchical list query (200 rows): {list_ms:.2f} ms")
print(f"  Query plan uses indexes: {[p[-1] for p in plan]} ({plan_ms:.2f} ms)")
print(f"  PRAGMA integrity_check: {integrity}")
print("Done. Launch the app and scroll a [bench] subsection to verify 60fps rendering.")
PYEOF
