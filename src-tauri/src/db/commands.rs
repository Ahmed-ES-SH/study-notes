use rusqlite::Connection;
use std::sync::Mutex;
use tauri::State;

use super::models::{Asset, MainSection, MainSectionCascadeInfo, Note, Subsection};

// ── Main Sections ───────────────────────────────────────────────────

#[tauri::command]
pub fn list_main_sections(state: State<'_, Mutex<Connection>>) -> Result<Vec<MainSection>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, color, created_at, updated_at, sort_order
             FROM main_sections ORDER BY sort_order, created_at",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(MainSection {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                sort_order: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_main_section(
    state: State<'_, Mutex<Connection>>,
    name: String,
    color: String,
) -> Result<MainSection, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute("BEGIN IMMEDIATE", [])
        .map_err(|e| e.to_string())?;
    let result = conn.execute(
        "INSERT INTO main_sections (id, name, color, created_at, updated_at, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5, 0)",
        rusqlite::params![id, name, color, now, now],
    );
    match result {
        Ok(_) => {
            conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
        }
        Err(e) => {
            conn.execute("ROLLBACK", []).ok();
            return Err(e.to_string());
        }
    }

    Ok(MainSection {
        id,
        name,
        color,
        created_at: now.clone(),
        updated_at: now,
        sort_order: 0,
    })
}

#[tauri::command]
pub fn update_main_section(
    state: State<'_, Mutex<Connection>>,
    id: String,
    name: Option<String>,
    color: Option<String>,
) -> Result<MainSection, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute("BEGIN IMMEDIATE", [])
        .map_err(|e| e.to_string())?;

    if let Some(ref n) = name {
        conn.execute(
            "UPDATE main_sections SET name = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![n, now, id],
        )
        .map_err(|e| {
            conn.execute("ROLLBACK", []).ok();
            e.to_string()
        })?;
    }
    if let Some(ref c) = color {
        conn.execute(
            "UPDATE main_sections SET color = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![c, now, id],
        )
        .map_err(|e| {
            conn.execute("ROLLBACK", []).ok();
            e.to_string()
        })?;
    }

    conn.execute("COMMIT", []).map_err(|e| e.to_string())?;

    conn.query_row(
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
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_main_section(state: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    conn.execute("BEGIN IMMEDIATE", [])
        .map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM main_sections WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| {
        conn.execute("ROLLBACK", []).ok();
        e.to_string()
    })?;
    conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_main_section_cascade_info(
    state: State<'_, Mutex<Connection>>,
    id: String,
) -> Result<MainSectionCascadeInfo, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    get_main_section_cascade_info_conn(&conn, &id).map_err(|e| e.to_string())
}

pub fn get_main_section_cascade_info_conn(
    conn: &Connection,
    id: &str,
) -> rusqlite::Result<MainSectionCascadeInfo> {
    let subsection_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM subsections WHERE main_section_id = ?1",
        rusqlite::params![id],
        |r| r.get(0),
    ).unwrap_or(0);

    let note_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM notes WHERE subsection_id IN (
            SELECT id FROM subsections WHERE main_section_id = ?1
        )",
        rusqlite::params![id],
        |r| r.get(0),
    ).unwrap_or(0);

    let asset_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM assets WHERE note_id IN (
            SELECT id FROM notes WHERE subsection_id IN (
                SELECT id FROM subsections WHERE main_section_id = ?1
            )
        )",
        rusqlite::params![id],
        |r| r.get(0),
    ).unwrap_or(0);

    Ok(MainSectionCascadeInfo {
        subsection_count,
        note_count,
        asset_count,
    })
}

// ── Subsections ─────────────────────────────────────────────────────

#[tauri::command]
pub fn list_subsections(
    state: State<'_, Mutex<Connection>>,
    main_section_id: String,
) -> Result<Vec<Subsection>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, main_section_id, name, created_at, updated_at, sort_order
             FROM subsections
             WHERE main_section_id = ?1
             ORDER BY sort_order, created_at",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![main_section_id], |row| {
            Ok(Subsection {
                id: row.get(0)?,
                main_section_id: row.get(1)?,
                name: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                sort_order: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_subsection(
    state: State<'_, Mutex<Connection>>,
    main_section_id: String,
    name: String,
) -> Result<Subsection, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute("BEGIN IMMEDIATE", [])
        .map_err(|e| e.to_string())?;
    let result = conn.execute(
        "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5, 0)",
        rusqlite::params![id, main_section_id, name, now, now],
    );
    match result {
        Ok(_) => {
            conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
        }
        Err(e) => {
            conn.execute("ROLLBACK", []).ok();
            return Err(e.to_string());
        }
    }

    Ok(Subsection {
        id,
        main_section_id,
        name,
        created_at: now.clone(),
        updated_at: now,
        sort_order: 0,
    })
}

#[tauri::command]
pub fn update_subsection(
    state: State<'_, Mutex<Connection>>,
    id: String,
    name: Option<String>,
) -> Result<Subsection, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute("BEGIN IMMEDIATE", [])
        .map_err(|e| e.to_string())?;
    if let Some(ref n) = name {
        conn.execute(
            "UPDATE subsections SET name = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![n, now, id],
        )
        .map_err(|e| {
            conn.execute("ROLLBACK", []).ok();
            e.to_string()
        })?;
    }
    conn.execute("COMMIT", []).map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, main_section_id, name, created_at, updated_at, sort_order
         FROM subsections WHERE id = ?1",
        rusqlite::params![id],
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
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_subsection(state: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    conn.execute("BEGIN IMMEDIATE", [])
        .map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM subsections WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| {
        conn.execute("ROLLBACK", []).ok();
        e.to_string()
    })?;
    conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
    Ok(())
}

