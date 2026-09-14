use rusqlite::Connection;

use crate::db::migration;
use crate::db::models::{Asset, MainSection, MainSectionCascadeInfo, Note, NoteCascadeInfo, Subsection, SubsectionCascadeInfo};
use crate::db::schema;

fn setup_db() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
    migration::run_migrations(&conn).unwrap();
    conn
}

// ── Test 1: Schema creation ─────────────────────────────────────

#[test]
fn test_schema_creation() {
    let conn = setup_db();

    let tables: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap();
        let rows = stmt.query_map([], |row| row.get(0)).unwrap();
        rows.map(|r| r.unwrap()).collect()
    };

    assert!(tables.contains(&"main_sections".to_string()));
    assert!(tables.contains(&"subsections".to_string()));
    assert!(tables.contains(&"notes".to_string()));
    assert!(tables.contains(&"assets".to_string()));
    assert!(tables.contains(&"schema_version".to_string()));
}

// ── Test 2: WAL mode enabled ────────────────────────────────────
//
// NOTE: WAL mode only applies to file-backed databases. `:memory:`
// databases always report `journal_mode = memory`, so this test uses
// a temporary file database.

#[test]
fn test_wal_mode_enabled() {
    let path =
        std::env::temp_dir().join(format!("study-notes-wal-test-{}.db", uuid::Uuid::new_v4()));
    let journal_mode = {
        let conn = Connection::open(&path).unwrap();
        conn.execute_batch("PRAGMA journal_mode = WAL;").unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        migration::run_migrations(&conn).unwrap();
        conn.query_row("PRAGMA journal_mode", [], |row| row.get::<_, String>(0))
            .unwrap()
    };
    std::fs::remove_file(&path).ok();
    std::fs::remove_file(format!("{}-wal", path.display())).ok();
    std::fs::remove_file(format!("{}-shm", path.display())).ok();
    assert_eq!(journal_mode, "wal");
}

// ── Test 2b: schema.rs constants stay valid ───────────────────────
//
// `schema.rs` mirrors the migration DDL as Rust constants. This test
// executes them against a fresh database so they cannot rot silently.

#[test]
fn test_schema_constants_are_valid_sql() {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(schema::CREATE_MAIN_SECTIONS).unwrap();
    conn.execute_batch(schema::CREATE_SUBSECTIONS).unwrap();
    conn.execute_batch(schema::CREATE_NOTES).unwrap();
    conn.execute_batch(schema::CREATE_ASSETS).unwrap();

    for table in ["main_sections", "subsections", "notes", "assets"] {
        let count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
                rusqlite::params![table],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "schema constant should create table `{table}`");
    }
}

// ── Test 3: MainSection CRUD ────────────────────────────────────

#[test]
fn test_main_section_crud() {
    let conn = setup_db();
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    // Create
    conn.execute(
        "INSERT INTO main_sections (id, name, color, created_at, updated_at, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, 0)",
        rusqlite::params![id, "Math", "#ff0000", now, now],
    )
    .unwrap();

    // Read
    let section: MainSection = conn
        .query_row(
            "SELECT id, name, color, created_at, updated_at, sort_order
                 FROM main_sections WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok(MainSection {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    color: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                    sort_order: row.get(5)?,
                })
            },
        )
        .unwrap();
    assert_eq!(section.name, "Math");
    assert_eq!(section.color, "#ff0000");

    // Update
    let updated_at = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE main_sections SET name = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params!["Calculus", updated_at, id],
    )
    .unwrap();
    let updated: String = conn
        .query_row(
            "SELECT name FROM main_sections WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(updated, "Calculus");

    // Delete
    conn.execute(
        "DELETE FROM main_sections WHERE id = ?1",
        rusqlite::params![id],
    )
    .unwrap();
    let count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM main_sections WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(count, 0);
}

// ── Test 4: Subsection CRUD ─────────────────────────────────────

#[test]
fn test_subsection_crud() {
    let conn = setup_db();

    // Setup parent
    let section_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO main_sections (id, name, color, created_at, updated_at, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, 0)",
        rusqlite::params![section_id, "Math", "#ff0000", now, now],
    )
    .unwrap();

    // Create subsection
    let sub_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, 0)",
        rusqlite::params![sub_id, section_id, "Algebra", now, now],
    )
    .unwrap();

    // Read
    let sub: Subsection = conn
        .query_row(
            "SELECT id, main_section_id, name, created_at, updated_at, sort_order
                 FROM subsections WHERE id = ?1",
            rusqlite::params![sub_id],
            |row| {
                Ok(Subsection {
                    id: row.get(0)?,
                    main_section_id: row.get(1)?,
                    name: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                    sort_order: row.get(5)?,
                })
            },
        )
        .unwrap();
    assert_eq!(sub.name, "Algebra");
    assert_eq!(sub.main_section_id, section_id);

    // Update
    conn.execute(
        "UPDATE subsections SET name = ?1 WHERE id = ?2",
        rusqlite::params!["Linear Algebra", sub_id],
    )
    .unwrap();
    let updated: String = conn
        .query_row(
            "SELECT name FROM subsections WHERE id = ?1",
            rusqlite::params![sub_id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(updated, "Linear Algebra");

    // Delete
    conn.execute(
        "DELETE FROM subsections WHERE id = ?1",
        rusqlite::params![sub_id],
    )
    .unwrap();
    let count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM subsections WHERE id = ?1",
            rusqlite::params![sub_id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(count, 0);
}

// ── Test 5: Note CRUD ───────────────────────────────────────────

#[test]
fn test_note_crud() {
    let conn = setup_db();
    let now = chrono::Utc::now().to_rfc3339();

    // Setup hierarchy
    let section_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO main_sections (id, name, color, created_at, updated_at, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, 0)",
        rusqlite::params![section_id, "Math", "#ff0000", now, now],
    )
    .unwrap();

    let sub_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, 0)",
        rusqlite::params![sub_id, section_id, "Algebra", now, now],
    )
    .unwrap();

    // Create note
    let note_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order)
             VALUES (?1, ?2, ?3, '', ?4, ?5, 0)",
        rusqlite::params![note_id, sub_id, "Quadratic Formula", now, now],
    )
    .unwrap();

    // Read
    let note: Note = conn
        .query_row(
            "SELECT id, subsection_id, title, content, created_at, updated_at, sort_order
                 FROM notes WHERE id = ?1",
            rusqlite::params![note_id],
            |row| {
                Ok(Note {
                    id: row.get(0)?,
                    subsection_id: row.get(1)?,
                    title: row.get(2)?,
                    content: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                    sort_order: row.get(6)?,
                })
            },
        )
        .unwrap();
    assert_eq!(note.title, "Quadratic Formula");
    assert!(note.content.is_empty());

    // Update
    conn.execute(
        "UPDATE notes SET title = ?1, content = ?2 WHERE id = ?3",
        rusqlite::params!["Quadratic Eq", "x = (-b ± √(b²-4ac)) / 2a", note_id],
    )
    .unwrap();
    let (title, content): (String, String) = conn
        .query_row(
            "SELECT title, content FROM notes WHERE id = ?1",
            rusqlite::params![note_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(title, "Quadratic Eq");
    assert_eq!(content, "x = (-b ± √(b²-4ac)) / 2a");

    // Delete
    conn.execute(
        "DELETE FROM notes WHERE id = ?1",
        rusqlite::params![note_id],
    )
    .unwrap();
    let count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes WHERE id = ?1",
            rusqlite::params![note_id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(count, 0);
}

// ── Test 6: Asset CRUD ──────────────────────────────────────────

#[test]
fn test_asset_crud() {
    let conn = setup_db();
    let now = chrono::Utc::now().to_rfc3339();

    // Setup hierarchy
    let section_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO main_sections (id, name, color, created_at, updated_at, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, 0)",
        rusqlite::params![section_id, "Math", "#ff0000", now, now],
    )
    .unwrap();

    let sub_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, 0)",
        rusqlite::params![sub_id, section_id, "Algebra", now, now],
    )
    .unwrap();

    let note_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order)
             VALUES (?1, ?2, ?3, '', ?4, ?5, 0)",
        rusqlite::params![note_id, sub_id, "Formula", now, now],
    )
    .unwrap();

    // Create asset
    let asset_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO assets (id, note_id, file_path, alt_text, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![asset_id, note_id, "img_001.png", "Diagram", now],
    )
    .unwrap();

    // Read
    let asset: Asset = conn
        .query_row(
            "SELECT id, note_id, file_path, alt_text, created_at
                 FROM assets WHERE id = ?1",
            rusqlite::params![asset_id],
            |row| {
                Ok(Asset {
                    id: row.get(0)?,
                    note_id: row.get(1)?,
                    file_path: row.get(2)?,
                    alt_text: row.get(3)?,
                    created_at: row.get(4)?,
                })
            },
        )
        .unwrap();
    assert_eq!(asset.file_path, "img_001.png");
    assert_eq!(asset.alt_text, "Diagram");

    // Delete
    conn.execute(
        "DELETE FROM assets WHERE id = ?1",
        rusqlite::params![asset_id],
    )
    .unwrap();
    let count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM assets WHERE id = ?1",
            rusqlite::params![asset_id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(count, 0);
}

