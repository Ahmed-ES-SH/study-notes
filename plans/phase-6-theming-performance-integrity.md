# Phase 6 — Cross-Cutting Polish: Theming, Performance & Data Integrity

**Goal:** Meet the PRD's non-functional requirements holistically across all 4 pages — including system/app theme detection (dark/light/system), UI responsiveness at scale (<2s cold start and smooth 10,000+ notes rendering), unified cascade-delete UX with zero orphan assets, independent verification of 100% offline zero-network runtime operation (FR-11), and crash-resilient SQLite data integrity (WAL mode and atomic transactions).

---

## Scope Summary

Implement the Phase 6 cross-cutting polish and hardening suite across the entire application stack:
1. **Theming Engine:** Integrate system theme detection (light/dark/system) using Tauri window theme APIs and CSS custom property toggles, providing a high-contrast Terminal Noir (Dark) theme alongside a clean, paper-styled Terminal Light theme with seamless OS theme sync and local persistence.
2. **Performance Scaling:** Optimize database queries with a dedicated SQLite indexing migration (`002_performance_indexes.sql`), benchmark and verify cold start (<2s), implement list virtualization / deferred rendering for high-volume note collections (1,000 to 10,000+ notes), and build a local seed dataset generator for load testing.
3. **Cascade Delete & Asset Cleanup Audit:** Unify confirmation dialogs across all 3 deletion tiers (Main Section, Subsection, Note) with standardized hazard copy, child count badges, and automated on-disk asset cleanup in `~/.local/share/study-notes/assets/` to prevent orphaned media files.
4. **Zero-Network & Security Audit:** Harden the static offline check script (`scripts/check-no-network.sh`), configure strict Content Security Policy (CSP) in `tauri.conf.json`, and provide a runtime network isolation smoke test to mathematically prove zero outbound network packets.
5. **Data Integrity & Crash Safety Pass:** Verify SQLite WAL mode durability, implement atomic multi-step operations in transactions, expose a `check_db_integrity` Tauri command running `PRAGMA integrity_check` and `PRAGMA foreign_key_check`, and build a crash-mid-write simulation test.

---

## Architecture & Design Decisions Confirmed

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Theme Strategy** | Tri-mode: `System` (Default), `Dark (Terminal Noir)`, `Light (Terminal Light)` | Respects Linux/Arch desktop environment theme (`prefers-color-scheme` / Tauri window event) while allowing manual user override persisted in local settings. |
| **Theme Switching Mechanism** | CSS Variable & Data-Attribute Root (`data-theme="noir" \| "light"`) | Instant switching without React re-mount flicker; preserves Tailwind v4 token mapping across all components. |
| **Database Indexing** | SQLite Migration `002_performance_indexes.sql` | Adds secondary indexes on foreign keys (`subsections.main_section_id`, `notes.subsection_id`, `assets.note_id`) and sort fields (`updated_at`, `sort_order`) for O(log N) lookups at scale. |
| **List Scale Strategy** | Virtualized / Windowed Rendering for large lists (>50 items) | Guarantees constant DOM size, 60fps scrolling, and zero UI stutter even when a subsection contains 5,000+ notes. |
| **Orphan Asset Cleanup** | Rust-side cascade asset file deletion hook | Deleting a Note, Subsection, or Main Section cleans up the SQLite records AND removes the corresponding physical files in `~/.local/share/study-notes/assets/`. |
| **Cascade Confirmation UX** | Universal `CascadeDeleteDialog` component | Consistent warning typography, visual child-count pills (subsections, notes, assets), explicit destruction explanation, and loading state during deletion. |
| **Zero-Network Verification** | Multi-layer static lint + runtime socket isolation | Scans AST/text for network APIs, enforces zero CSP network domains in `tauri.conf.json`, and verifies offline execution under Linux network namespace isolation. |
| **Data Integrity Verification** | SQLite WAL mode + `PRAGMA integrity_check` + Immediate Transactions | Guarantees atomic writes on disk; process termination during save causes zero corruption or partial writes. |

---

## File Structure (New & Modified)

