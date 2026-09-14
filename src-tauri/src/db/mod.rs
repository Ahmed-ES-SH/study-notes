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
        // Windows resolves via %LOCALAPPDATA%; Unix via $XDG_DATA_HOME.
        // Filesystem behavior is identical — only the diagnostic differs.
        let hint = if cfg!(windows) {
            "could not resolve the local data directory \
             (check that %LOCALAPPDATA% is set and writable, \
             typically C:\\Users\\<user>\\AppData\\Local)"
        } else {
            "could not resolve the local data directory (XDG_DATA_HOME is unset)"
        };
        std::io::Error::new(std::io::ErrorKind::NotFound, hint)
    })?;
    Ok(base.join(APP_DIR_NAME))
}

/// Restricts the private data directory to the owning user (0700) and keeps
/// the assets folder world-readable (0755) per the XDG conventions the
/// packaging phase commits to. No-op on non-Unix platforms.
#[cfg(unix)]
fn apply_permissions(dir: &std::path::Path, assets: &std::path::Path) -> std::io::Result<()> {
    use std::os::unix::fs::PermissionsExt;

    std::fs::set_permissions(dir, std::fs::Permissions::from_mode(0o700))?;
    std::fs::set_permissions(assets, std::fs::Permissions::from_mode(0o755))?;
    Ok(())
}

#[cfg(not(unix))]
fn apply_permissions(dir: &std::path::Path, assets: &std::path::Path) -> std::io::Result<()> {
    let _ = (dir, assets);
    Ok(())
}

pub fn init() -> Result<Connection, Box<dyn std::error::Error>> {
    init_under(&data_dir()?)
}

/// Provisioning helper with an explicit base directory. `init()` passes the
/// real per-user data dir; tests pass a temp dir so they stay hermetic on
/// every OS (Windows resolves the data dir via the shell and ignores
/// `XDG_DATA_HOME`, so env-var redirection cannot isolate tests there).
pub(crate) fn init_under(
    base_dir: &std::path::Path,
) -> Result<Connection, Box<dyn std::error::Error>> {
    let dir = base_dir.join(APP_DIR_NAME);
    let assets_dir = dir.join(ASSETS_DIR_NAME);
    std::fs::create_dir_all(&assets_dir).map_err(|e| {
        let hint = if cfg!(windows) {
            "Check that %LOCALAPPDATA% \
             (default C:\\Users\\<user>\\AppData\\Local) is writable."
        } else {
            "Check that $XDG_DATA_HOME (default ~/.local/share) is writable."
        };
        format!(
            "could not provision the data directory at {}: {e}. {hint}",
            dir.display()
        )
    })?;
    apply_permissions(&dir, &assets_dir)?;

    let db_path = dir.join(DB_FILE_NAME);
    let conn = Connection::open(&db_path)?;

    // Enable WAL mode for better concurrent read performance
    conn.execute_batch("PRAGMA journal_mode = WAL;")?;
    // Enable foreign key enforcement
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    // WAL + NORMAL syncing keeps writes durable yet fast; the busy timeout
    // prevents spurious "database is locked" errors under rapid auto-saves.
    conn.execute_batch("PRAGMA synchronous = NORMAL;")?;
    conn.execute_batch("PRAGMA busy_timeout = 5000;")?;

    migration::run_migrations(&conn)?;

    Ok(conn)
}

#[cfg(test)]
mod tests;