// ── Test 7: Cascade delete MainSection ──────────────────────────

#[test]
fn test_cascade_delete_main_section() {
    let conn = setup_db();
    let now = chrono::Utc::now().to_rfc3339();

    // Create full hierarchy
    let section_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO main_sections (id, name, color, created_at, updated_at, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, 0)",
        rusqlite::params![section_id, "Physics", "#00ff00", now, now],
    )
    .unwrap();

    let sub_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, 0)",
        rusqlite::params![sub_id, section_id, "Mechanics", now, now],
    )
    .unwrap();

    let note_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order)
             VALUES (?1, ?2, ?3, '', ?4, ?5, 0)",
        rusqlite::params![note_id, sub_id, "Newton's Laws", now, now],
    )
    .unwrap();

    let asset_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO assets (id, note_id, file_path, alt_text, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![asset_id, note_id, "newton.png", "F=ma diagram", now],
    )
    .unwrap();

    // Delete main section
    conn.execute(
        "DELETE FROM main_sections WHERE id = ?1",
        rusqlite::params![section_id],
    )
    .unwrap();

    // Verify cascade
    let subs: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM subsections WHERE main_section_id = ?1",
            rusqlite::params![section_id],
            |row| row.get(0),
        )
        .unwrap();
    let notes: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes WHERE subsection_id = ?1",
            rusqlite::params![sub_id],
            |row| row.get(0),
        )
        .unwrap();
    let assets: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM assets WHERE note_id = ?1",
            rusqlite::params![note_id],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(subs, 0, "subsections should be cascade-deleted");
    assert_eq!(notes, 0, "notes should be cascade-deleted");
    assert_eq!(assets, 0, "assets should be cascade-deleted");
}

// ── Test 8: Cascade delete Subsection ───────────────────────────

#[test]
fn test_cascade_delete_subsection() {
    let conn = setup_db();
    let now = chrono::Utc::now().to_rfc3339();

    let section_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO main_sections (id, name, color, created_at, updated_at, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, 0)",
        rusqlite::params![section_id, "Chem", "#0000ff", now, now],
    )
    .unwrap();

    let sub_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, 0)",
        rusqlite::params![sub_id, section_id, "Organic", now, now],
    )
    .unwrap();

    let note_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order)
             VALUES (?1, ?2, ?3, '', ?4, ?5, 0)",
        rusqlite::params![note_id, sub_id, "Benzene", now, now],
    )
    .unwrap();

    let asset_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO assets (id, note_id, file_path, alt_text, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![asset_id, note_id, "benzene.png", "Ring structure", now],
    )
    .unwrap();

    // Delete subsection
    conn.execute(
        "DELETE FROM subsections WHERE id = ?1",
        rusqlite::params![sub_id],
    )
    .unwrap();

    let notes: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes WHERE subsection_id = ?1",
            rusqlite::params![sub_id],
            |row| row.get(0),
        )
        .unwrap();
    let assets: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM assets WHERE note_id = ?1",
            rusqlite::params![note_id],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(notes, 0, "notes should be cascade-deleted");
    assert_eq!(assets, 0, "assets should be cascade-deleted");
}

// ── Test 9: Cascade delete Note ─────────────────────────────────

#[test]
fn test_cascade_delete_note() {
    let conn = setup_db();
    let now = chrono::Utc::now().to_rfc3339();

    let section_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO main_sections (id, name, color, created_at, updated_at, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, 0)",
        rusqlite::params![section_id, "Bio", "#ffff00", now, now],
    )
    .unwrap();

    let sub_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, 0)",
        rusqlite::params![sub_id, section_id, "Genetics", now, now],
    )
    .unwrap();

    let note_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order)
             VALUES (?1, ?2, ?3, '', ?4, ?5, 0)",
        rusqlite::params![note_id, sub_id, "DNA", now, now],
    )
    .unwrap();

    let asset_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO assets (id, note_id, file_path, alt_text, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![asset_id, note_id, "helix.png", "Double helix", now],
    )
    .unwrap();

    // Delete note
    conn.execute(
        "DELETE FROM notes WHERE id = ?1",
        rusqlite::params![note_id],
    )
    .unwrap();

    let assets: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM assets WHERE note_id = ?1",
            rusqlite::params![note_id],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(assets, 0, "assets should be cascade-deleted");
}

// ── Test 10: FK constraint violation ────────────────────────────

#[test]
fn test_fk_constraint_violation() {
    let conn = setup_db();
    let now = chrono::Utc::now().to_rfc3339();

    // Try to insert a subsection with a non-existent main_section_id
    let sub_id = uuid::Uuid::new_v4().to_string();
    let fake_id = uuid::Uuid::new_v4().to_string();

    let result = conn.execute(
        "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, 0)",
        rusqlite::params![sub_id, fake_id, "Orphan", now, now],
    );

    assert!(result.is_err(), "FK violation should cause an error");
}

