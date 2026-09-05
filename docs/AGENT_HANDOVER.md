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

Tokens are configured in `app/globals.css` based on [`DESIGN.md`](../DESIGN.md):

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

Reference mockups and HTML implementations are located in [`screens/`](../screens):

| Screen Folder | Target App Page | Description |
|---------------|-----------------|-------------|
| `screens/all_sections_devnotes/` | **Page 1: Main Sections** | Home dashboard with domain grid, search filter, view toggle, sidebar navigation. |
| `screens/javascript_subsections_devnotes/` | **Page 2: Subsections** | Parent hero banner, subsections cards with note previews, compact view toggle. |
| `screens/subsection_notes_closures/` | **Page 3: Notes List** | List of notes under a subsection with snippets, tags, dates, and action bar. |
| `screens/note_editor_lexical_environment/` | **Page 4: Note Editor** | Split/markdown editor with syntax highlighting, asset attachments, auto-save indicator. |
| `screens/full_screen_focus_mode/` | **Focus / Study Mode** | Distraction-free reading canvas constrained to 68ch column width. |

---

## 4. Phase Status & Plans Matrix

Detailed implementation plans live in [`plans/`](../plans):

| Phase | Description | Status | Dedicated Plan |
|---|---|:---:|---|
| **Phase 0** | Project Setup & Design Reconciliation | Completed | — |
| **Phase 1** | Data Layer & Core Schema (Rust SQLite + WAL + Migrations) | Completed | [`plans/phase-1-data-layer.md`](../plans/phase-1-data-layer.md) |
| **Phase 2** | Page 1: Main Sections (Home Dashboard) | Completed | [`plans/phase-2-main-sections.md`](../plans/phase-2-main-sections.md) |
| **Phase 3** | Page 2: Subsections (Scoped Management) | **Completed** | [`plans/phase-3-subsections.md`](../plans/phase-3-subsections.md) |
| **Phase 4** | Page 3: Notes List (Scoped to Subsection) | **Completed** | [`plans/phase-4-notes-list.md`](../plans/phase-4-notes-list.md) |
| **Phase 5** | Page 4: Note Editor / Viewer (Markdown + Images + Auto-save) | **Completed** | [`plans/phase-5-note-editor.md`](../plans/phase-5-note-editor.md) |
| **Phase 6** | Cross-Cutting Polish: Themes, Performance, Data Integrity | Ready to Implement | [`plans/phase-6-theming-performance-integrity.md`](../plans/phase-6-theming-performance-integrity.md) |
| **Phase 7** | Deferred Features: Reordering (FR-6) & Local Search (FR-9) | Ready to Implement | [`plans/phase-7-reordering-and-search.md`](../plans/phase-7-reordering-and-search.md) |
| **Phase 8** | Packaging & Distribution (Arch Linux / AppImage) | Ready to Implement | [`plans/phase-8-packaging-and-distribution.md`](../plans/phase-8-packaging-and-distribution.md) |

---

## 5. Current Codebase State

### Rust Backend (`src-tauri/src/`)
- `db/mod.rs`: SQLite initialization with WAL mode (`PRAGMA journal_mode = WAL`), foreign keys (`PRAGMA foreign_keys = ON`), and versioned migration runner.
- `db/schema.rs`: Embedded SQL schema with tables `main_sections`, `subsections`, `notes`, `assets`, `schema_version`.
- `db/models.rs`: Structs `MainSection`, `MainSectionCascadeInfo`, `Subsection`, `SubsectionCascadeInfo`, `Note`, `Asset`.
- `db/commands.rs`: 20 CRUD commands with `BEGIN IMMEDIATE` / `COMMIT` transactions. Cascade-info commands (`get_main_section_cascade_info`, `get_subsection_cascade_info`, `get_note_cascade_info`) each have a testable `*_conn(&Connection, &str)` helper used by unit tests. Phase 5 additions: `get_note`, `get_note_context` (note + parent names/color join), `attach_note_asset` (writes file bytes into `~/.local/share/study-notes/assets/[uuid].[ext]`, then inserts the row inside a transaction — rolls back and deletes the file on failure), `read_asset_data_url` (reads a managed asset and returns an inline `data:` URL for offline webview rendering; path-traversal guarded). `delete_asset` now also removes the on-disk file (best-effort). Note: `create_asset` was superseded by `attach_note_asset` and removed.
- `db/tests.rs`: 21 in-memory SQLite unit tests covering schema creation, WAL mode, CRUD for all entities, cascade deletes, FK violations, `init()` end-to-end, cascade-info computations, `get_note`/`get_note_context`, `attach_note_asset_conn` (happy path + FK rollback leaving no files), `base64_encode` RFC vectors, and asset-path traversal rejection.
- `lib.rs`: Registers db state `Mutex<Connection>` and exposes all 20 Tauri commands.

