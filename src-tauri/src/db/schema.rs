//! Table definitions as Rust string constants.
//!
//! These mirror `migrations/001_initial_schema.sql`, which is the single
//! source of truth applied at runtime via `include_str!` in `migration.rs`.
//! This module exists as a compile-checked reference for documentation and
//! future programmatic schema needs. It is intentionally not referenced by
//! production code (hence the `allow`), and `test_schema_constants_are_valid_sql`
//! guarantees the constants stay executable so they cannot rot silently.
//!
//! Secondary indexes mirror `migrations/002_performance_indexes.sql`.

#![allow(dead_code)]

pub const CREATE_MAIN_SECTIONS: &str = "
CREATE TABLE IF NOT EXISTS main_sections (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT '#6366f1',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0
)";

pub const CREATE_SUBSECTIONS: &str = "
CREATE TABLE IF NOT EXISTS subsections (
    id              TEXT PRIMARY KEY,
    main_section_id TEXT NOT NULL REFERENCES main_sections(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    sort_order      INTEGER NOT NULL DEFAULT 0
)";

pub const CREATE_NOTES: &str = "
CREATE TABLE IF NOT EXISTS notes (
    id              TEXT PRIMARY KEY,
    subsection_id   TEXT NOT NULL REFERENCES subsections(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    content         TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    sort_order      INTEGER NOT NULL DEFAULT 0
)";

pub const CREATE_ASSETS: &str = "
CREATE TABLE IF NOT EXISTS assets (
    id          TEXT PRIMARY KEY,
    note_id     TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    file_path   TEXT NOT NULL,
    alt_text    TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL
)";

/// Mirrors `migrations/002_performance_indexes.sql` — secondary indexes on
/// foreign keys and sort columns for O(log N) lookups at scale.
pub const PERFORMANCE_INDEXES: &str = "
CREATE INDEX IF NOT EXISTS idx_subsections_main_section ON subsections(main_section_id);
CREATE INDEX IF NOT EXISTS idx_subsections_sort ON subsections(main_section_id, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_notes_subsection ON notes(subsection_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(subsection_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_sort ON notes(subsection_id, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_assets_note ON assets(note_id);
";

/// Mirrors `migrations/003_full_text_search.sql` — an external-content FTS5
/// virtual table over `notes` (BM25 ranking, porter + unicode61 tokenizer)
/// plus the AFTER INSERT / UPDATE / DELETE triggers that keep the index in
/// sync inside the same transaction as the `notes` write.
pub const FULL_TEXT_SEARCH: &str = "
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    id UNINDEXED,
    title,
    content,
    content='notes',
    content_rowid='rowid',
    tokenize='porter unicode61'
);
INSERT INTO notes_fts(rowid, id, title, content)
SELECT rowid, id, title, content FROM notes;
CREATE TRIGGER IF NOT EXISTS notes_fts_ai AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(rowid, id, title, content)
    VALUES (new.rowid, new.id, new.title, new.content);
END;
CREATE TRIGGER IF NOT EXISTS notes_fts_au AFTER UPDATE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, id, title, content)
    VALUES ('delete', old.rowid, old.id, old.title, old.content);
    INSERT INTO notes_fts(rowid, id, title, content)
    VALUES (new.rowid, new.id, new.title, new.content);
END;
CREATE TRIGGER IF NOT EXISTS notes_fts_ad AFTER DELETE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, id, title, content)
    VALUES ('delete', old.rowid, old.id, old.title, old.content);
END;
";
