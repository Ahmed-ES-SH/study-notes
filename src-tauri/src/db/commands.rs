use rusqlite::Connection;
use std::sync::Mutex;
use tauri::State;

use super::models::{
    Asset, MainSection, MainSectionCascadeInfo, Note, NoteCascadeInfo, NoteContextHierarchy,
    Subsection, SubsectionCascadeInfo,
};

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

/// Best-effort removal of asset files that were cascade-deleted from SQLite.
/// `base_dir` is the app data directory that contains the managed `assets/`
/// folder. A missing file (manually deleted by the user) is ignored so the
/// database delete still completes successfully.
pub(crate) fn remove_asset_files(base_dir: &std::path::Path, relative_paths: &[String]) {
    for rel in relative_paths {
        if let Some(file) = resolve_asset_disk_path_under(base_dir, rel) {
            std::fs::remove_file(file).ok();
        }
    }
}

/// Every asset file path recorded under the given notes, collected before a
/// cascade delete removes the `assets` rows.
pub(crate) fn asset_paths_for_notes(
    conn: &Connection,
    note_filter_sql: &str,
    id: &str,
) -> Vec<String> {
    let sql = format!("SELECT file_path FROM assets WHERE note_id IN ({note_filter_sql})");
    let Ok(mut stmt) = conn.prepare(&sql) else {
        return Vec::new();
    };
    stmt.query_map(rusqlite::params![id], |row| row.get(0))
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
}

#[tauri::command]
pub fn delete_main_section(state: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;

    // Snapshot on-disk asset paths before the cascade removes the rows.
    let asset_paths = asset_paths_for_notes(
        &conn,
        "SELECT id FROM notes WHERE subsection_id IN (
            SELECT id FROM subsections WHERE main_section_id = ?1
        )",
        &id,
    );

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

    if let Some(base) = super::data_dir().ok() {
        remove_asset_files(&base, &asset_paths);
    }
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
    let subsection_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM subsections WHERE main_section_id = ?1",
            rusqlite::params![id],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let note_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes WHERE subsection_id IN (
            SELECT id FROM subsections WHERE main_section_id = ?1
        )",
            rusqlite::params![id],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let asset_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM assets WHERE note_id IN (
            SELECT id FROM notes WHERE subsection_id IN (
                SELECT id FROM subsections WHERE main_section_id = ?1
            )
        )",
            rusqlite::params![id],
            |r| r.get(0),
        )
        .unwrap_or(0);

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

    let asset_paths =
        asset_paths_for_notes(&conn, "SELECT id FROM notes WHERE subsection_id = ?1", &id);

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

    if let Some(base) = super::data_dir().ok() {
        remove_asset_files(&base, &asset_paths);
    }
    Ok(())
}

#[tauri::command]
pub fn get_subsection_cascade_info(
    state: State<'_, Mutex<Connection>>,
    id: String,
) -> Result<SubsectionCascadeInfo, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    get_subsection_cascade_info_conn(&conn, &id).map_err(|e| e.to_string())
}

pub fn get_subsection_cascade_info_conn(
    conn: &Connection,
    id: &str,
) -> rusqlite::Result<SubsectionCascadeInfo> {
    let note_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes WHERE subsection_id = ?1",
            rusqlite::params![id],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let asset_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM assets WHERE note_id IN (
            SELECT id FROM notes WHERE subsection_id = ?1
        )",
            rusqlite::params![id],
            |r| r.get(0),
        )
        .unwrap_or(0);

    Ok(SubsectionCascadeInfo {
        note_count,
        asset_count,
    })
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

    let asset_paths = asset_paths_for_notes(&conn, "SELECT id FROM notes WHERE id = ?1", &id);

    conn.execute("BEGIN IMMEDIATE", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM notes WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| {
            conn.execute("ROLLBACK", []).ok();
            e.to_string()
        })?;
    conn.execute("COMMIT", []).map_err(|e| e.to_string())?;

    if let Some(base) = super::data_dir().ok() {
        remove_asset_files(&base, &asset_paths);
    }
    Ok(())
}

#[tauri::command]
pub fn get_note_cascade_info(
    state: State<'_, Mutex<Connection>>,
    id: String,
) -> Result<NoteCascadeInfo, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    get_note_cascade_info_conn(&conn, &id).map_err(|e| e.to_string())
}