```
app/
├── globals.css                          # MODIFY — Add Terminal Light theme variables & data-theme overrides
├── layout.tsx                           # MODIFY — Initialize theme listener & provider wrapper
components/
├── common/
│   ├── CascadeDeleteDialog.tsx          # NEW — Unified cascade confirmation modal with child count badges
│   ├── ThemeToggle.tsx                  # NEW — Compact dropdown/switch for System / Dark / Light theme
│   └── IntegrityStatusBanner.tsx        # NEW — Diagnostic toast/banner reporting database health
├── layout/
│   ├── AppHeader.tsx                    # MODIFY — Embed ThemeToggle and offline status indicators
│   └── AppSidebar.tsx                   # MODIFY — Add Theme switch & DB health check button
lib/
├── api/
│   ├── system.ts                        # NEW — Typed Tauri invoke wrappers for theme & diagnostics
│   ├── types.ts                         # MODIFY — Add ThemeMode, IntegrityReport, CascadeDeleteTarget interfaces
│   └── sections.ts / notes.ts           # MODIFY — Leverage unified cascade delete & asset cleanup
├── hooks/
│   └── useTheme.ts                      # NEW — Custom hook for theme state, OS listener, and persistence
lib/
├── utils/
│   └── performance.ts                   # NEW — Cold start timer and client-side render metric helpers
scripts/
├── check-no-network.sh                  # MODIFY — Expand static network patterns (CSP, URLs, dynamic imports)
├── seed-benchmark-data.sh               # NEW — CLI utility to seed 1,000 to 10,000 notes for stress testing
└── dev/
    └── test-crash-resilience.sh         # NEW — Dev-only script: simulates SIGKILL during writes to verify WAL safety
src-tauri/
├── migrations/
│   └── 002_performance_indexes.sql     # NEW — Secondary indexes for fast hierarchical queries & sorting
├── src/
│   ├── db/
│   │   ├── commands.rs                  # MODIFY — Add check_db_integrity and physical asset cleanup
│   │   ├── migration.rs                 # MODIFY — Support running 002 migration
│   │   ├── schema.rs                    # MODIFY — Document index definitions
│   │   └── tests.rs                     # MODIFY — Add tests for 002 migration, integrity checks, and asset file cleanup
│   ├── lib.rs                           # MODIFY — Register new system and diagnostic commands
│   └── tauri.conf.json                  # MODIFY — Tighten security CSP policy to enforce offline lock
```

---

## Data Layer & IPC Contracts

### 1. Database Indexing Migration (`src-tauri/migrations/002_performance_indexes.sql`)

```sql
-- Migration 002: Performance Indexes for Sub-millisecond Hierarchical Lookups
CREATE INDEX IF NOT EXISTS idx_subsections_main_section ON subsections(main_section_id);
CREATE INDEX IF NOT EXISTS idx_subsections_sort ON subsections(main_section_id, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_notes_subsection ON notes(subsection_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(subsection_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_sort ON notes(subsection_id, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_assets_note ON assets(note_id);
```

### 2. TypeScript Interfaces (`lib/api/types.ts`)

```typescript
export type ThemeMode = 'system' | 'dark' | 'light';

export interface IntegrityReport {
  is_healthy: boolean;
  integrity_check_output: string;
  foreign_key_violations: string[];
  db_size_bytes: number;
  total_main_sections: number;
  total_subsections: number;
  total_notes: number;
  total_assets: number;
}

export interface BenchmarkStats {
  main_sections_created: number;
  subsections_created: number;
  notes_created: number;
  duration_ms: number;
}

export interface CascadeDeleteTarget {
  type: 'main_section' | 'subsection' | 'note';
  id: string;
  name: string;
  subsection_count?: number;
  note_count?: number;
  asset_count?: number;
}
```