### Frontend (`app/`, `components/`, `lib/`)
- Next.js 16 + React 19 + Tailwind CSS v4 with static export (`next.config.ts: output: 'export'`).
- `app/layout.tsx`: Configured with Inter and JetBrains Mono local font variables.
- `app/globals.css`: Full Terminal Noir design tokens configured via `@theme inline`.
- `app/page.tsx`: **Page 1 (Main Sections directory)** — full CRUD via `useMainSections`, client-side search, grid/list view toggle, sort (updated / A-Z / created), header strip, error banner, and all three modals wired up.
- `app/section/page.tsx`: **Page 2 (Subsections, complete)** — `/section?id=[mainSectionId]`, Suspense-wrapped `useSearchParams`. Composed of `SubsectionHero` (breadcrumb + parent banner + abbreviation badge + stats pills + "Edit Meta" trigger opening `EditSectionModal`), `SubsectionToolbar` (filter input, detailed/compact toggle, New Subsection), `SubsectionList` (detailed 2-col grid vs compact rows, skeleton loading, empty/no-match states, bottom quick-create banner), and modals: `CreateSubsectionModal`, `EditSubsectionModal`, `DeleteSubsectionDialog` (live cascade counts), plus quick-add-note dialog inside `SubsectionCard` (calls `create_note` directly). Invalid/deleted/missing `?id=` renders a themed "Main Section not found" state with back-navigation.
- `app/subsection/page.tsx`: **Page 3 placeholder** (`/subsection?id=[subId]`) — breadcrumbs back to Page 2, resolves parent section from `useMainSections`. Phase 4 target.
- `components/common/`: `Button` (primary/secondary/ghost/danger variants), `Dialog` (Esc + backdrop close, initial focus management), `Input` (label/error/icon states), `Badge`, `Icons.tsx` (inline SVG only — no CDN icon fonts).
- `components/layout/`: `AppSidebar` (collapsible, DevNotes branding, ⌘K search placeholder, dynamic section tree with color dots + expandable subsection links, Local SQLite status card), `AppHeader` (breadcrumbs, "Local Sync Active" badge, study-mode/command-palette placeholders).
- `components/sections/`: `SectionCard` / `SectionListRow` (grid + list views), `SectionGrid` (loading skeleton, both empty states), `SectionFilterBar` (search, view toggle, sort), `ColorPicker` (12 presets + custom hex w/ live preview), `CreateSectionModal`, `EditSectionModal`, `DeleteSectionDialog` (fetches real cascade counts via `get_main_section_cascade_info`).
- `components/subsections/`: `SubsectionHero`, `SubsectionToolbar` (exports `SubsectionViewMode = "detailed" | "compact"`), `SubsectionCard` (note preview tiles, ••• context menu, quick-add-note dialog), `SubsectionList`, `CreateSubsectionModal`, `EditSubsectionModal`, `DeleteSubsectionDialog`.
- `lib/api/`: `types.ts` (`MainSection`, `CascadeCounts`, `Subsection`, `SubsectionCascadeInfo`, `NotePreview`, `SubsectionWithDetails`, `Note`, `Asset`, `NoteContextHierarchy`, `TableOfContentsItem`, `EditorMode`, `SaveStatus`), `sections.ts` (main-section + `listSubsections` wrappers), `subsections.ts` (subsections CRUD + cascade info + `fetchNotesForSubsection`), `notes.ts` (notes CRUD + cascade info + `fetchNote`/`fetchNoteContext`), `assets.ts` (list/attach/remove + `fetchAssetDataUrl`).
- `lib/hooks/useMainSections.ts`: sections state + optimistic `addSection` / `editSection` / `removeSection` / `reload`.
- `lib/hooks/useSubsections.ts`: subsections state scoped to `mainSectionId` + note previews; exposes `filteredSubsections` (live search), `addSubsection` / `renameSubsection` / `removeSubsection` / `addNote` (all optimistic via `updateSnapshot`), `reload`, `setSearchQuery`. **Pattern to copy:** loading state is *derived* from an id-tagged snapshot (`isLoading = snapshot === null || snapshot.mainSectionId !== mainSectionId`) so query-param changes flip loading without synchronous setState in effects.
- `lib/hooks/useNotes.ts`: notes list scoped to `subsectionId` (same snapshot pattern) with search, add/rename/remove.
- `lib/utils/format.ts`: `formatRelativeTime`.
- `app/editor/page.tsx`: **Page 4 (Note Editor, complete)** — `/editor?id=[noteId]`, Suspense-wrapped, content keyed by note id so autosave flushes with the correct note on navigation. Composed of `EditorHeader` (breadcrumbs, two-state save badge, Edit/Split/Preview toggle, Zen + inspector toggles, delete, Save & Close), `EditorToolbar` (sticky H1–H3, bold/italic/strike, code block with language select, inline code, bullet/numbered lists, blockquote, link, image attach), `MarkdownEditor` (line-number gutter, Tab/Shift+Tab indent, list continuation on Enter, auto-closing pairs, Ctrl+B/I/K; imperative `applyTransform` handle shared with toolbar), `MarkdownPreview` (offline rendered markdown, copy buttons via event delegation, asset data-URL resolution), `NoteInspector` (right drawer: live TOC with smooth scroll-jump + media gallery with insert-at-cursor/remove + note meta), `AssetManagerModal` (file picker → bytes → managed storage copy; remove detaches DB row + disk file), `FocusModeView` (fullscreen Zen: column width Narrow/Std/Wide + A-/A/A+ font controls, Esc exits), and `DeleteNoteDialog` (reused from Page 3, flushes pending edits before delete, then routes back to Page 3).
- `lib/hooks/useAutoSave.ts`: debounced auto-save engine (1200ms) with `markDirty` / `flush` / `resetDirty`, Ctrl+S global handler, in-flight save serialization, and an unmount safety-net flush.
- `lib/hooks/useNoteEditor.ts`: note loading (id-tagged snapshot via `get_note_context`), title/content drafts wired to autosave, editor mode + zen state, note assets list with attach/remove.
- `lib/hooks/useTableOfContents.ts`: heading outline memoized over content (anchor ids shared with the renderer).
- `lib/utils/markdownRenderer.ts`: dependency-free markdown → sanitized HTML (headings/lists/quotes/fences, inline code/bold/italic/strike/links/images, per-language syntax highlighting for JS/TS/Rust/Python/SQL via sticky-regex tokenizer; every user string HTML-escaped before markup is generated) + `parseTableOfContents`.
- `lib/utils/assetPath.ts`: managed-asset path validation + cached data-URL resolver (`resolveAssetSrc`, `clearAssetCache`).

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

