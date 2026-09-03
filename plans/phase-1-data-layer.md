# Phase 1 — Data Layer & Core Schema

**Goal:** The full 4-level hierarchy exists in SQLite with correct constraints, exposed via typed Tauri commands.

---

## Scope Summary

Build the SQLite hierarchy (`main_sections` → `subsections` → `notes` → `assets`) with cascade deletes, WAL mode, a migration system, and typed Tauri commands — all testable without UI.

---

## Decisions Confirmed

| Decision | Choice |
|----------|--------|
| Connection sharing | `Mutex<Connection>` via Tauri Managed State |
| Migration embedding | `include_str!()` at compile time |
| Command pattern | Commands call helper functions that take `&Connection` (testable independently) |

---

## File Structure (new/modified)

```
src-tauri/
├── migrations/
│   └── 001_initial_schema.sql          # NEW — embedded SQL
├── src/
│   ├── main.rs                         # unchanged
│   ├── lib.rs                          # MODIFY — register commands, manage state
│   └── db/
│       ├── mod.rs                      # MODIFY — becomes db/mod.rs, adds init logic
│       ├── schema.rs                   # NEW — table definitions as constants
│       ├── migration.rs                # NEW — versioned migration runner
│       ├── models.rs                   # NEW — Rust structs for all 4 entities
│       ├── commands.rs                 # NEW — 16 #[tauri::command] functions
│       └── tests.rs                    # NEW — unit tests for schema + cascade deletes
```

---

## SQLite Schema

```sql
-- migrations/001_initial_schema.sql

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS main_sections (
    id          TEXT PRIMARY KEY,      -- UUID v4
    name        TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT '#6366f1',
    created_at  TEXT NOT NULL,         -- ISO 8601 datetime
    updated_at  TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subsections (
    id              TEXT PRIMARY KEY,
    main_section_id TEXT NOT NULL REFERENCES main_sections(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notes (
    id              TEXT PRIMARY KEY,
    subsection_id   TEXT NOT NULL REFERENCES subsections(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    content         TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS assets (
    id          TEXT PRIMARY KEY,
    note_id     TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    file_path   TEXT NOT NULL,          -- relative to assets/ dir
    alt_text    TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL
);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
);
INSERT OR IGNORE INTO schema_version (version) VALUES (0);
```

### Schema Design Rationale

- **UUIDs as TEXT PKs** — avoids auto-increment issues across migrations, trivially serializable to frontend
- **`sort_order INTEGER`** on all tables — deferred reordering (FR-6) is cheap to add now
- **ISO 8601 TEXT for timestamps** — SQLite has no native datetime; TEXT is portable and sortable
- **Cascade at DB level** — `ON DELETE CASCADE` FKs enforce §2.2 rules even if app logic has a bug

---

## Rust Models (`db/models.rs`)

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MainSection {
    pub id: String,
    pub name: String,
    pub color: String,
    pub created_at: String,
    pub updated_at: String,
    pub sort_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subsection {
    pub id: String,
    pub main_section_id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
    pub sort_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub subsection_id: String,
    pub title: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
    pub sort_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Asset {
    pub id: String,
    pub note_id: String,
    pub file_path: String,
    pub alt_text: String,
    pub created_at: String,
}
```

---

## Migration Runner (`db/migration.rs`)

```rust
use rusqlite::Connection;

const CURRENT_VERSION: i64 = 1;

pub fn run_migrations(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY
        );"
    )?;

    let current: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    if current < 1 {
        conn.execute_batch(include_str!("../../migrations/001_initial_schema.sql"))?;
        conn.execute("UPDATE schema_version SET version = 1", [])?;
        log::info!("Migrated database to version 1");
    }

    // Future migrations go here:
    // if current < 2 {
    //     conn.execute_batch(include_str!("../../migrations/002_*.sql"))?;
    //     conn.execute("UPDATE schema_version SET version = 2", [])?;
    // }

    Ok(())
}
```

---

## Tauri Commands (`db/commands.rs`)

16 commands total (4 per entity):

| Entity | Commands |
|--------|----------|
| MainSection | `list_main_sections`, `create_main_section`, `update_main_section`, `delete_main_section` |
| Subsection | `list_subsections`, `create_subsection`, `update_subsection`, `delete_subsection` |
| Note | `list_notes`, `create_note`, `update_note`, `delete_note` |
| Asset | `list_assets`, `create_asset`, `delete_asset` |

### Key Patterns

- Each command takes `State<'_, Mutex<Connection>>` + entity-specific params
- Calls helper functions that operate on `&Connection` (testable without Tauri)
- All mutations wrapped in `BEGIN IMMEDIATE` transactions
- UUIDs generated via `uuid::Uuid::new_v4().to_string()`
- Timestamps via `chrono::Utc::now().to_rfc3339()`
- Returns `Result<T, String>` (Tauri command convention)