### 3. Rust Diagnostic & Integrity Commands (`src-tauri/src/db/commands.rs`)

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[tauri::command]
pub fn check_db_integrity(
    state: State<'_, Mutex<Connection>>,
) -> Result<IntegrityReport, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;

    // 1. Run PRAGMA integrity_check
    let integrity_result: String = conn
        .query_row("PRAGMA integrity_check;", [], |row| row.get(0))
        .unwrap_or_else(|e| format!("Error: {}", e));

    // 2. Run PRAGMA foreign_key_check
    let mut stmt = conn
        .prepare("PRAGMA foreign_key_check;")
        .map_err(|e| e.to_string())?;
    let fk_rows = stmt
        .query_map([], |row| {
            let table: String = row.get(0)?;
            let rowid: i64 = row.get(1)?;
            let parent: String = row.get(2)?;
            Ok(format!("Table '{}' rowid {} -> broken ref to '{}'", table, rowid, parent))
        })
        .map_err(|e| e.to_string())?;

    let mut fk_violations = Vec::new();
    for row in fk_rows {
        if let Ok(v) = row {
            fk_violations.push(v);
        }
    }

    // 3. Collect statistics
    let total_main: i64 = conn.query_row("SELECT COUNT(*) FROM main_sections;", [], |r| r.get(0)).unwrap_or(0);
    let total_sub: i64 = conn.query_row("SELECT COUNT(*) FROM subsections;", [], |r| r.get(0)).unwrap_or(0);
    let total_n: i64 = conn.query_row("SELECT COUNT(*) FROM notes;", [], |r| r.get(0)).unwrap_or(0);
    let total_a: i64 = conn.query_row("SELECT COUNT(*) FROM assets;", [], |r| r.get(0)).unwrap_or(0);

    let db_path = dirs::data_local_dir()
        .map(|p| p.join("study-notes").join("study-notes.db"))
        .unwrap_or_default();
    let db_size = std::fs::metadata(&db_path).map(|m| m.len()).unwrap_or(0);

    let is_healthy = integrity_result == "ok" && fk_violations.is_empty();

    Ok(IntegrityReport {
        is_healthy,
        integrity_check_output: integrity_result,
        foreign_key_violations: fk_violations,
        db_size_bytes: db_size,
        total_main_sections: total_main,
        total_subsections: total_sub,
        total_notes: total_n,
        total_assets: total_a,
    })
}
```

---

## Detailed UI & Feature Breakdown

### 1. Theming & Dark/Light Mode Engine (`app/globals.css`, `components/common/ThemeToggle.tsx`, `lib/hooks/useTheme.ts`)
- **Terminal Noir (Dark Mode - Default):**
  - Base canvas: `#0b141c`, container: `#141c24`, elevated: `#182028`, hairline borders: `#30363d`, text primary: `#f0f6fc`, text secondary: `#8b949e`.
- **Terminal Light (Light Mode - Paper Noir):**
  - Base canvas: `#f6f8fa`, container: `#ffffff`, elevated: `#eaeef2`, hairline borders: `#d0d7de`, text primary: `#1f2328`, text secondary: `#656d76`.
  - Syntax accents adjusted for accessible contrast on light backgrounds (Deep Cobalt `#0969da`, Forest Emerald `#1a7f37`, Amber Bronze `#9a6700`, Royal Violet `#8250df`, Crimson `#cf222e`).
- **Theme Selection Modes:**
  - **System (Auto):** Synchronizes dynamically with the desktop window manager / OS color scheme.
  - **Dark:** Forces Terminal Noir palette.
  - **Light:** Forces Terminal Light palette.
- **Tauri OS Integration:**
  - Listens for window theme changes via `@tauri-apps/api/window` `getCurrentWebviewWindow().onThemeChanged(...)` without requiring an app reload.
  - Remembers user's manual selection across restarts in local storage.
- **ThemeToggle Component:**
  - Sleek segmented button / dropdown in `AppHeader` and `AppSidebar` with icons for Sun, Moon, and Monitor (System).

### 2. Performance Pass & Scale Hardening (<2s Cold Start)
- **Cold Start Optimization:**
  - Fast Next.js static asset serving with zero hydration blocking.
  - Defer non-critical IPC calls (e.g. metadata queries) until after initial view mount.
  - Verify cold start from binary execution to interactive UI takes `< 1.2s` on standard Linux desktop hardware.
- **Seed Benchmark Tooling (`scripts/seed-benchmark-data.sh`):**
  - CLI script to populate the SQLite database with configurable volume for manual load testing:
    - 10 Main Sections, 50 Subsections, 5,000 Notes with rich markdown and code snippets.
  - Run after adding DB indexes (migration 002) to confirm sub-millisecond query performance at scale.
  - The secondary indexes from migration 002 are the primary performance mechanism; this script validates they work.

### 3. Universal Cascade Delete & Asset Lifecycle Audit
- **Standardized Confirmation Modal (`components/common/CascadeDeleteDialog.tsx`):**
  - Unified dialog across Page 1 (`DeleteSectionDialog`), Page 2 (`DeleteSubsectionDialog`), and Page 3/4 (`DeleteNoteDialog`).
  - Distinct danger alert iconography with Coral Rose borders (`#f85149`).
  - Real-time child impact counters rendered in bold badge pills:
    - Deleting Main Section: shows `N subsections`, `M notes`, `K media assets`.
    - Deleting Subsection: shows `M notes`, `K media assets`.
    - Deleting Note: shows `K media assets`.
  - Disable buttons and display a spinning loader during deletion to prevent duplicate IPC calls.
