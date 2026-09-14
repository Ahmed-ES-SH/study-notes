use rusqlite::Connection;

const CURRENT_VERSION: i64 = 3;

/// Ordered list of migrations; index i migrates from version i to i + 1.
const MIGRATIONS: &[(&str, &str)] = &[
    (
        "001_initial_schema.sql",
        include_str!("../../migrations/001_initial_schema.sql"),
    ),
    (
        "002_performance_indexes.sql",
        include_str!("../../migrations/002_performance_indexes.sql"),
    ),
    (
        "003_full_text_search.sql",
        include_str!("../../migrations/003_full_text_search.sql"),
    ),
];

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

    for (version, (name, sql)) in MIGRATIONS.iter().enumerate() {
        let target = (version + 1) as i64;
        if current < target {
            conn.execute_batch(sql)?;
            conn.execute("UPDATE schema_version SET version = ?1", [target])?;
            log::info!("Applied migration {name} (database now at v{target})");
        }
    }

    Ok(())
}