pub fn get_note_cascade_info_conn(
    conn: &Connection,
    id: &str,
) -> rusqlite::Result<NoteCascadeInfo> {
    let asset_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM assets WHERE note_id = ?1",
            rusqlite::params![id],
            |r| r.get(0),
        )
        .unwrap_or(0);

    Ok(NoteCascadeInfo { asset_count })
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
pub fn delete_asset(state: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;

    // Resolve the on-disk path before removing the row so the file can be
    // cleaned up afterwards (best-effort: a missing file is not an error).
    let file_path: Option<String> = conn
        .query_row(
            "SELECT file_path FROM assets WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .ok();

    conn.execute("BEGIN IMMEDIATE", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM assets WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| {
            conn.execute("ROLLBACK", []).ok();
            e.to_string()
        })?;
    conn.execute("COMMIT", []).map_err(|e| e.to_string())?;

    if let Some(rel) = file_path {
        if let Some(file) = resolve_asset_disk_path(&rel) {
            std::fs::remove_file(file).ok();
        }
    }

    Ok(())
}

// ── Note Editor (Phase 5) ───────────────────────────────────────────

pub fn get_note_conn(conn: &Connection, id: &str) -> rusqlite::Result<Note> {
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
}

#[tauri::command]
pub fn get_note(state: State<'_, Mutex<Connection>>, id: String) -> Result<Note, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    get_note_conn(&conn, &id).map_err(|e| e.to_string())
}

pub fn get_note_context_conn(
    conn: &Connection,
    id: &str,
) -> rusqlite::Result<NoteContextHierarchy> {
    conn.query_row(
        "SELECT n.id, n.subsection_id, n.title, n.content, n.created_at, n.updated_at, n.sort_order,
                s.main_section_id, s.name,
                ms.id, ms.name, ms.color
         FROM notes n
         JOIN subsections s ON s.id = n.subsection_id
         JOIN main_sections ms ON ms.id = s.main_section_id
         WHERE n.id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(NoteContextHierarchy {
                note: Note {
                    id: row.get(0)?,
                    subsection_id: row.get(1)?,
                    title: row.get(2)?,
                    content: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                    sort_order: row.get(6)?,
                },
                subsection_id: row.get(1)?,
                subsection_name: row.get(8)?,
                main_section_id: row.get(9)?,
                main_section_name: row.get(10)?,
                main_section_color: row.get(11)?,
            })
        },
    )
}

#[tauri::command]
pub fn get_note_context(
    state: State<'_, Mutex<Connection>>,
    id: String,
) -> Result<NoteContextHierarchy, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    get_note_context_conn(&conn, &id).map_err(|e| e.to_string())
}

/// The 7-bit base64 alphabet. Hand-rolled so no new crates are pulled in.
const B64_ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

pub fn base64_encode(data: &[u8]) -> String {
    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = chunk.get(1).copied().unwrap_or(0) as u32;
        let b2 = chunk.get(2).copied().unwrap_or(0) as u32;
        let triple = (b0 << 16) | (b1 << 8) | b2;

        out.push(B64_ALPHABET[(triple >> 18 & 0x3F) as usize] as char);
        out.push(B64_ALPHABET[(triple >> 12 & 0x3F) as usize] as char);
        out.push(if chunk.len() > 1 {
            B64_ALPHABET[(triple >> 6 & 0x3F) as usize] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            B64_ALPHABET[(triple & 0x3F) as usize] as char
        } else {
            '='
        });
    }
    out
}

/// Maps a stored relative asset path (`assets/<uuid>.<ext>`) to its location
/// on disk, rejecting anything that escapes the managed assets directory.
pub(super) fn resolve_asset_disk_path(relative_path: &str) -> Option<std::path::PathBuf> {
    resolve_asset_disk_path_under(&super::data_dir().ok()?, relative_path)
}