- **Physical Asset Cleanup Guarantee (`src-tauri/src/db/commands.rs`):**
  - Before committing SQLite `ON DELETE CASCADE`, query associated file paths in `assets`.
  - Upon transaction commit, delete the corresponding files from `~/.local/share/study-notes/assets/` on disk.
  - Eliminates orphan files and disk bloat when notes are deleted.

### 4. Zero-Network & Security Hardening (FR-11)
- **Enhanced Static Network Guard (`scripts/check-no-network.sh`):**
  - Extended regex patterns scanning for:
    - JavaScript: `fetch(`, `XMLHttpRequest`, `WebSocket(`, `EventSource(`, `axios`, `http:`, `https:`, remote URL imports, `@tauri-apps/plugin-http`.
    - Rust: `reqwest`, `ureq`, `hyper`, `tokio::net::TcpStream`, `tauri_plugin_http`.
    - HTML/CSS: `@import url(http`, `fonts.googleapis.com`, remote `<img>` `src="http"`.
- **Strict Content Security Policy (`src-tauri/tauri.conf.json`):**
  - Configure strict CSP:
    ```json
    "security": {
      "csp": "default-src 'self' tauri: asset:; img-src 'self' asset: data: tauri:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'none'; object-src 'none'; form-action 'none';"
    }
    ```
  - Prohibits all outbound network calls (`connect-src 'none'`) at the WebKit/webview engine level.
- **Runtime Network Isolation Smoke Test:**
  - Script executing the built binary within an unshared network namespace (`unshare -n` or `firejail --noprofile --net=none`) to prove the application operates with 100% functionality without network interfaces.

### 5. Data Integrity & Crash Safety Verification
- **SQLite WAL Mode & Write Durability:**
  - Confirm `PRAGMA journal_mode = WAL;`, `PRAGMA synchronous = NORMAL;`, and `PRAGMA busy_timeout = 5000;` are applied on every connection.
  - Auto-checkpoint WAL log on connection shutdown.
- **Crash Simulation Testing (`scripts/test-crash-resilience.sh`):**
  - Spawns background worker writing notes rapidly while randomly sending `SIGKILL` / `kill -9` to the process.
  - Reopens SQLite database and runs `PRAGMA integrity_check` to prove zero corruption.
- **Built-In Database Health Check Command (`check_db_integrity`):**
  - Accessible via Sidebar / Settings panel.
  - Displays database size, total counts across all 4 hierarchy levels, and integrity status badge.

---

## Implementation Steps

| # | Task | Dependencies | Output Files |
|---|------|--------------|--------------|
| **1** | **Add Database Indexes & Migration 002**<br>Create `src-tauri/migrations/002_performance_indexes.sql`, update `migration.rs`, `schema.rs`, and write unit tests in `tests.rs`. | Phase 1 Backend | `src-tauri/migrations/002_performance_indexes.sql`<br>`src-tauri/src/db/migration.rs`<br>`src-tauri/src/db/schema.rs`<br>`src-tauri/src/db/tests.rs` |
| **2** | **Implement Physical Asset Cleanup on Cascade Delete**<br>Update `delete_main_section`, `delete_subsection`, and `delete_note` in `commands.rs` to remove on-disk asset files in `~/.local/share/study-notes/assets/` after database deletion. | Task 1 | `src-tauri/src/db/commands.rs`<br>`src-tauri/src/db/tests.rs` |
| **3** | **Implement `check_db_integrity` Diagnostic Command**<br>Add `check_db_integrity` in `commands.rs`, register in `lib.rs`, and test in `tests.rs`. The benchmark seeding is CLI-only via `scripts/seed-benchmark-data.sh`. | Task 1 | `src-tauri/src/db/commands.rs`<br>`src-tauri/src/lib.rs`<br>`src-tauri/src/db/tests.rs` |
| **4** | **Create TypeScript System API & Type Definitions**<br>Create `lib/api/system.ts` and expand `lib/api/types.ts` with `ThemeMode`, `IntegrityReport`, and `CascadeDeleteTarget`. | Task 3 | `lib/api/system.ts`<br>`lib/api/types.ts` |
| **5** | **Configure Terminal Light Theme Tokens & CSS Overrides**<br>Update `app/globals.css` with `[data-theme="light"]` custom properties and high-contrast light mode variables. | Phase 0 CSS | `app/globals.css` |
| **6** | **Implement Theme Hook & System Theme Listener**<br>Build `lib/hooks/useTheme.ts` managing `system`/`dark`/`light` mode, Tauri OS window theme events, and `localStorage` persistence. | Task 5 | `lib/hooks/useTheme.ts` |
| **7** | **Build ThemeToggle Component & Header Integration**<br>Create `components/common/ThemeToggle.tsx` and integrate it into `AppHeader.tsx` and `AppSidebar.tsx`. | Task 6 | `components/common/ThemeToggle.tsx`<br>`components/layout/AppHeader.tsx`<br>`components/layout/AppSidebar.tsx` |
| **8** | **Build Unified CascadeDeleteDialog Component**<br>Create `components/common/CascadeDeleteDialog.tsx` with standardized danger styling, child count pills, and loading states; refactor Pages 1, 2, 3, and 4 to use it. | Task 2, 4 | `components/common/CascadeDeleteDialog.tsx`<br>`components/sections/DeleteSectionDialog.tsx`<br>`components/subsections/DeleteSubsectionDialog.tsx`<br>`components/notes/DeleteNoteDialog.tsx` |
| **9** | **Build Database Integrity Diagnostic UI**<br>Create `components/common/IntegrityStatusBanner.tsx` and wire health check modal / trigger in `AppSidebar.tsx`. | Task 4, 7 | `components/common/IntegrityStatusBanner.tsx`<br>`components/layout/AppSidebar.tsx` |
| **10** | **Harden Offline Guard & Content Security Policy (CSP)**<br>Enhance `scripts/check-no-network.sh` with strict patterns and configure `connect-src 'none'` in `src-tauri/tauri.conf.json`. | Task 1–9 | `scripts/check-no-network.sh`<br>`src-tauri/tauri.conf.json` |
| **11** | **Create Benchmark & Crash Resilience Scripts**<br>Write `scripts/seed-benchmark-data.sh` and `scripts/dev/test-crash-resilience.sh`. The crash script is a dev utility — not a required exit gate. | Task 10 | `scripts/seed-benchmark-data.sh`<br>`scripts/dev/test-crash-resilience.sh` |
| **12** | **Execute Full Verification & Quality Audit**<br>Run `cargo test`, `pnpm check:offline`, `pnpm lint`, `pnpm build`, and the seed benchmark script. | All Tasks | — |

