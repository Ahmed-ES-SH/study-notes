use rusqlite::Connection;

const CURRENT_VERSION: i64 = 1;

pub fn run_migrations(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY
        );",
    )?;

    let current: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    if current < CURRENT_VERSION {
        conn.execute_batch(include_str!("../../migrations/001_initial_schema.sql"))?;
        conn.execute("UPDATE schema_version SET version = ?1", [CURRENT_VERSION])?;
        log::info!("Migrated database to version {CURRENT_VERSION}");
    }

    Ok(())
}