pub(crate) fn resolve_asset_disk_path_under(
    base_dir: &std::path::Path,
    relative_path: &str,
) -> Option<std::path::PathBuf> {
    if relative_path.contains("..") || relative_path.contains('\\') {
        return None;
    }
    let prefix = format!("{}/", super::ASSETS_DIR_NAME);
    let file_name = relative_path.strip_prefix(&prefix)?;
    // Must be a flat file name directly under assets/ — no nested paths.
    if file_name.is_empty() || file_name.contains('/') {
        return None;
    }
    Some(base_dir.join(super::ASSETS_DIR_NAME).join(file_name))
}

fn mime_type_for_extension(ext: &str) -> &'static str {
    match ext.to_ascii_lowercase().as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        "svg" => "image/svg+xml",
        "avif" => "image/avif",
        _ => "application/octet-stream",
    }
}

#[tauri::command]
pub fn attach_note_asset(
    state: State<'_, Mutex<Connection>>,
    note_id: String,
    file_name: String,
    alt_text: String,
    file_bytes: Vec<u8>,
) -> Result<Asset, String> {
    let mut conn = state.lock().map_err(|e| e.to_string())?;
    let assets_dir = super::data_dir()
        .map_err(|e| e.to_string())?
        .join(super::ASSETS_DIR_NAME);
    attach_note_asset_conn(
        &mut conn,
        &assets_dir,
        &note_id,
        &file_name,
        &alt_text,
        &file_bytes,
    )
}

pub fn attach_note_asset_conn(
    conn: &mut Connection,
    assets_dir: &std::path::Path,
    note_id: &str,
    file_name: &str,
    alt_text: &str,
    file_bytes: &[u8],
) -> Result<Asset, String> {
    // 1. The managed assets directory must exist.
    std::fs::create_dir_all(assets_dir).map_err(|e| e.to_string())?;

    // 2. Preserve the original extension, sanitized to a safe charset.
    let source_ext = std::path::Path::new(file_name)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .unwrap_or_else(|| "png".to_string());
    let extension = if source_ext.chars().count() <= 8
        && source_ext.chars().all(|c| c.is_ascii_alphanumeric())
    {
        source_ext
    } else {
        "png".to_string()
    };

    // 3. Write the bytes under a UUID filename (guarantees self-contained backups).
    let asset_id = uuid::Uuid::new_v4().to_string();
    let dest_filename = format!("{}.{}", asset_id, extension);
    let dest_path = assets_dir.join(&dest_filename);
    std::fs::write(&dest_path, file_bytes).map_err(|e| e.to_string())?;

    // 4. Record the asset in SQLite inside an atomic transaction.
    let now = chrono::Utc::now().to_rfc3339();
    let relative_path = format!("{}/{}", super::ASSETS_DIR_NAME, dest_filename);

    let tx = conn.transaction().map_err(|e| {
        std::fs::remove_file(&dest_path).ok();
        e.to_string()
    })?;

    let insert_res = tx.execute(
        "INSERT INTO assets (id, note_id, file_path, alt_text, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![asset_id, note_id, relative_path, alt_text, now],
    );

    match insert_res {
        Ok(_) => tx.commit().map_err(|e| {
            std::fs::remove_file(&dest_path).ok();
            e.to_string()
        })?,
        Err(e) => {
            // Transaction rolls back on drop; clean up the copied file.
            std::fs::remove_file(&dest_path).ok();
            return Err(e.to_string());
        }
    }

    Ok(Asset {
        id: asset_id,
        note_id: note_id.to_string(),
        file_path: relative_path,
        alt_text: alt_text.to_string(),
        created_at: now,
    })
}

/// Reads a managed asset from disk and returns it as an inline data URL so
/// the webview can render local images without any network or custom
/// protocol configuration.
#[tauri::command]
pub fn read_asset_data_url(file_path: String) -> Result<String, String> {
    let disk_path = resolve_asset_disk_path(&file_path)
        .ok_or_else(|| format!("Refusing to read asset outside managed storage: {file_path}"))?;

    let bytes = std::fs::read(&disk_path)
        .map_err(|e| format!("Failed to read asset '{file_path}': {e}"))?;

    let ext = disk_path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("");
    let mime = mime_type_for_extension(ext);

    Ok(format!("data:{};base64,{}", mime, base64_encode(&bytes)))
}

// ── Diagnostics (Phase 6) ───────────────────────────────────────────