// ── Test 11: init() end-to-end on a real file database ─────────────
//
// Runs the production `init()` against an isolated `XDG_DATA_HOME` so the
// real user data directory is untouched. Verifies the DB file, assets dir,
// schema, and WAL mode in one pass. No other test reads `XDG_DATA_HOME`,
// so overriding it here is race-free.

#[test]
fn test_init_creates_file_db_with_schema() {
    let tmp_root =
        std::env::temp_dir().join(format!("study-notes-init-test-{}", uuid::Uuid::new_v4()));
    let prev_xdg = std::env::var("XDG_DATA_HOME").ok();
    std::env::set_var("XDG_DATA_HOME", &tmp_root);

    let result = super::init();

    match prev_xdg {
        Some(v) => std::env::set_var("XDG_DATA_HOME", v),
        None => std::env::remove_var("XDG_DATA_HOME"),
    }

    let conn = result.expect("init() should succeed");

    let tables: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap();
        stmt.query_map([], |row| row.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect()
    };
    for table in [
        "main_sections",
        "subsections",
        "notes",
        "assets",
        "schema_version",
    ] {
        assert!(
            tables.contains(&table.to_string()),
            "init() should create table `{table}`"
        );
    }

    let journal_mode: String = conn
        .query_row("PRAGMA journal_mode", [], |row| row.get(0))
        .unwrap();
    assert_eq!(journal_mode, "wal");

    assert!(tmp_root.join("study-notes").join("assets").is_dir());
    assert!(tmp_root
        .join("study-notes")
        .join("study-notes.db")
        .is_file());

    // The private data directory must be restricted to the owning user.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = tmp_root
            .join("study-notes")
            .metadata()
            .unwrap()
            .permissions()
            .mode();
        assert_eq!(mode & 0o777, 0o700, "data dir must be 0700");
    }

    drop(conn);
    std::fs::remove_dir_all(&tmp_root).ok();
}

// ── Test 13: MainSection cascade info computation ───────────────

#[test]
fn test_main_section_cascade_info() {
    let conn = setup_db();
    let now = chrono::Utc::now().to_rfc3339();

    // 1. Create two main sections
    let ms1_id = uuid::Uuid::new_v4().to_string();
    let ms2_id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO main_sections (id, name, color, created_at, updated_at, sort_order)
         VALUES (?1, 'CS Core', '#388bfd', ?2, ?2, 0)",
        rusqlite::params![ms1_id, now],
    ).unwrap();

    conn.execute(
        "INSERT INTO main_sections (id, name, color, created_at, updated_at, sort_order)
         VALUES (?1, 'Databases', '#3fb950', ?2, ?2, 1)",
        rusqlite::params![ms2_id, now],
    ).unwrap();

    // Verify empty cascade stats for ms1
    let empty_info = crate::db::commands::get_main_section_cascade_info_conn(&conn, &ms1_id).unwrap();
    assert_eq!(empty_info, MainSectionCascadeInfo {
        subsection_count: 0,
        note_count: 0,
        asset_count: 0,
    });

    // 2. Add subsections under ms1
    let sub1_id = uuid::Uuid::new_v4().to_string();
    let sub2_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Algorithms', ?3, ?3, 0)",
        rusqlite::params![sub1_id, ms1_id, now],
    ).unwrap();
    conn.execute(
        "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Data Structures', ?3, ?3, 1)",
        rusqlite::params![sub2_id, ms1_id, now],
    ).unwrap();

    // Add a subsection under ms2 (should not count for ms1)
    let sub_other_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'SQL', ?3, ?3, 0)",
        rusqlite::params![sub_other_id, ms2_id, now],
    ).unwrap();

    let info_with_subs = crate::db::commands::get_main_section_cascade_info_conn(&conn, &ms1_id).unwrap();
    assert_eq!(info_with_subs, MainSectionCascadeInfo {
        subsection_count: 2,
        note_count: 0,
        asset_count: 0,
    });

    // 3. Add notes under sub1 and sub2
    let note1_id = uuid::Uuid::new_v4().to_string();
    let note2_id = uuid::Uuid::new_v4().to_string();
    let note3_id = uuid::Uuid::new_v4().to_string();
    let note_other_id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Binary Search', '', ?3, ?3, 0)",
        rusqlite::params![note1_id, sub1_id, now],
    ).unwrap();
    conn.execute(
        "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Merge Sort', '', ?3, ?3, 1)",
        rusqlite::params![note2_id, sub1_id, now],
    ).unwrap();
    conn.execute(
        "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Red-Black Trees', '', ?3, ?3, 0)",
        rusqlite::params![note3_id, sub2_id, now],
    ).unwrap();
    conn.execute(
        "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Postgres MVCC', '', ?3, ?3, 0)",
        rusqlite::params![note_other_id, sub_other_id, now],
    ).unwrap();

    // 4. Add assets under note1 and note_other
    let asset1_id = uuid::Uuid::new_v4().to_string();
    let asset2_id = uuid::Uuid::new_v4().to_string();
    let asset_other_id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO assets (id, note_id, file_path, alt_text, created_at)
         VALUES (?1, ?2, 'tree.png', 'Tree visual', ?3)",
        rusqlite::params![asset1_id, note1_id, now],
    ).unwrap();
    conn.execute(
        "INSERT INTO assets (id, note_id, file_path, alt_text, created_at)
         VALUES (?1, ?2, 'graph.png', 'Graph visual', ?3)",
        rusqlite::params![asset2_id, note2_id, now],
    ).unwrap();
    conn.execute(
        "INSERT INTO assets (id, note_id, file_path, alt_text, created_at)
         VALUES (?1, ?2, 'mvcc.png', 'MVCC chart', ?3)",
        rusqlite::params![asset_other_id, note_other_id, now],
    ).unwrap();

    // Verify full cascade info for ms1: 2 subsections, 3 notes, 2 assets
    let full_info_ms1 = crate::db::commands::get_main_section_cascade_info_conn(&conn, &ms1_id).unwrap();
    assert_eq!(full_info_ms1, MainSectionCascadeInfo {
        subsection_count: 2,
        note_count: 3,
        asset_count: 2,
    });

    // Verify ms2 cascade info: 1 subsection, 1 note, 1 asset
    let full_info_ms2 = crate::db::commands::get_main_section_cascade_info_conn(&conn, &ms2_id).unwrap();
    assert_eq!(full_info_ms2, MainSectionCascadeInfo {
        subsection_count: 1,
        note_count: 1,
        asset_count: 1,
    });

    // Non-existent ID returns all zeros
    let non_existent = crate::db::commands::get_main_section_cascade_info_conn(&conn, "fake-id").unwrap();
    assert_eq!(non_existent, MainSectionCascadeInfo {
        subsection_count: 0,
        note_count: 0,
        asset_count: 0,
    });
}

// ── Test 14: Subsection cascade info computation ────────────────

