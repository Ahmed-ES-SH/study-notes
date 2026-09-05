import { invoke } from "@tauri-apps/api/core";
import { IntegrityReport } from "./types";

/**
 * Runs `PRAGMA integrity_check` + `PRAGMA foreign_key_check` against the
 * local database and returns health status, size and row counts.
 */
export async function checkDbIntegrity(): Promise<IntegrityReport> {
  return await invoke<IntegrityReport>("check_db_integrity");
}