---

## Edge Cases & Error Handling

1. **OS Theme Dynamic Shift:**
   - If user selects "System" theme, changing the desktop environment theme (e.g. GNOME/KDE dark mode toggle) instantly updates the app's UI without requiring restart or causing component flashing.
2. **Missing Asset Files on Disk During Cascade Delete:**
   - If an asset file was manually deleted from disk by the user outside the app, the cleanup routine ignores the `NotFound` error and safely completes the SQLite cascade delete.
3. **Database Lock Contention under Rapid Auto-Saves:**
   - With `PRAGMA busy_timeout = 5000;` and WAL mode, concurrent reads during write transactions do not block or throw `database is locked` errors.
4. **Abrupt Process Termination / Power Outage (`kill -9`):**
   - SQLite WAL log ensures any committed transaction is persisted, and any in-flight uncommitted transaction is rolled back cleanly on next launch without database corruption.
5. **Zero-Network Policy (FR-11):**
   - Even if third-party libraries attempt network access, the WebKit CSP `connect-src 'none'` blocks all socket connections at the browser engine level.

---

## Exit Criteria

- [ ] `cargo test` passes for all unit tests including migration 002, `check_db_integrity`, and physical asset deletion.
- [ ] `pnpm check:offline` passes with 0 violations across all source files, styles, and configs.
- [ ] `pnpm lint` and `pnpm build` compile with zero errors.
- [ ] System theme auto-detection works seamlessly alongside manual Dark (Terminal Noir) and Light (Terminal Light) options.
- [ ] Cold start launches to interactive state in `< 2.0s`.
- [ ] Database contains secondary indexes on all foreign key and sorting columns.
- [ ] Scrolling and filtering remain smooth (60fps) with a seeded dataset of 5,000+ notes.
- [ ] Cascade delete dialogs across all 3 levels (Main Section, Subsection, Note) feature unified copy, child count badges, and loading states.
- [ ] Deleting notes/sections cleans up physical image files in `~/.local/share/study-notes/assets/`, leaving 0 orphan files.
- [ ] `PRAGMA integrity_check` passes and reports healthy state on live and benchmarked databases.
- [ ] Crash simulation test verifies database survives abrupt `SIGKILL` termination without corruption.

---

## Estimated Effort

- **~15-18 files** created or modified
- **~900-1,200 lines** of TypeScript/React code
- **~120-160 lines** of Rust backend code
- **~100 lines** of Rust tests
- **~150 lines** of shell scripts for verification and stress testing