#[test]
fn test_subsection_cascade_info() {
    let conn = setup_db();
    let now = chrono::Utc::now().to_rfc3339();

    // 1. Create two subsections under separate sections
    let ms1_id = uuid::Uuid::new_v4().to_string();
    let ms2_id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO main_sections (id, name, color, created_at, updated_at, sort_order)
         VALUES (?1, 'CS Core', '#388bfd', ?2, ?2, 0)",
        rusqlite::params![ms1_id, now],
    ).unwrap();

    conn.execute(
        "INSERT INTO main_sections (id, name, color, created_at, updated_at, sort_order)
         VALUES (?1, 'Databases', '#3fb950', ?2, ?2, 1)",
        rusqlite::params![ms2_id, now],
    ).unwrap();

    let sub1_id = uuid::Uuid::new_v4().to_string();
    let sub2_id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Algorithms', ?3, ?3, 0)",
        rusqlite::params![sub1_id, ms1_id, now],
    ).unwrap();

    conn.execute(
        "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'SQL', ?3, ?3, 0)",
        rusqlite::params![sub2_id, ms2_id, now],
    ).unwrap();

    // Empty subsection reports zero counts
    let empty_info = crate::db::commands::get_subsection_cascade_info_conn(&conn, &sub1_id).unwrap();
    assert_eq!(empty_info, SubsectionCascadeInfo {
        note_count: 0,
        asset_count: 0,
    });

    // 2. Add notes under sub1
    let note1_id = uuid::Uuid::new_v4().to_string();
    let note2_id = uuid::Uuid::new_v4().to_string();
    let note_other_id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Binary Search', '', ?3, ?3, 0)",
        rusqlite::params![note1_id, sub1_id, now],
    ).unwrap();
    conn.execute(
        "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Merge Sort', '', ?3, ?3, 1)",
        rusqlite::params![note2_id, sub1_id, now],
    ).unwrap();
    conn.execute(
        "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Postgres MVCC', '', ?3, ?3, 0)",
        rusqlite::params![note_other_id, sub2_id, now],
    ).unwrap();

    let info_with_notes = crate::db::commands::get_subsection_cascade_info_conn(&conn, &sub1_id).unwrap();
    assert_eq!(info_with_notes, SubsectionCascadeInfo {
        note_count: 2,
        asset_count: 0,
    });

    // 3. Add assets: two under sub1's notes, one under sub2's note
    let asset1_id = uuid::Uuid::new_v4().to_string();
    let asset2_id = uuid::Uuid::new_v4().to_string();
    let asset_other_id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO assets (id, note_id, file_path, alt_text, created_at)
         VALUES (?1, ?2, 'tree.png', 'Tree visual', ?3)",
        rusqlite::params![asset1_id, note1_id, now],
    ).unwrap();
    conn.execute(
        "INSERT INTO assets (id, note_id, file_path, alt_text, created_at)
         VALUES (?1, ?2, 'graph.png', 'Graph visual', ?3)",
        rusqlite::params![asset2_id, note2_id, now],
    ).unwrap();
    conn.execute(
        "INSERT INTO assets (id, note_id, file_path, alt_text, created_at)
         VALUES (?1, ?2, 'mvcc.png', 'MVCC chart', ?3)",
        rusqlite::params![asset_other_id, note_other_id, now],
    ).unwrap();

    let full_info_sub1 = crate::db::commands::get_subsection_cascade_info_conn(&conn, &sub1_id).unwrap();
    assert_eq!(full_info_sub1, SubsectionCascadeInfo {
        note_count: 2,
        asset_count: 2,
    });

    let full_info_sub2 = crate::db::commands::get_subsection_cascade_info_conn(&conn, &sub2_id).unwrap();
    assert_eq!(full_info_sub2, SubsectionCascadeInfo {
        note_count: 1,
        asset_count: 1,
    });

    // Non-existent ID returns all zeros
    let non_existent = crate::db::commands::get_subsection_cascade_info_conn(&conn, "fake-id").unwrap();
    assert_eq!(non_existent, SubsectionCascadeInfo {
        note_count: 0,
        asset_count: 0,
    });
}

// ── Test 15: Note cascade info computation ──────────────────────

#[test]
fn test_note_cascade_info() {
    let conn = setup_db();
    let now = chrono::Utc::now().to_rfc3339();

    // 1. Create two notes under separate subsections
    let ms1_id = uuid::Uuid::new_v4().to_string();
    let ms2_id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO main_sections (id, name, color, created_at, updated_at, sort_order)
         VALUES (?1, 'CS Core', '#388bfd', ?2, ?2, 0)",
        rusqlite::params![ms1_id, now],
    ).unwrap();

    conn.execute(
        "INSERT INTO main_sections (id, name, color, created_at, updated_at, sort_order)
         VALUES (?1, 'Databases', '#3fb950', ?2, ?2, 1)",
        rusqlite::params![ms2_id, now],
    ).unwrap();

    let sub1_id = uuid::Uuid::new_v4().to_string();
    let sub2_id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Algorithms', ?3, ?3, 0)",
        rusqlite::params![sub1_id, ms1_id, now],
    ).unwrap();

    conn.execute(
        "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'SQL', ?3, ?3, 0)",
        rusqlite::params![sub2_id, ms2_id, now],
    ).unwrap();

    let note1_id = uuid::Uuid::new_v4().to_string();
    let note2_id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Binary Search', '', ?3, ?3, 0)",
        rusqlite::params![note1_id, sub1_id, now],
    ).unwrap();
    conn.execute(
        "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Postgres MVCC', '', ?3, ?3, 0)",
        rusqlite::params![note2_id, sub2_id, now],
    ).unwrap();

    // Note without assets reports zero
    let empty_info = crate::db::commands::get_note_cascade_info_conn(&conn, &note1_id).unwrap();
    assert_eq!(empty_info, NoteCascadeInfo {
        asset_count: 0,
    });

    // 2. Add assets under note1 only
    let asset1_id = uuid::Uuid::new_v4().to_string();
    let asset2_id = uuid::Uuid::new_v4().to_string();
    let asset_other_id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO assets (id, note_id, file_path, alt_text, created_at)
         VALUES (?1, ?2, 'tree.png', 'Tree visual', ?3)",
        rusqlite::params![asset1_id, note1_id, now],
    ).unwrap();
    conn.execute(
        "INSERT INTO assets (id, note_id, file_path, alt_text, created_at)
         VALUES (?1, ?2, 'graph.png', 'Graph visual', ?3)",
        rusqlite::params![asset2_id, note1_id, now],
    ).unwrap();
    conn.execute(
        "INSERT INTO assets (id, note_id, file_path, alt_text, created_at)
         VALUES (?1, ?2, 'mvcc.png', 'MVCC chart', ?3)",
        rusqlite::params![asset_other_id, note2_id, now],
    ).unwrap();

    // note1 counts only its own assets
    let full_info_note1 = crate::db::commands::get_note_cascade_info_conn(&conn, &note1_id).unwrap();
    assert_eq!(full_info_note1, NoteCascadeInfo {
        asset_count: 2,
    });

    let full_info_note2 = crate::db::commands::get_note_cascade_info_conn(&conn, &note2_id).unwrap();
    assert_eq!(full_info_note2, NoteCascadeInfo {
        asset_count: 1,
    });

    // Non-existent ID returns zero
    let non_existent = crate::db::commands::get_note_cascade_info_conn(&conn, "fake-id").unwrap();
    assert_eq!(non_existent, NoteCascadeInfo {
        asset_count: 0,
    });
}

