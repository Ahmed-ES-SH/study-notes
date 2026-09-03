# Study Notes Desktop App — Phased Build Plan

**Stack:** Tauri (Rust shell) + Next.js (static export) + SQLite
**Source:** `study-notes-desktop-app-prd.md` v1.0 (Draft)
**Target OS:** Linux-first, primary target Arch Linux

> **Note on screens/ folder:** The PRD (§9) leaves Pages 2–4 as *inferred*, and the screens/`*.html` + image pairs referenced were not provided for this plan. The phase breakdown below follows the PRD's stated hierarchy (Main Section → Subsection → Note → Image) and its inferred 4-page flow. **Phase 0 includes a mandatory reconciliation step**: before UI implementation begins, diff each `screens/*.html` file against the assumptions below and adjust page/component scope accordingly. Do not skip this — it's the cheapest point to catch a mismatch (e.g., merged Subsections+Notes page, a different editor type, a gallery vs. inline image model).

---

## Assumptions Locked From PRD (subject to Phase 0 confirmation against screens/)

| # | Assumption | PRD Source |
|---|---|---|
| 1 | 4 pages: Main Sections → Subsections → Notes → Note Editor | §3, §9 Q1 |
| 2 | Note content is Markdown (code blocks with syntax highlighting) | §3 Page 4, §5 FR-8 |
| 3 | Images attached per-note, referenced by relative local path | §2.1, §9 Q3 (treat as *both* attach-as-asset and insertable inline until screens confirm) |
| 4 | Packaging: raw binary/AppImage as baseline; AUR package as stretch goal | §9 Q4 |
| 5 | Search (FR-9) and manual reordering (FR-6) are "Should" — deferred to a post-MVP phase unless screens show them as core UI | §9 Q5 |

---

## Phase 0 — Project Setup & Design Reconciliation

**Goal:** A running Tauri + Next.js skeleton, correct data contracts, and confirmed page scope.

- Scaffold Tauri project with Next.js frontend (`output: 'export'` mode), confirm dev hot-reload works inside Tauri's webview on Arch.
- Set up SQLite via `rusqlite` (Rust-side data layer, exposed to frontend through Tauri commands — **not** a JS SQLite driver, to keep all DB access in the Rust process for safety/atomicity).
- Define local data directory per XDG conventions: `~/.local/share/study-notes/` (DB file + `assets/` subfolder for images).
- Reconcile assumptions table above against `screens/*.html`:
  - Confirm exact page count/boundaries.
  - Confirm editor type (Markdown vs WYSIWYG vs block editor) from the Page 4 HTML/CSS.
  - Confirm image model (inline markdown image syntax vs. separate gallery UI).
  - Extract confirmed color tokens, spacing, and component structure from the HTML/CSS into a shared Tailwind config / design tokens file.
- Set up base project conventions: TypeScript strict mode, ESLint/Prettier, Rust `clippy`/`rustfmt`.
- Set up an architecture test/guard that fails CI if any outbound `fetch`/`XMLHttpRequest`/network Tauri API is used anywhere (enforces FR-11/NFR "No Network Calls").

**Exit criteria:** App launches to a blank shell, DB file is created on first run, no network capability enabled in `tauri.conf.json` allowlist, design tokens extracted from screens.

---

## Phase 1 — Data Layer & Core Schema

**Goal:** The full 4-level hierarchy exists in SQLite with correct constraints, exposed via typed Tauri commands.

- SQLite schema for `main_sections`, `subsections`, `notes`, `assets` tables per PRD §2.1 fields, with `ON DELETE CASCADE` foreign keys to enforce §2.2 cascade rules at the DB level (not just app logic).
- Add `order` (integer) columns on all four levels for future manual reordering (FR-6), even if reordering UI ships later — cheaper to add now than migrate later.
- Write a small migration mechanism (even a simple versioned SQL runner) so schema can evolve without wiping user data — directly serves NFR "Data Integrity."
- Implement atomic write patterns (SQLite WAL mode + transactions) so a crash/power-loss mid-write can't corrupt the store (NFR "Data Integrity").
- Expose Tauri commands: `list_main_sections`, `create_main_section`, `update_main_section`, `delete_main_section` (cascading), and equivalents for subsections/notes/assets.
- Unit tests for cascade deletes at each level (deleting a Main Section removes its subsections/notes/assets; same for Subsection → Notes → Assets; Note → Assets).

