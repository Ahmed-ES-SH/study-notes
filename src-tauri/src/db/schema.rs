//! Table definitions as Rust string constants.
//!
//! These mirror `migrations/001_initial_schema.sql`, which is the single
//! source of truth applied at runtime via `include_str!` in `migration.rs`.
//! This module exists as a compile-checked reference for documentation and
//! future programmatic schema needs. It is intentionally not referenced by
//! production code (hence the `allow`), and `test_schema_constants_are_valid_sql`
//! guarantees the constants stay executable so they cannot rot silently.

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