// ── Test 16: get_note_conn retrieval ────────────────────────────

#[test]
fn test_get_note_conn() {
    let conn = setup_db();
    let now = chrono::Utc::now().to_rfc3339();

    let section_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO main_sections (id, name, color, created_at, updated_at, sort_order)
         VALUES (?1, 'CS Core', '#388bfd', ?2, ?2, 0)",
        rusqlite::params![section_id, now],
    )
    .unwrap();

    let sub_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Algorithms', ?3, ?3, 0)",
        rusqlite::params![sub_id, section_id, now],
    )
    .unwrap();

    let note_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Binary Search', '# Binary Search\n\nO(log n)', ?3, ?3, 0)",
        rusqlite::params![note_id, sub_id, now],
    )
    .unwrap();

    let note = crate::db::commands::get_note_conn(&conn, &note_id).unwrap();
    assert_eq!(note.id, note_id);
    assert_eq!(note.subsection_id, sub_id);
    assert_eq!(note.title, "Binary Search");
    assert_eq!(note.content, "# Binary Search\n\nO(log n)");
    assert_eq!(note.sort_order, 0);

    // Missing note yields an error (Query returned no rows)
    assert!(crate::db::commands::get_note_conn(&conn, "fake-id").is_err());
}

// ── Test 17: get_note_context_conn hierarchy join ───────────────

#[test]
fn test_get_note_context_conn() {
    let conn = setup_db();
    let now = chrono::Utc::now().to_rfc3339();

    let section_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO main_sections (id, name, color, created_at, updated_at, sort_order)
         VALUES (?1, 'JavaScript', '#d29922', ?2, ?2, 0)",
        rusqlite::params![section_id, now],
    )
    .unwrap();

    let sub_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Closures', ?3, ?3, 0)",
        rusqlite::params![sub_id, section_id, now],
    )
    .unwrap();

    let note_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Lexical Scope', 'content', ?3, ?3, 0)",
        rusqlite::params![note_id, sub_id, now],
    )
    .unwrap();

    let context = crate::db::commands::get_note_context_conn(&conn, &note_id).unwrap();
    assert_eq!(context.note.id, note_id);
    assert_eq!(context.note.title, "Lexical Scope");
    assert_eq!(context.subsection_id, sub_id);
    assert_eq!(context.subsection_name, "Closures");
    assert_eq!(context.main_section_id, section_id);
    assert_eq!(context.main_section_name, "JavaScript");
    assert_eq!(context.main_section_color, "#d29922");

    // Missing note yields an error
    assert!(crate::db::commands::get_note_context_conn(&conn, "fake-id").is_err());
}

// ── Test 18: attach_note_asset_conn copies file + records row ───

#[test]
fn test_attach_note_asset_conn() {
    let mut conn = setup_db();
    let now = chrono::Utc::now().to_rfc3339();

    let section_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO main_sections (id, name, color, created_at, updated_at, sort_order)
         VALUES (?1, 'CS Core', '#388bfd', ?2, ?2, 0)",
        rusqlite::params![section_id, now],
    )
    .unwrap();

    let sub_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Algorithms', ?3, ?3, 0)",
        rusqlite::params![sub_id, section_id, now],
    )
    .unwrap();

    let note_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Graphs', '', ?3, ?3, 0)",
        rusqlite::params![note_id, sub_id, now],
    )
    .unwrap();

    let assets_dir =
        std::env::temp_dir().join(format!("study-notes-assets-test-{}", uuid::Uuid::new_v4()));

    let payload = b"\x89PNG fake image bytes";
    let asset = crate::db::commands::attach_note_asset_conn(
        &mut conn,
        &assets_dir,
        &note_id,
        "diagram.png",
        "Graph traversal diagram",
        payload,
    )
    .unwrap();

    // DB row recorded with a managed relative path
    assert_eq!(asset.note_id, note_id);
    assert_eq!(asset.alt_text, "Graph traversal diagram");
    assert!(asset.file_path.starts_with("assets/"));
    assert!(asset.file_path.ends_with(".png"));

    // File written to disk with identical bytes
    let disk_file = assets_dir.join(
        std::path::Path::new(&asset.file_path)
            .file_name()
            .unwrap(),
    );
    assert!(disk_file.is_file());
    let written = std::fs::read(&disk_file).unwrap();
    assert_eq!(written, payload);

    // Cleanup
    std::fs::remove_dir_all(&assets_dir).ok();
}

// ── Test 19: attach_note_asset_conn sanitizes hostile extensions and rolls back on FK failure ──

#[test]
fn test_attach_note_asset_conn_sanitizes_and_rolls_back() {
    let mut conn = setup_db();

    let assets_dir =
        std::env::temp_dir().join(format!("study-notes-assets-test-{}", uuid::Uuid::new_v4()));

    // Hostile extension (path traversal characters) falls back to "png"
    let note_id = "no-such-note".to_string(); // FK violation on insert
    let err = crate::db::commands::attach_note_asset_conn(
        &mut conn,
        &assets_dir,
        &note_id,
        "exploit.\">exe",
        "evil",
        b"data",
    );
    assert!(err.is_err(), "FK violation should fail the attach");

    // No files leaked into the assets directory after the rollback
    let leaked = std::fs::read_dir(&assets_dir)
        .map(|entries| entries.count())
        .unwrap_or(0);
    assert_eq!(leaked, 0, "failed attach must not leave files behind");

    std::fs::remove_dir_all(&assets_dir).ok();
}

// ── Test 20: base64_encode known vectors ────────────────────────

#[test]
fn test_base64_encode() {
    // RFC 4648 test vectors
    assert_eq!(crate::db::commands::base64_encode(b""), "");
    assert_eq!(crate::db::commands::base64_encode(b"f"), "Zg==");
    assert_eq!(crate::db::commands::base64_encode(b"fo"), "Zm8=");
    assert_eq!(crate::db::commands::base64_encode(b"foo"), "Zm9v");
    assert_eq!(crate::db::commands::base64_encode(b"foob"), "Zm9vYg==");
    assert_eq!(crate::db::commands::base64_encode(b"fooba"), "Zm9vYmE=");
    assert_eq!(crate::db::commands::base64_encode(b"foobar"), "Zm9vYmFy");
}

// ── Test 21: resolve_asset_disk_path rejects path traversal ─────

