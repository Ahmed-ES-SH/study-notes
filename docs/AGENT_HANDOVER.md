# Study Notes Desktop App — AI Agent Handover & Context Guide

> **Notice for AI Agents:** Read this document first when starting a new session on this repository. It summarizes the architecture, active rules, design tokens, data model, directory structure, verification commands, and progress across all phases.

---

## 1. Project Overview & Non-Negotiable Pillars

- **Application:** Linux-first, offline desktop study notes app for developers.
- **Primary Stack:** Tauri v2 (Rust shell) + Next.js (App Router with `output: 'export'`) + SQLite (`rusqlite` on Rust side).
- **Target OS:** Linux (Arch Linux primary target).
- **Core Architecture Rules:**
  1. **100% Offline / Zero Runtime Network (FR-11):** The app must NEVER make outbound HTTP/WebSocket/fetch calls or load remote CDN assets. Guarded by `pnpm check:offline`.
  2. **Rust-Side Data Access Only:** All SQLite database and filesystem interactions live in `src-tauri/src/db/` and are exposed via typed Tauri `#[tauri::command]` functions. Never introduce Node/JS SQLite drivers.
  3. **Strict 4-Level Hierarchy:** `MainSection` → `Subsection` → `Note` → `Asset`.
  4. **Database-Level Cascade Delete:** `ON DELETE CASCADE` foreign keys enforce cascade deletion in SQLite, complemented by frontend confirmation modals displaying child counts.
  5. **Data Location (XDG Spec):** `~/.local/share/study-notes/study-notes.db` + `~/.local/share/study-notes/assets/`.

---

## 2. Design System: "Terminal Noir"