**Exit criteria:** All CRUD + cascade operations for all 4 entities pass tests via direct Tauri command invocation (no UI yet).

---

## Phase 2 — Page 1: Main Sections (Home)

**Goal:** Fully working entry point per PRD §3 Page 1.

- List/grid view of Main Sections with color swatch, name, (optional) subsection/note counts.
- Create Main Section modal/form: name + color picker.
- Edit Main Section: rename, change color.
- Delete Main Section: confirmation dialog explicitly stating cascade impact (e.g., "This will delete N subsections and M notes").
- Empty state: "No sections yet — create your first one."
- Navigation: clicking a section routes to Page 2 scoped to that section's `id`.
- Wire this page's markup/styling to match the corresponding `screens/` HTML file once Phase 0 reconciliation is done.

**Exit criteria:** A user can create, rename, recolor, delete (with confirmation), and navigate into a Main Section — with real persistence surviving app restart.

---

## Phase 3 — Page 2: Subsections

**Goal:** Subsection management scoped to a parent Main Section (PRD §3 Page 2).

- Breadcrumb / back navigation to Page 1.
- List Subsections belonging to the current Main Section.
- Create / edit / delete Subsection (delete shows cascade confirmation for its Notes/Assets).
- Navigate into a Subsection → Page 3.
- Handle the "Main Section not found" edge case gracefully (e.g., deep-refresh after a section was deleted elsewhere).

**Exit criteria:** Full CRUD for Subsections working end-to-end, scoped correctly, cascade-safe.

---

## Phase 4 — Page 3: Notes List

**Goal:** Notes management scoped to a Subsection (PRD §3 Page 3).

- Breadcrumb (Main Section → Subsection).
- List Notes with title, last-updated timestamp, and short content snippet/preview.
- Create / rename / delete Note (delete cascades to its Assets, with confirmation).
- Navigate into a Note → Page 4.
- Stub in the "Should" features as disabled/deferred UI hooks rather than building them now: search input placeholder (FR-9) and drag-handle affordance (FR-6) — actual implementation happens in Phase 7.

**Exit criteria:** Notes CRUD complete and scoped correctly; opening a note routes to the editor with the correct `note_id`.

---

## Phase 5 — Page 4: Note Editor / Viewer

**Goal:** The core content-authoring experience (PRD §3 Page 4) — this is the highest-complexity phase.