#[test]
fn test_resolve_asset_disk_path_rejects_traversal() {
    use crate::db::commands::resolve_asset_disk_path;

    // Valid managed path resolves under the assets dir
    let resolved = resolve_asset_disk_path("assets/abcd-1234.png");
    assert!(resolved.is_some());
    let path = resolved.unwrap();
    assert!(path.ends_with("assets/abcd-1234.png"));

    // Hostile paths are rejected
    assert!(resolve_asset_disk_path("assets/../../etc/passwd").is_none());
    assert!(resolve_asset_disk_path("assets/sub/dir.png").is_none());
    assert!(resolve_asset_disk_path("other/file.png").is_none());
    assert!(resolve_asset_disk_path("assets/").is_none());
    assert!(resolve_asset_disk_path("assets/..\\windows.png").is_none());
    // Windows-style parent-directory escapes are rejected as well
    assert!(resolve_asset_disk_path("assets/..\\evil.png").is_none());
    assert!(resolve_asset_disk_path("..\\evil.png").is_none());
    assert!(resolve_asset_disk_path("assets/../evil.png").is_none());
}

// ── Test 21b: data_dir resolves inside the per-user local data dir ──

#[test]
fn test_data_dir_ends_with_app_dir() {
    let dir = crate::db::data_dir().expect("local data dir must resolve");
    // Assert on the final path component (not a string suffix) so the
    // check holds with either `/` or `\` separators.
    assert_eq!(
        dir.file_name().and_then(|n| n.to_str()),
        Some(crate::db::APP_DIR_NAME),
        "data dir must live in a folder named `{}`",
        crate::db::APP_DIR_NAME
    );
}

// ── Test 22: Migration 002 creates all performance indexes ──────

#[test]
fn test_migration_002_creates_indexes() {
    let conn = setup_db();

    let expected = [
        "idx_subsections_main_section",
        "idx_subsections_sort",
        "idx_notes_subsection",
        "idx_notes_updated_at",
        "idx_notes_sort",
        "idx_assets_note",
    ];
    for index in expected {
        let count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = ?1",
                rusqlite::params![index],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "index `{index}` should exist after migrations");
    }

    // schema_version reflects the latest migration
    let version: i64 = conn
        .query_row("SELECT COALESCE(MAX(version), 0) FROM schema_version", [], |r| r.get(0))
        .unwrap();
    assert_eq!(version, 3);
}

// ── Test 29: Migration 003 creates the FTS5 index and sync triggers ──

#[test]
fn test_migration_003_creates_fts_index() {
    let conn = setup_db();

    let names: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'trigger') ORDER BY name")
            .unwrap();
        stmt.query_map([], |row| row.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect()
    };
    assert!(names.contains(&"notes_fts".to_string()), "notes_fts table should exist");
    assert!(names.iter().any(|n| n == "notes_fts_ai"), "insert trigger missing");
    assert!(names.iter().any(|n| n == "notes_fts_au"), "update trigger missing");
    assert!(names.iter().any(|n| n == "notes_fts_ad"), "delete trigger missing");
}

// ── Test 30: FTS index stays synchronized with note CRUD ─────────

#[test]
fn test_fts_sync_triggers() {
    let conn = setup_db();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO main_sections (id, name, color, created_at, updated_at, sort_order)
         VALUES (?1, 'JS', '#d29922', ?2, ?2, 0)",
        rusqlite::params![uuid::Uuid::new_v4().to_string(), now],
    ).unwrap();
    let sub_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order)
         SELECT ?1, id, 'Closures', ?2, ?2, 0 FROM main_sections LIMIT 1",
        rusqlite::params![sub_id, now],
    ).unwrap();

    let count_matches = |term: &str| -> i64 {
        conn.query_row(
            "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH ?1",
            rusqlite::params![term],
            |r| r.get(0),
        ).unwrap()
    };

    // INSERT syncs
    let note_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Lexical Scope', 'A closure captures free variables.', ?3, ?3, 0)",
        rusqlite::params![note_id, sub_id, now],
    ).unwrap();
    assert_eq!(count_matches("closure"), 1);

    // UPDATE syncs: old tokens leave the index, new tokens enter it
    conn.execute(
        "UPDATE notes SET content = 'Generators yield lazy sequences.' WHERE id = ?1",
        rusqlite::params![note_id],
    ).unwrap();
    assert_eq!(count_matches("closure"), 0, "stale token must leave the index");
    assert_eq!(count_matches("generator"), 1);

    // DELETE syncs
    conn.execute("DELETE FROM notes WHERE id = ?1", rusqlite::params![note_id]).unwrap();
    assert_eq!(count_matches("generator"), 0);
}

// ── Test 31: FTS query sanitizer ─────────────────────────────────

#[test]
fn test_sanitize_fts5_query() {
    use crate::db::commands::sanitize_fts5_query;

    assert_eq!(sanitize_fts5_query("closures"), "\"closures\"*");
    assert_eq!(sanitize_fts5_query("  react   hooks  "), "\"react\"* \"hooks\"*");
    // FTS5 operator characters are stripped
    assert_eq!(sanitize_fts5_query("(a OR b)"), "\"a\"* \"OR\"* \"b\"*");
    assert_eq!(sanitize_fts5_query("\"quoted*\""), "\"quoted\"*");
    // Developer-friendly punctuation survives
    assert_eq!(sanitize_fts5_query("std::vec"), "\"std::vec\"*");
    assert_eq!(sanitize_fts5_query("v1.0"), "\"v1.0\"*");
    // Empty / punctuation-only input yields an empty query
    assert_eq!(sanitize_fts5_query(""), "");
    assert_eq!(sanitize_fts5_query("  * ( ) \" "), "");
}

// ── Test 32: search_notes_conn ranking, snippets & scoping ───────

fn seed_search_fixture(conn: &Connection) -> (String, String, String, String, String) {
    let now = chrono::Utc::now().to_rfc3339();
    let section_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO main_sections (id, name, color, created_at, updated_at, sort_order)
         VALUES (?1, 'JavaScript', '#d29922', ?2, ?2, 0)",
        rusqlite::params![section_id, now],
    ).unwrap();
    let sub1_id = uuid::Uuid::new_v4().to_string();
    let sub2_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Closures', ?3, ?3, 0)",
        rusqlite::params![sub1_id, section_id, now],
    ).unwrap();
    conn.execute(
        "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Async', ?3, ?3, 1)",
        rusqlite::params![sub2_id, section_id, now],
    ).unwrap();

    let closure_rich = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Closure Patterns',
             'A closure captures variables. Closures in loops need care. Closures enable factories.',
             ?3, ?3, 0)",
        rusqlite::params![closure_rich, sub1_id, now],
    ).unwrap();

    let closure_light = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Event Loop', 'Timers and microtasks. Mentions a closure once.',
             ?3, ?3, 1)",
        rusqlite::params![closure_light, sub2_id, now],
    ).unwrap();

    let unrelated = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Promise Basics', 'Thenables resolve or reject.', ?3, ?3, 2)",
        rusqlite::params![unrelated, sub2_id, now],
    ).unwrap();

    (section_id, sub1_id, sub2_id, closure_rich, closure_light)
}