/// Health report for the local SQLite database, surfaced in the sidebar's
/// diagnostic panel.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct IntegrityReport {
    pub is_healthy: bool,
    pub integrity_check_output: String,
    pub foreign_key_violations: Vec<String>,
    pub db_size_bytes: u64,
    pub total_main_sections: i64,
    pub total_subsections: i64,
    pub total_notes: i64,
    pub total_assets: i64,
}

/// Conn-level implementation of the integrity check. `db_path` is passed in so
/// tests can run against in-memory databases (no on-disk file to stat).
pub(crate) fn check_db_integrity_conn(
    conn: &Connection,
    db_path: Option<&std::path::Path>,
) -> rusqlite::Result<IntegrityReport> {
    let integrity_result: String = conn
        .query_row("PRAGMA integrity_check;", [], |row| row.get(0))
        .unwrap_or_else(|e| format!("Error: {e}"));

    let mut stmt = conn.prepare("PRAGMA foreign_key_check;")?;
    let fk_rows = stmt.query_map([], |row| {
        let table: String = row.get(0)?;
        let rowid: i64 = row.get(1)?;
        let parent: String = row.get(2)?;
        Ok(format!(
            "Table '{table}' rowid {rowid} -> broken ref to '{parent}'"
        ))
    })?;

    let mut fk_violations = Vec::new();
    for row in fk_rows {
        if let Ok(v) = row {
            fk_violations.push(v);
        }
    }

    let total_main: i64 = conn
        .query_row("SELECT COUNT(*) FROM main_sections;", [], |r| r.get(0))
        .unwrap_or(0);
    let total_sub: i64 = conn
        .query_row("SELECT COUNT(*) FROM subsections;", [], |r| r.get(0))
        .unwrap_or(0);
    let total_n: i64 = conn
        .query_row("SELECT COUNT(*) FROM notes;", [], |r| r.get(0))
        .unwrap_or(0);
    let total_a: i64 = conn
        .query_row("SELECT COUNT(*) FROM assets;", [], |r| r.get(0))
        .unwrap_or(0);

    let db_size = db_path
        .and_then(|p| std::fs::metadata(p).ok())
        .map(|m| m.len())
        .unwrap_or(0);

    Ok(IntegrityReport {
        is_healthy: integrity_result == "ok" && fk_violations.is_empty(),
        integrity_check_output: integrity_result,
        foreign_key_violations: fk_violations,
        db_size_bytes: db_size,
        total_main_sections: total_main,
        total_subsections: total_sub,
        total_notes: total_n,
        total_assets: total_a,
    })
}

#[tauri::command]
pub fn check_db_integrity(state: State<'_, Mutex<Connection>>) -> Result<IntegrityReport, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;

    let db_path = super::data_dir().ok().map(|p| p.join(super::DB_FILE_NAME));

    check_db_integrity_conn(&conn, db_path.as_deref()).map_err(|e| e.to_string())
}

// ── Search & Reordering (Phase 7) ───────────────────────────────────

/// A single ranked full-text search hit with its full hierarchy context.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub subsection_id: String,
    pub subsection_name: String,
    pub main_section_id: String,
    pub main_section_name: String,
    pub main_section_color: String,
    pub title: String,
    pub snippet: String,
    pub updated_at: String,
    pub rank: f64,
}

/// Strips FTS5 operator characters that would cause MATCH syntax errors
/// while preserving characters common in developer content:
///   . (method calls, version strings: v1.0, std.vec)
///   / (paths, async/await)
///   # (language tags, C#)
///   @ (decorators, annotations)
///   : (namespaces: std::vec, HTTP status codes)
///   + (operators, increments)
/// Stripped: " * ( ) which have special FTS5 meaning when unquoted.
/// Each surviving token becomes a quoted prefix query ("tok"*).
pub(crate) fn sanitize_fts5_query(input: &str) -> String {
    let cleaned: String = input
        .chars()
        .filter(|c| {
            c.is_alphanumeric()
                || c.is_whitespace()
                || matches!(*c, '_' | '-' | '.' | '/' | '#' | '@' | ':' | '+')
        })
        .collect();
    cleaned
        .split_whitespace()
        .filter(|t| !t.is_empty())
        .map(|tok| format!("\"{}\"*", tok))
        .collect::<Vec<_>>()
        .join(" ")
}