- Markdown editor with code-block syntax highlighting (e.g., CodeMirror 6 with a markdown + language-aware highlighting setup — fits your existing stack knowledge better than a heavier WYSIWYG lib like TipTap, and matches PRD §7's "Markdown-first editor" suggestion).
- Live preview or split-pane preview (confirm against screens whether it's split-view, tab-toggle, or single WYSIWYG-style rendering).
- Image/asset attachment flow:
  - File picker → copy selected image into the app's local `assets/` directory (never reference files outside app-managed storage, to keep backups/portability simple per NFR "Portability").
  - Insert as Markdown image syntax at cursor position, and/or list as attached assets (confirm exact UX from screens — PRD leaves this open in §9 Q3).
  - Remove/detach an image (deletes the DB row and, ideally, the on-disk file if unreferenced elsewhere).
- Save strategy: implement auto-save (debounced, e.g., 1–2s after typing stops) per FR-10, with a visible "saved" / "saving" indicator, plus explicit manual save as a fallback.
- Delete Note from within the editor (confirmation, cascades to assets), returns to Page 3.
- Back navigation to Page 3 without losing unsaved changes (flush pending auto-save on navigate-away).

**Exit criteria:** A user can write Markdown notes with syntax-highlighted code blocks, attach/remove images, have content auto-saved, and reliably reopen the note later with full content and images intact.

---

## Phase 6 — Cross-Cutting Polish: Theming, Performance, Integrity

**Goal:** Meet the PRD's non-functional requirements holistically, now that all 4 pages exist.

- System theme detection (light/dark) via Tauri's theme APIs, applied consistently across all 4 pages.
- Performance pass: verify cold start <2s target; test with a seeded dataset of a few thousand notes to confirm list views (Pages 1–3) don't lag (virtualize long lists if needed).
- Full audit of cascade-delete confirmation dialogs for consistent copy/UX across all 3 delete-with-cascade flows (Main Section, Subsection, Note).
- Network audit: confirm the Phase 0 CI guard passes — zero outbound calls anywhere in the built app (FR-11, NFR "No Network Calls" — should be independently verifiable, e.g., via a network-monitoring smoke test against the packaged binary).
- Data integrity pass: simulate crash-mid-write scenarios (kill process during a save) and confirm no DB corruption thanks to WAL mode/transactions from Phase 1.

**Exit criteria:** App feels native on Arch (theme-aware), performs acceptably at scale, and passes an explicit "no network, no data loss" verification pass.

---

## Phase 7 — Deferred "Should" Features

**Goal:** Ship FR-6 and FR-9, previously stubbed in Phase 4.

- **Manual reordering (FR-6):** drag-and-drop reorder for Main Sections, Subsections, and Notes, persisting to the `order` column added in Phase 1.
- **Local search (FR-9):** search across note titles and content, scoped app-wide or per-subsection (confirm scope against screens if a dedicated search UI exists there); SQLite `LIKE`/FTS5 virtual table is a good fit for offline full-text search without extra dependencies.

**Exit criteria:** Reordering persists correctly across restarts; search returns accurate results against title and content.

---

## Phase 8 — Packaging & Distribution

**Goal:** Ship an installable artifact per PRD §9 Q4 / §6 "Platform Fit."

- Baseline: produce a Tauri-built raw binary / AppImage for Arch Linux, confirm it runs with no missing system dependencies on a clean Arch install.
- Stretch: package as an AUR (`PKGBUILD`) entry, and/or Flatpak manifest, based on final decision (this was left open in the PRD — confirm with stakeholder before investing time here).
- Verify the data directory (`~/.local/share/study-notes/`) is created correctly on first run for a freshly installed package (not just `cargo tauri dev`).
- Write a short "backup your data" note in the README pointing at the data directory, since there's no cloud sync by design (§8 Out of Scope).

**Exit criteria:** A user on a clean Arch Linux machine can install the package, launch the app, and have a working, correctly-located local data store with no manual setup.

---

## Suggested Sequencing Summary

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8
(setup)   (data)     (P1 UI)   (P2 UI)   (P3 UI)   (P4 UI)   (polish)  (should)   (ship)
```

Phases 2–5 mirror the app's own navigation depth (Main Sections → Subsections → Notes → Editor), so each phase is independently demoable and testable before moving deeper into the hierarchy. Phase 7 is intentionally deferred rather than interleaved, since both its features (FR-6, FR-9) are explicitly "Should," not "Must," per PRD §5 — this keeps the critical path to a demoable MVP (end of Phase 5) as short as possible.

---

## Open Items Requiring Your Input (carried over from PRD §9)

These weren't resolved by this plan and should be confirmed before or during Phase 0:

1. Exact page boundaries if `screens/` differs from the inferred 4-page breakdown.
2. Inline Markdown images vs. separate attached-gallery UX for Page 4.
3. Final packaging target: AppImage only, or also AUR/Flatpak.
4. Whether "Should" items (search, reordering) need to be pulled earlier into the MVP scope.