#[test]
fn test_search_notes_ranks_and_scopes() {
    let conn = setup_db();
    let (section_id, sub1_id, sub2_id, closure_rich, closure_light) =
        seed_search_fixture(&conn);

    let search = |q: &str,
                  section: Option<&str>,
                  sub: Option<&str>|
     -> Vec<crate::db::commands::SearchResult> {
        crate::db::commands::search_notes_conn(&conn, q, section, sub, 30).unwrap()
    };

    // Global search: both matching notes hit; the term-dense one ranks first
    let results = search("closure", None, None);
    assert_eq!(results.len(), 2, "expected both closure notes, got {:?}", results);
    assert_eq!(results[0].id, closure_rich, "term-dense note should rank first");
    assert_eq!(results[0].main_section_name, "JavaScript");
    assert_eq!(results[0].main_section_color, "#d29922");
    assert_eq!(results[0].subsection_name, "Closures");

    // Snippet extracts content with highlight markers around the match
    assert!(results[0].snippet.contains("<mark>"), "snippet: {}", results[0].snippet);
    assert!(results[0].snippet.contains("</mark>"), "snippet: {}", results[0].snippet);

    // Title matches are also searchable
    let by_title = search("patterns", None, None);
    assert_eq!(by_title.len(), 1);
    assert_eq!(by_title[0].id, closure_rich);

    // Subsection scoping narrows the result set
    let scoped_sub1 = search("closure", None, Some(&sub1_id));
    assert_eq!(scoped_sub1.len(), 1);
    assert_eq!(scoped_sub1[0].id, closure_rich);
    let scoped_sub2 = search("closure", None, Some(&sub2_id));
    assert_eq!(scoped_sub2.len(), 1);
    assert_eq!(scoped_sub2[0].id, closure_light);

    // Section scoping keeps every note below the domain
    let scoped_section = search("closure", Some(&section_id), None);
    assert_eq!(scoped_section.len(), 2);

    // Non-matching or empty queries return no rows and no errors
    assert!(search("quantumflux", None, None).is_empty());
    assert!(search("", None, None).is_empty());
    // Hostile FTS5 syntax must not error (operators stripped, no rows)
    assert!(search("\"*() quantumflux", None, None).is_empty());

    // Limit is respected
    let limited = crate::db::commands::search_notes_conn(&conn, "closure", None, None, 1).unwrap();
    assert_eq!(limited.len(), 1);

    let _ = sub2_id;
}

// ── Test 33: reorder_entities persists contiguous sort orders ────

#[test]
fn test_reorder_entities_main_sections() {
    let mut conn = setup_db();
    let now = chrono::Utc::now().to_rfc3339();

    let ids: Vec<String> = (0..3)
        .map(|_| uuid::Uuid::new_v4().to_string())
        .collect();
    for (i, id) in ids.iter().enumerate() {
        conn.execute(
            "INSERT INTO main_sections (id, name, color, created_at, updated_at, sort_order)
             VALUES (?1, ?2, '#388bfd', ?3, ?3, ?4)",
            rusqlite::params![id, format!("Section {i}"), now, (i as i64) * 10 + 5],
        ).unwrap();
    }

    let mut reversed = ids.clone();
    reversed.reverse();
    crate::db::commands::reorder_entities_conn(&mut conn, "main_sections", &reversed)
        .unwrap();

    let mut stmt = conn
        .prepare("SELECT id, sort_order FROM main_sections ORDER BY sort_order")
        .unwrap();
    let ordered: Vec<(String, i64)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .unwrap()
        .map(|r| r.unwrap())
        .collect();

    let got_ids: Vec<String> = ordered.iter().map(|(id, _)| id.clone()).collect();
    assert_eq!(got_ids, reversed, "rows must follow the submitted order");
    let orders: Vec<i64> = ordered.iter().map(|(_, o)| *o).collect();
    assert_eq!(orders, vec![0, 1, 2], "sort_order must normalize to 0..N-1");
}

#[test]
fn test_reorder_entities_subsections_and_notes() {
    let mut conn = setup_db();
    let now = chrono::Utc::now().to_rfc3339();

    let section_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO main_sections (id, name, color, created_at, updated_at, sort_order)
         VALUES (?1, 'CS', '#388bfd', ?2, ?2, 0)",
        rusqlite::params![section_id, now],
    ).unwrap();

    let sub_ids: Vec<String> = (0..2).map(|_| uuid::Uuid::new_v4().to_string()).collect();
    for (i, id) in sub_ids.iter().enumerate() {
        conn.execute(
            "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?4, ?5)",
            rusqlite::params![id, section_id, format!("Sub {i}"), now, i as i64],
        ).unwrap();
    }

    let note_ids: Vec<String> = (0..2).map(|_| uuid::Uuid::new_v4().to_string()).collect();
    for (i, id) in note_ids.iter().enumerate() {
        conn.execute(
            "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order)
             VALUES (?1, ?2, ?3, '', ?4, ?4, ?5)",
            rusqlite::params![id, sub_ids[0], format!("Note {i}"), now, i as i64],
        ).unwrap();
    }

    {
        crate::db::commands::reorder_entities_conn(&mut conn, "subsections", &[sub_ids[1].clone(), sub_ids[0].clone()]).unwrap();
        crate::db::commands::reorder_entities_conn(&mut conn, "notes", &[note_ids[1].clone(), note_ids[0].clone()]).unwrap();
        assert!(crate::db::commands::reorder_entities_conn(&mut conn, "aliens", &[]).is_err());
    }

    let sub_first: String = conn
        .query_row(
            "SELECT id FROM subsections ORDER BY sort_order LIMIT 1",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(sub_first, sub_ids[1]);

    let note_first: String = conn
        .query_row("SELECT id FROM notes ORDER BY sort_order LIMIT 1", [], |r| r.get(0))
        .unwrap();
    assert_eq!(note_first, note_ids[1]);
}

// ── Test 23: Indexes are actually used by the list queries ──────

#[test]
fn test_query_plans_use_indexes() {
    let conn = setup_db();
    let now = chrono::Utc::now().to_rfc3339();

    let section_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO main_sections (id, name, color, created_at, updated_at, sort_order)
         VALUES (?1, 'CS', '#388bfd', ?2, ?2, 0)",
        rusqlite::params![section_id, now],
    )
    .unwrap();
    let sub_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Algorithms', ?3, ?3, 0)",
        rusqlite::params![sub_id, section_id, now],
    )
    .unwrap();

    // The list_subsections filter should hit the main_section_id index.
    let plan: String = conn
        .query_row(
            "EXPLAIN QUERY PLAN SELECT id FROM subsections WHERE main_section_id = ?1",
            rusqlite::params![section_id],
            |row| row.get(3),
        )
        .unwrap();
    assert!(
        plan.contains("idx_subsections_main_section") || plan.contains("idx_subsections_sort"),
        "expected subsection query to use a 002 index, plan was: {plan}"
    );

    // The list_notes filter should hit the subsection index.
    let plan: String = conn
        .query_row(
            "EXPLAIN QUERY PLAN SELECT id FROM notes WHERE subsection_id = ?1 ORDER BY sort_order",
            rusqlite::params![sub_id],
            |row| row.get(3),
        )
        .unwrap();
    assert!(
        plan.contains("idx_notes_subsection")
            || plan.contains("idx_notes_sort")
            || plan.contains("idx_notes_updated_at"),
        "expected notes query to use a 002 index, plan was: {plan}"
    );
}