### Command Signatures

```rust
// Main Sections
#[tauri::command]
fn list_main_sections(state: State<'_, Mutex<Connection>>) -> Result<Vec<MainSection>, String>

#[tauri::command]
fn create_main_section(state: State<'_, Mutex<Connection>>, name: String, color: String) -> Result<MainSection, String>

#[tauri::command]
fn update_main_section(state: State<'_, Mutex<Connection>>, id: String, name: Option<String>, color: Option<String>) -> Result<MainSection, String>

#[tauri::command]
fn delete_main_section(state: State<'_, Mutex<Connection>>, id: String) -> Result<(), String>

// Subsections (same pattern, scoped by main_section_id)
// Notes (same pattern, scoped by subsection_id)
// Assets (same pattern, scoped by note_id)
```

---

## `lib.rs` Changes

```rust
mod db;

use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let conn = db::init()?;
            app.manage(Mutex::new(conn));
            log::info!("Database initialized successfully");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db::commands::list_main_sections,
            db::commands::create_main_section,
            db::commands::update_main_section,
            db::commands::delete_main_section,
            db::commands::list_subsections,
            db::commands::create_subsection,
            db::commands::update_subsection,
            db::commands::delete_subsection,
            db::commands::list_notes,
            db::commands::create_note,
            db::commands::update_note,
            db::commands::delete_note,
            db::commands::list_assets,
            db::commands::create_asset,
            db::commands::delete_asset,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## Unit Tests (`db/tests.rs`)

All tests use in-memory SQLite (`":memory:"`) — no filesystem needed.

### Test Cases

| # | Test | What it verifies |
|---|------|------------------|
| 1 | `test_schema_creation` | Migrations run successfully, all 4 tables exist |
| 2 | `test_wal_mode_enabled` | `PRAGMA journal_mode` returns `wal` after init |
| 3 | `test_main_section_crud` | Create, read, update, delete a MainSection |
| 4 | `test_subsection_crud` | Create, read, update, delete a Subsection |
| 5 | `test_note_crud` | Create, read, update, delete a Note |
| 6 | `test_asset_crud` | Create, read, delete an Asset |
| 7 | `test_cascade_delete_main_section` | Deleting MainSection removes its subsections, notes, and assets |
| 8 | `test_cascade_delete_subsection` | Deleting Subsection removes its notes and assets |
| 9 | `test_cascade_delete_note` | Deleting Note removes its assets |
| 10 | `test_fk_constraint_violation` | Inserting a subsection with invalid `main_section_id` fails |

---

## Implementation Steps

| # | Task | Depends On |
|---|------|------------|
| 1 | Create `migrations/001_initial_schema.sql` | — |
| 2 | Create `src-tauri/src/db/` module structure (`mod.rs`, `schema.rs`, `migration.rs`, `models.rs`, `commands.rs`) | — |
| 3 | Implement migration runner in `migration.rs` | 1 |
| 4 | Refactor `db/mod.rs` — connection setup with WAL + FK + migration | 2, 3 |
| 5 | Implement `models.rs` structs | — |
| 6 | Implement all 16 CRUD commands in `commands.rs` | 4, 5 |
| 7 | Update `lib.rs` — register commands, manage state | 6 |
| 8 | Write cascade-delete unit tests | 4, 5 |
| 9 | Run `cargo test` + `cargo clippy` | 7, 8 |

---

## Exit Criteria

- [ ] `cargo test` — all 10 tests pass
- [ ] `cargo clippy -- -D warnings` — zero warnings
- [ ] App still launches via `pnpm run tauri dev`
- [ ] DB file at `~/.local/share/study-notes/study-notes.db` contains all 4 tables after first run
- [ ] Deleting a parent entity at any level cascades to all children via DB-level FKs
- [ ] WAL mode is active (verify via `PRAGMA journal_mode`)

---

## Estimated Effort

- **~7 files** created/modified
- **~400-600 lines** of Rust code
- **~30 lines** of SQL (schema)
- **~200 lines** of tests