> **⚠️ Environment gotcha (this machine):** `cargo` on PATH is a rustup proxy that fails with `unknown proxy name: 'ZCode-…'` when invoked from sandboxed agents. Workaround: call the toolchain binary directly:
> `~/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin/cargo test --manifest-path src-tauri/Cargo.toml`

---

## 7. Session Learnings & Conventions (do not rediscover these)

1. **ESLint enforces `react-hooks/set-state-in-effect` as an error.** Never call setState synchronously inside a `useEffect` body (including through a called function like `reload()`). Approved patterns:
   - Fetch-on-mount: call async fetchers and setState **only inside `.then()`/`.catch()` callbacks** (see `useMainSections`), guarded by an `isMounted` flag.
   - Query-param-driven loading: derive `isLoading` from an id-tagged snapshot instead of resetting state in the effect (see `useSubsections`).
   - Dialogs that remount per item should initialize state via `useState` defaults + a `key` prop, not effect-side resets.
2. **TypeScript:** callback props typed `Promise<void>` reject `Promise<T>` implementations (no special-casing inside `Promise`). Type fire-and-forget submit callbacks as `Promise<unknown>`.
3. **`useSearchParams` must be inside a component wrapped in `<Suspense>`** (static-export requirement). All route pages follow this pattern — copy `app/section/page.tsx` when adding Page 3/4.
4. **Cascade-info pattern:** for any new cascade count UI, add a `get_*_cascade_info` Tauri command + `*_conn` helper + unit test, then have the confirmation dialog fetch live counts on open (see `DeleteSubsectionDialog`).
5. **Name validation convention:** all name inputs are trimmed, required, max 60 chars, enforced client-side in every create/edit modal.
6. **Navigation scheme:** Page 1 `/`, Page 2 `/section?id=[mainSectionId]`, Page 3 `/subsection?id=[subsectionId]`, Page 4 `/editor?id=[noteId]`. Note cards on Page 3 link into the editor; the editor's "Save & Close" returns to Page 3.
7. **⚠️ Tailwind v4 spacing-token collision (fixed once, never regress):** the custom `--spacing-sm/md/lg/xl/2xl` tokens in `app/globals.css` shadow Tailwind's default container scale, so `max-w-sm/md/lg/xl/2xl` resolve to 8/12/24/36/48 px instead of 24/28/32/36/42 rem. All such classes were replaced with explicit arbitrary values (`max-w-[28rem]`, `max-w-[42rem]`, …) across the app. **Never introduce `max-w-sm|md|lg|xl|2xl` again** — use the arbitrary-value form (3xl/4xl/5xl/6xl/7xl are safe).

---

## 8. Next Steps for Incoming Agent

1. **Phase 5 (Page 4: Note Editor) is complete and verified** (`cargo test` 21/21, clippy clean, `pnpm lint` clean, `pnpm build` static export OK, `pnpm check:offline` 0 violations) but may not be committed yet — check `git status` and commit before starting Phase 6.
2. **Implement Phase 6 (Cross-Cutting Polish):** Follow [`plans/phase-6-theming-performance-integrity.md`](../plans/phase-6-theming-performance-integrity.md).
3. **Deliberate deviation from the Phase 5 plan:** `attach_note_asset` accepts `file_bytes` (from an HTML file picker) instead of `source_file_path` — Tauri v2 has no dialog plugin configured and WebKitGTK file inputs don't expose absolute paths. Storage outcome is identical (UUID filename in the managed assets dir).
4. **Always ensure:** Any new command added in Rust is tested in `db/tests.rs` and registered in `lib.rs`, and frontend components use offline SVGs rather than external font CDNs.
