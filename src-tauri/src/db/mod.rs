use rusqlite::Connection;
use std::path::PathBuf;

pub mod commands;
pub mod migration;
pub mod models;
pub mod schema;

pub const APP_DIR_NAME: &str = "study-notes";
pub const DB_FILE_NAME: &str = "study-notes.db";
pub const ASSETS_DIR_NAME: &str = "assets";

pub fn data_dir() -> Result<PathBuf, Box<dyn std::error::Error>> {
    let base = dirs::data_local_dir().ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "could not resolve the local data directory (XDG_DATA_HOME is unset)",
        )
    })?;
    Ok(base.join(APP_DIR_NAME))
}

pub fn init() -> Result<Connection, Box<dyn std::error::Error>> {
    let dir = data_dir()?;
    std::fs::create_dir_all(dir.join(ASSETS_DIR_NAME))?;

    let db_path = dir.join(DB_FILE_NAME);
    let conn = Connection::open(&db_path)?;

    // Enable WAL mode for better concurrent read performance
    conn.execute_batch("PRAGMA journal_mode = WAL;")?;
    // Enable foreign key enforcement
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;

    migration::run_migrations(&conn)?;

    Ok(conn)
}

#[cfg(test)]
mod tests;