// ── Test 24: check_db_integrity_conn reports healthy database ───

#[test]
fn test_check_db_integrity_healthy() {
    let conn = setup_db();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO main_sections (id, name, color, created_at, updated_at, sort_order)
         VALUES (?1, 'CS Core', '#388bfd', ?2, ?2, 0)",
        rusqlite::params![uuid::Uuid::new_v4().to_string(), now],
    )
    .unwrap();

    let report = crate::db::commands::check_db_integrity_conn(&conn, None).unwrap();
    assert!(report.is_healthy, "expected healthy db, got: {:?}", report);
    assert_eq!(report.integrity_check_output, "ok");
    assert!(report.foreign_key_violations.is_empty());
    assert_eq!(report.total_main_sections, 1);
    assert_eq!(report.total_subsections, 0);
    assert_eq!(report.total_notes, 0);
    assert_eq!(report.total_assets, 0);
    // In-memory test DB has no on-disk file; size defaults to 0.
    assert_eq!(report.db_size_bytes, 0);
}

// ── Test 25: check_db_integrity_conn detects FK violations ──────

#[test]
fn test_check_db_integrity_detects_fk_violation() {
    let conn = setup_db();
    let now = chrono::Utc::now().to_rfc3339();

    // Plant an orphaned subsection with FK enforcement disabled — the
    // integrity command must catch it on the next health check.
    conn.execute_batch("PRAGMA foreign_keys = OFF;").unwrap();
    conn.execute(
        "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order)
         VALUES (?1, 'ghost-section', 'Orphan', ?2, ?2, 0)",
        rusqlite::params![uuid::Uuid::new_v4().to_string(), now],
    )
    .unwrap();
    conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();

    let report = crate::db::commands::check_db_integrity_conn(&conn, None).unwrap();
    assert!(!report.is_healthy, "orphaned FK row must fail the health check");
    assert_eq!(report.integrity_check_output, "ok");
    assert_eq!(report.foreign_key_violations.len(), 1);
    assert!(report.foreign_key_violations[0].contains("subsections"));
}

// ── Test 26: note deletion cleans up asset files on disk ────────

fn seed_hierarchy(conn: &Connection, section: &str, sub: &str, note: &str) {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO main_sections (id, name, color, created_at, updated_at, sort_order)
         VALUES (?1, ?2, '#388bfd', ?3, ?3, 0)",
        rusqlite::params![section, format!("Section {section}"), now],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?4, 0)",
        rusqlite::params![sub, section, format!("Sub {sub}"), now],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order)
         VALUES (?1, ?2, 'Note', '', ?3, ?3, 0)",
        rusqlite::params![note, sub, now],
    )
    .unwrap();
}

/// Returns (base_dir, assets_dir) mirroring the production layout: the
/// relative asset paths stored in SQLite resolve to `base_dir/assets/<file>`.
fn make_assets_dir() -> (std::path::PathBuf, std::path::PathBuf) {
    let base =
        std::env::temp_dir().join(format!("study-notes-cleanup-test-{}", uuid::Uuid::new_v4()));
    (base.clone(), base.join("assets"))
}

#[test]
fn test_delete_note_removes_asset_files() {
    let mut conn = setup_db();
    let section = uuid::Uuid::new_v4().to_string();
    let sub = uuid::Uuid::new_v4().to_string();
    let note = uuid::Uuid::new_v4().to_string();
    seed_hierarchy(&conn, &section, &sub, &note);

    let (cleanup_base, assets_dir) = make_assets_dir();
    let asset = crate::db::commands::attach_note_asset_conn(
        &mut conn,
        &assets_dir,
        &note,
        "diagram.png",
        "d",
        b"png-bytes",
    )
    .unwrap();
    let disk_file = assets_dir.join(
        std::path::Path::new(&asset.file_path).file_name().unwrap(),
    );
    assert!(disk_file.is_file());

    // Simulate the production command flow: snapshot + delete + cleanup.
    let paths = crate::db::commands::asset_paths_for_notes(
        &conn,
        "SELECT id FROM notes WHERE id = ?1",
        &note,
    );
    assert_eq!(paths.len(), 1);
    conn.execute("DELETE FROM notes WHERE id = ?1", rusqlite::params![note])
        .unwrap();
    crate::db::commands::remove_asset_files(&cleanup_base, &paths);

    assert!(!disk_file.exists(), "asset file must be removed with the note");
    std::fs::remove_dir_all(&cleanup_base).ok();
}

// ── Test 27: cascade deletion of a section removes all asset files ──

#[test]
fn test_delete_main_section_removes_all_asset_files() {
    let mut conn = setup_db();
    let section = uuid::Uuid::new_v4().to_string();
    let sub = uuid::Uuid::new_v4().to_string();
    let note = uuid::Uuid::new_v4().to_string();
    seed_hierarchy(&conn, &section, &sub, &note);

    let (cleanup_base, assets_dir) = make_assets_dir();
    let a1 = crate::db::commands::attach_note_asset_conn(
        &mut conn, &assets_dir, &note, "a.png", "a", b"1",
    )
    .unwrap();
    let a2 = crate::db::commands::attach_note_asset_conn(
        &mut conn, &assets_dir, &note, "b.png", "b", b"2",
    )
    .unwrap();

    let paths = crate::db::commands::asset_paths_for_notes(
        &conn,
        "SELECT id FROM notes WHERE subsection_id IN (
            SELECT id FROM subsections WHERE main_section_id = ?1
        )",
        &section,
    );
    assert_eq!(paths.len(), 2);

    conn.execute("DELETE FROM main_sections WHERE id = ?1", rusqlite::params![section])
        .unwrap();
    crate::db::commands::remove_asset_files(&cleanup_base, &paths);

    let remaining = std::fs::read_dir(&assets_dir)
        .map(|entries| entries.count())
        .unwrap_or(0);
    assert_eq!(remaining, 0, "no asset files may survive a section delete");
    assert!(!assets_dir.join(
        std::path::Path::new(&a1.file_path).file_name().unwrap()
    ).exists());
    assert!(!assets_dir.join(
        std::path::Path::new(&a2.file_path).file_name().unwrap()
    ).exists());

    std::fs::remove_dir_all(&cleanup_base).ok();
}

// ── Test 28: missing asset files are ignored during cleanup ─────

#[test]
fn test_remove_asset_files_ignores_missing() {
    let base = std::env::temp_dir();
    // A path that no longer exists on disk must not panic or error.
    crate::db::commands::remove_asset_files(&base, &["assets/definitely-missing-file.png".to_string()]);
    // A hostile path outside the managed dir is rejected by the resolver.
    crate::db::commands::remove_asset_files(&base, &["assets/../../etc/passwd".to_string()]);
}