// ── Notes ───────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_notes(
    state: State<'_, Mutex<Connection>>,
    subsection_id: String,
) -> Result<Vec<Note>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, subsection_id, title, content, created_at, updated_at, sort_order
             FROM notes
             WHERE subsection_id = ?1
             ORDER BY sort_order, created_at",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![subsection_id], |row| {
            Ok(Note {
                id: row.get(0)?,
                subsection_id: row.get(1)?,
                title: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                sort_order: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_note(
    state: State<'_, Mutex<Connection>>,
    subsection_id: String,
    title: String,
) -> Result<Note, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute("BEGIN IMMEDIATE", [])
        .map_err(|e| e.to_string())?;
    let result = conn.execute(
        "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order)
         VALUES (?1, ?2, ?3, '', ?4, ?5, 0)",
        rusqlite::params![id, subsection_id, title, now, now],
    );
    match result {
        Ok(_) => {
            conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
        }
        Err(e) => {
            conn.execute("ROLLBACK", []).ok();
            return Err(e.to_string());
        }
    }

    Ok(Note {
        id,
        subsection_id,
        title,
        content: String::new(),
        created_at: now.clone(),
        updated_at: now,
        sort_order: 0,
    })
}

#[tauri::command]
pub fn update_note(
    state: State<'_, Mutex<Connection>>,
    id: String,
    title: Option<String>,
    content: Option<String>,
) -> Result<Note, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute("BEGIN IMMEDIATE", [])
        .map_err(|e| e.to_string())?;
    if let Some(ref t) = title {
        conn.execute(
            "UPDATE notes SET title = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![t, now, id],
        )
        .map_err(|e| {
            conn.execute("ROLLBACK", []).ok();
            e.to_string()
        })?;
    }
    if let Some(ref c) = content {
        conn.execute(
            "UPDATE notes SET content = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![c, now, id],
        )
        .map_err(|e| {
            conn.execute("ROLLBACK", []).ok();
            e.to_string()
        })?;
    }
    conn.execute("COMMIT", []).map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, subsection_id, title, content, created_at, updated_at, sort_order
         FROM notes WHERE id = ?1",
        rusqlite::params![id],
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
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_note(state: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    conn.execute("BEGIN IMMEDIATE", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM notes WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| {
            conn.execute("ROLLBACK", []).ok();
            e.to_string()
        })?;
    conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
    Ok(())
}

// ── Assets ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_assets(
    state: State<'_, Mutex<Connection>>,
    note_id: String,
) -> Result<Vec<Asset>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, note_id, file_path, alt_text, created_at
             FROM assets
             WHERE note_id = ?1
             ORDER BY created_at",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![note_id], |row| {
            Ok(Asset {
                id: row.get(0)?,
                note_id: row.get(1)?,
                file_path: row.get(2)?,
                alt_text: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_asset(
    state: State<'_, Mutex<Connection>>,
    note_id: String,
    file_path: String,
    alt_text: String,
) -> Result<Asset, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute("BEGIN IMMEDIATE", [])
        .map_err(|e| e.to_string())?;
    let result = conn.execute(
        "INSERT INTO assets (id, note_id, file_path, alt_text, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![id, note_id, file_path, alt_text, now],
    );
    match result {
        Ok(_) => {
            conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
        }
        Err(e) => {
            conn.execute("ROLLBACK", []).ok();
            return Err(e.to_string());
        }
    }

    Ok(Asset {
        id,
        note_id,
        file_path,
        alt_text,
        created_at: now,
    })
}

#[tauri::command]
pub fn delete_asset(state: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    conn.execute("BEGIN IMMEDIATE", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM assets WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| {
            conn.execute("ROLLBACK", []).ok();
            e.to_string()
        })?;
    conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
    Ok(())
}
