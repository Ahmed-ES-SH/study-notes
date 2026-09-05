use rusqlite::Connection;

use crate::db::migration;
use crate::db::models::{Asset, MainSection, MainSectionCascadeInfo, Note, Subsection, SubsectionCascadeInfo};
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