/// Conn-level FTS5 search over notes, ranked by BM25 with highlighted
/// snippets extracted from the note content.
pub(crate) fn search_notes_conn(
    conn: &Connection,
    query: &str,
    main_section_id: Option<&str>,
    subsection_id: Option<&str>,
    limit: i64,
) -> Result<Vec<SearchResult>, String> {
    let sanitized_query = sanitize_fts5_query(query);
    if sanitized_query.trim().is_empty() {
        return Ok(Vec::new());
    }
    let limit_val = limit.clamp(1, 100);

    let sql = "
        SELECT
            n.id,
            n.subsection_id,
            s.name AS subsection_name,
            m.id AS main_section_id,
            m.name AS main_section_name,
            m.color AS main_section_color,
            n.title,
            snippet(notes_fts, 2, '<mark>', '</mark>', '...', 24) AS snippet,
            n.updated_at,
            bm25(notes_fts) AS rank
        FROM notes_fts
        JOIN notes n ON notes_fts.id = n.id
        JOIN subsections s ON n.subsection_id = s.id
        JOIN main_sections m ON s.main_section_id = m.id
        WHERE notes_fts MATCH ?1
          AND (?2 IS NULL OR m.id = ?2)
          AND (?3 IS NULL OR s.id = ?3)
        ORDER BY rank ASC
        LIMIT ?4
    ";

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(
            rusqlite::params![sanitized_query, main_section_id, subsection_id, limit_val],
            |row| {
                Ok(SearchResult {
                    id: row.get(0)?,
                    subsection_id: row.get(1)?,
                    subsection_name: row.get(2)?,
                    main_section_id: row.get(3)?,
                    main_section_name: row.get(4)?,
                    main_section_color: row.get(5)?,
                    title: row.get(6)?,
                    snippet: row.get(7)?,
                    updated_at: row.get(8)?,
                    rank: row.get(9)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for r in rows {
        if let Ok(item) = r {
            results.push(item);
        }
    }
    Ok(results)
}

#[tauri::command]
pub fn search_notes(
    state: State<'_, Mutex<Connection>>,
    query: String,
    main_section_id: Option<String>,
    subsection_id: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<SearchResult>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    search_notes_conn(
        &conn,
        &query,
        main_section_id.as_deref(),
        subsection_id.as_deref(),
        limit.unwrap_or(30),
    )
}

/// Atomically persists a new manual ordering: every id in `ordered_ids` gets
/// `sort_order` set to its 0-based position inside one immediate transaction,
/// normalizing the indices to a contiguous 0..N-1 range.
#[tauri::command]
pub fn reorder_entities(
    state: State<'_, Mutex<Connection>>,
    entity_type: String,
    ordered_ids: Vec<String>,
) -> Result<(), String> {
    let mut conn = state.lock().map_err(|e| e.to_string())?;
    reorder_entities_conn(&mut conn, &entity_type, &ordered_ids)
}

pub(crate) fn reorder_entities_conn(
    conn: &mut Connection,
    entity_type: &str,
    ordered_ids: &[String],
) -> Result<(), String> {
    let table = match entity_type {
        "main_sections" => "main_sections",
        "subsections" => "subsections",
        "notes" => "notes",
        _ => return Err("Invalid entity_type for reordering".to_string()),
    };

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    {
        let query = format!("UPDATE {table} SET sort_order = ?1 WHERE id = ?2");
        let mut stmt = tx.prepare(&query).map_err(|e| e.to_string())?;
        for (index, id) in ordered_ids.iter().enumerate() {
            stmt.execute(rusqlite::params![index as i64, id])
                .map_err(|e| e.to_string())?;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

// ── Data Directory Inspection ──────────────────────────────────────

/// Reports the absolute path of the app's XDG data directory
/// (`$XDG_DATA_HOME/study-notes`, default `~/.local/share/study-notes`) so
/// users can locate the database and assets for manual backups.
#[tauri::command]
pub fn get_data_dir() -> Result<String, String> {
    super::data_dir()
        .map(|p| p.display().to_string())
        .map_err(|e| e.to_string())
}