Tokens are configured in [`app/globals.css`](file:///run/media/adev/New%20Volume/projects/study-nots-app/app/globals.css) based on [`DESIGN.md`](file:///run/media/adev/New%20Volume/projects/study-nots-app/DESIGN.md):

- **Surfaces:**
  - Base Canvas: `#0b141c` (`bg-background` / `bg-surface`)
  - Low Surface (Sidebars, Cards): `#141c24` (`bg-surface-container-low`)
  - Elevated Container: `#182028` (`bg-surface-container`)
  - Active / Hover Container: `#222b33` (`bg-surface-container-high`)
  - Overlays / Highest: `#2d363e` (`bg-surface-container-highest`)
- **Borders:** 1px hairline solid borders `#30363d` (`border-outline-variant` / `#30363d`). No blurry drop shadows.
- **Accents:**
  - Cobalt: `#388bfd` / `#aac7ff` (Primary actions, focus rings)
  - Emerald: `#3fb950` / `#67df70` (Success, active status)
  - Amber: `#d29922` (Warnings, pending items)
  - Violet: `#a371f7` / `#d5bbff` (Tags, categories)
  - Rose: `#f85149` (Destructive actions, delete confirmations)
- **Typography:**
  - UI / Prose: **Inter** (via `next/font/google` bundled at build time)
  - Code / Badges / Numbers: **JetBrains Mono**
- **Iconography:**
  - Use embedded SVG icon components in `components/common/Icons.tsx`.
  - **NEVER** use external Google Fonts CDN links (`fonts.googleapis.com` or Material Symbols CDN) at runtime in production.

---

## 3. Reference Screens Directory

Reference mockups and HTML implementations are located in [`screens/`](file:///run/media/adev/New%20Volume/projects/study-nots-app/screens):

| Screen Folder | Target App Page | Description |
|---------------|-----------------|-------------|
| `screens/all_sections_devnotes/` | **Page 1: Main Sections** | Home dashboard with domain grid, search filter, view toggle, sidebar navigation. |
| `screens/javascript_subsections_devnotes/` | **Page 2: Subsections** | Parent hero banner, subsections cards with note previews, compact view toggle. |
| `screens/subsection_notes_closures/` | **Page 3: Notes List** | List of notes under a subsection with snippets, tags, dates, and action bar. |
| `screens/note_editor_lexical_environment/` | **Page 4: Note Editor** | Split/markdown editor with syntax highlighting, asset attachments, auto-save indicator. |
| `screens/full_screen_focus_mode/` | **Focus / Study Mode** | Distraction-free reading canvas constrained to 68ch column width. |

---

## 4. Phase Status & Plans Matrix

Detailed implementation plans live in [`plans/`](file:///run/media/adev/New%20Volume/projects/study-nots-app/plans):

| Phase | Description | Status | Dedicated Plan |
|---|---|:---:|---|
| **Phase 0** | Project Setup & Design Reconciliation | Completed | — |
| **Phase 1** | Data Layer & Core Schema (Rust SQLite + WAL + Migrations) | Completed | [`plans/phase-1-data-layer.md`](file:///run/media/adev/New%20Volume/projects/study-nots-app/plans/phase-1-data-layer.md) |
| **Phase 2** | Page 1: Main Sections (Home Dashboard) | Ready to Implement | [`plans/phase-2-main-sections.md`](file:///run/media/adev/New%20Volume/projects/study-nots-app/plans/phase-2-main-sections.md) |
| **Phase 3** | Page 2: Subsections (Scoped Management) | Ready to Implement | [`plans/phase-3-subsections.md`](file:///run/media/adev/New%20Volume/projects/study-nots-app/plans/phase-3-subsections.md) |
| **Phase 4** | Page 3: Notes List (Scoped to Subsection) | Ready to Implement | [`plans/phase-4-notes-list.md`](file:///run/media/adev/New%20Volume/projects/study-nots-app/plans/phase-4-notes-list.md) |
| **Phase 5** | Page 4: Note Editor / Viewer (Markdown + Images + Auto-save) | Ready to Implement | [`plans/phase-5-note-editor.md`](file:///run/media/adev/New%20Volume/projects/study-nots-app/plans/phase-5-note-editor.md) |
| **Phase 6** | Cross-Cutting Polish: Themes, Performance, Data Integrity | Ready to Implement | [`plans/phase-6-theming-performance-integrity.md`](file:///run/media/adev/New%20Volume/projects/study-nots-app/plans/phase-6-theming-performance-integrity.md) |
| **Phase 7** | Deferred Features: Reordering (FR-6) & Local Search (FR-9) | Ready to Implement | [`plans/phase-7-reordering-and-search.md`](file:///run/media/adev/New%20Volume/projects/study-nots-app/plans/phase-7-reordering-and-search.md) |
| **Phase 8** | Packaging & Distribution (Arch Linux / AppImage) | Ready to Implement | [`plans/phase-8-packaging-and-distribution.md`](file:///run/media/adev/New%20Volume/projects/study-nots-app/plans/phase-8-packaging-and-distribution.md) |

---

## 5. Current Codebase State

### Rust Backend (`src-tauri/src/`)
- `db/mod.rs`: SQLite initialization with WAL mode (`PRAGMA journal_mode = WAL`), foreign keys (`PRAGMA foreign_keys = ON`), and versioned migration runner.
- `db/schema.rs`: Embedded SQL schema with tables `main_sections`, `subsections`, `notes`, `assets`, `schema_version`.
- `db/models.rs`: Structs `MainSection`, `Subsection`, `Note`, `Asset`.
- `db/commands.rs`: 16 CRUD commands with `BEGIN IMMEDIATE` / `COMMIT` transactions.
- `db/tests.rs`: 10 in-memory SQLite unit tests covering schema creation, WAL mode, CRUD for all entities, and cascade deletes.
- `lib.rs`: Registers db state `Mutex<Connection>` and exposes Tauri commands.

### Frontend (`app/`)
- Next.js 16 + React 19 + Tailwind CSS v4 with static export (`next.config.ts: output: 'export'`).
- `app/layout.tsx`: Configured with Inter and JetBrains Mono local font variables.
- `app/globals.css`: Full Terminal Noir design tokens configured via `@theme inline`.
- `app/page.tsx`: Blank shell ready for Phase 2 implementation.

---

## 6. Essential Commands & Quality Gates

Run these commands to build, test, and verify your changes:

```bash
# 1. Run Next.js web dev server
pnpm dev

# 2. Run Tauri desktop app with dev server
pnpm run tauri dev

# 3. Build Next.js static export (outputs to ./out)
pnpm build

# 4. Run ESLint checks
pnpm lint

# 5. Verify 100% Offline / Zero Network Calls (Must pass with 0 errors)
pnpm check:offline

# 6. Run Rust backend unit tests
cargo test --manifest-path src-tauri/Cargo.toml

# 7. Run Rust linter
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

---

## 7. Next Steps for Incoming Agent

1. **If implementing Phase 2 (Page 1):** Follow the 10 tasks in [`plans/phase-2-main-sections.md`](file:///run/media/adev/New%20Volume/projects/study-nots-app/plans/phase-2-main-sections.md).
2. **If creating remaining plans:** Analyze `Main-plan.md`, `PRD.md`, and the respective `screens/` directory to write `plans/phase-4-notes-list.md`, `plans/phase-5-note-editor.md`, etc.
3. **Always ensure:** Any new command added in Rust is tested in `db/tests.rs` and registered in `lib.rs`, and frontend components use offline SVGs rather than external font CDNs.
