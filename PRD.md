# Product Requirements Document
## Study Notes Desktop Application

**Version:** 1.0 (Draft)
**Status:** Draft — pending confirmation on Pages 2–4 (see §9 Open Questions)
**Owner:** Ahmed

---

## 1. Overview

A **Linux-first, fully offline desktop application** for creating, organizing, and studying programming notes. The app targets developers/learners who want a focused, distraction-free environment to structure technical study material hierarchically, without any cloud, account, or backend dependency.

### 1.1 Product Pillars
| Pillar | Requirement |
|---|---|
| Platform | Desktop-only |
| OS Priority | Linux-first, primary target: **Arch Linux** |
| Data | 100% local, 100% offline |
| Auth | None — no accounts, no login |
| Backend | None — no server, no API calls |
| Sync | None — no cloud sync |
| Network | Zero internet dependency at runtime |

### 1.2 Goals
- Provide a clean, hierarchical system for organizing programming study notes.
- Keep the UX minimal: exactly **4 pages**, no feature sprawl.
- Guarantee data ownership: everything lives on disk, under the user's control.
- Be fast and lightweight enough to run comfortably on a typical Arch Linux desktop.

### 1.3 Non-Goals
- No multi-user support, no collaboration, no sharing.
- No mobile or web version (out of scope for v1).
- No AI-assisted note generation (unless added in a future version).
- No plugin/extension system in v1.

---

## 2. Core Data Model

The application organizes content in a strict 4-level hierarchy:

```
Main Section
└── Subsection
    └── Note
        └── Image / Asset
```

### 2.1 Entity Definitions

**Main Section**
- Top-level category (e.g., "Programming", "Databases", "Computer Science").
- Fields: `id`, `name`, `color`, `created_at`, `updated_at`, `order` (for manual sorting).
- Owns a collection of Subsections.

**Subsection**
- Belongs to exactly one Main Section.
- Fields: `id`, `main_section_id`, `name`, `created_at`, `updated_at`, `order`.
- Owns a collection of Notes.

**Note**
- Belongs to exactly one Subsection.
- Fields: `id`, `subsection_id`, `title`, `content` (rich text / markdown), `created_at`, `updated_at`, `order`.
- Owns a collection of Images/Assets.

**Image / Asset**
- Belongs to exactly one Note.
- Fields: `id`, `note_id`, `file_path` (relative, local), `alt_text` (optional), `created_at`.
- Stored on disk; referenced by path from the note content or as attachments.

### 2.2 Cascade Rules
- Deleting a Main Section deletes all of its Subsections, Notes, and Images (with confirmation).
- Deleting a Subsection deletes all of its Notes and Images (with confirmation).
- Deleting a Note deletes its associated Images (with confirmation).

---

## 3. Application Pages

The application consists of **exactly four pages**. This is a hard product constraint — no additional top-level pages should be introduced without revisiting this PRD.

### Page 1 — Main Sections (Home)
**Purpose:** Entry point of the app; displays all Main Sections.

**Responsibilities**
- Display all Main Sections as a list/grid.
- Create a new Main Section (name + color).
- Edit an existing Main Section (rename, change color).
- Delete a Main Section (with confirmation dialog, cascading delete).
- Assign/change a color for visual grouping.
- Navigate into a Main Section → opens **Page 2 (Subsections)** scoped to that section.

**Example**
```
Programming     [blue]
Frontend        [green]
Backend         [purple]
Databases       [orange]
Computer Science [red]
```

**UI Notes**
- Each Main Section is represented as a card/row showing: color swatch, name, and (optionally) subsection/note counts.
- Empty state: "No sections yet — create your first one."

---

### Page 2 — Subsections *(inferred — needs confirmation, see §9)*
**Purpose:** Displays all Subsections belonging to the selected Main Section.

**Responsibilities**
- Show breadcrumb / back-navigation to Page 1.
- Display all Subsections under the current Main Section.
- Create, edit, delete a Subsection (scoped to the parent Main Section).
- Navigate into a Subsection → opens **Page 3 (Notes)**.

---

### Page 3 — Notes List *(inferred — needs confirmation, see §9)*
**Purpose:** Displays all Notes belonging to the selected Subsection.

**Responsibilities**
- Show breadcrumb (Main Section → Subsection).
- Display all Notes in the Subsection (title, last updated, maybe a snippet/preview).
- Create, rename, delete, reorder Notes.
- Open a Note → **Page 4 (Note Editor/Viewer)**.
- Optionally: search/filter notes within the subsection.

---

### Page 4 — Note Editor / Viewer *(inferred — needs confirmation, see §9)*
**Purpose:** Read and edit a single Note's content, including embedded images/assets.

**Responsibilities**
- Rich text or Markdown editing (code blocks with syntax highlighting are important given the "programming notes" use case).
- Insert, preview, and manage images/assets attached to the note.
- Auto-save or explicit save to local storage.
- Delete the note (with confirmation).
- Navigate back to Page 3.

---

## 4. Navigation Flow

```
Page 1: Main Sections
   │  (select a Main Section)
   ▼
Page 2: Subsections (of selected Main Section)
   │  (select a Subsection)
   ▼
Page 3: Notes (of selected Subsection)
   │  (select a Note)
   ▼
Page 4: Note Editor/Viewer
```

- Back navigation must always be available (breadcrumbs and/or back button).
- Deep linking between pages is internal-only (no URLs needed, but state should persist so re-opening the app returns to a sensible default, e.g., Page 1).

---

## 5. Functional Requirements Summary

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | CRUD for Main Sections (name, color) | Must |
| FR-2 | CRUD for Subsections, scoped to a Main Section | Must |
| FR-3 | CRUD for Notes, scoped to a Subsection | Must |
| FR-4 | Attach/remove images or assets to a Note | Must |
| FR-5 | Cascading delete with confirmation at every level | Must |
| FR-6 | Manual reordering of sections/subsections/notes | Should |
| FR-7 | Color-coding for Main Sections | Must |
| FR-8 | Markdown/code-block support in Note content | Must |
| FR-9 | Local search across notes (title/content) | Should |
| FR-10 | Auto-save of note content | Should |
| FR-11 | Fully offline operation — no network calls anywhere | Must |
| FR-12 | No login/auth screens or user account concept | Must |

---

## 6. Non-Functional Requirements

- **Performance:** App should launch quickly (<2s cold start target) and handle at least a few thousand notes without UI lag.
- **Data Integrity:** All writes should be atomic/safe against crashes (avoid corrupting the local data store on power loss).
- **Portability:** Data should be stored in a well-defined local directory (e.g., `~/.local/share/study-notes/` on Linux) so it's easy to back up manually.
- **Platform Fit:** Should feel native/comfortable on Arch Linux — respect system theme (light/dark) where feasible, follow Linux desktop conventions (XDG base directories).
- **No Network Calls:** The app must not make any outbound network requests; this should be verifiable/auditable.

---

## 7. Suggested Technical Approach *(for discussion — not yet decided)*

Given the constraints (desktop-only, Linux-first, fully offline, no backend), suitable stacks include:

| Layer | Option A (JS/TS ecosystem) | Option B (Rust-native) |
|---|---|---|
| Shell | Electron | **Tauri** (lighter, more Linux/Arch-friendly, smaller binary) |
| Frontend | Next.js (static export) or plain React/Vite | React/Vite or Svelte |
| Local storage | SQLite (via `better-sqlite3` or Prisma w/ SQLite driver) | SQLite (via `rusqlite` or `sqlx`) |
| Assets | Local filesystem, referenced by relative path | Same |
| Rich text/Markdown editor | TipTap, Lexical, or a Markdown-first editor (e.g., CodeMirror + markdown-it) | Same idea via web frontend inside Tauri |

Given this is Linux-first and targets Arch specifically, **Tauri** is worth strong consideration over Electron for lower resource usage and a smaller footprint — but since your stated stack expertise is Next.js/NestJS/Laravel, an **Electron + Next.js (static export) + SQLite** stack may let you reuse more of your existing skillset. This tradeoff should be an explicit decision before implementation starts.

SQLite is a strong fit for the hierarchical relational model (Main Section → Subsection → Note → Asset) and supports full offline use with zero server.

---

## 8. Out of Scope (v1)

- Cloud backup/sync
- Multi-device support
- Collaboration/sharing
- Mobile/web companion apps
- Authentication of any kind
- Plugins/extensions
- AI features

---

## 9. Open Questions / Assumptions to Confirm

The original spec was cut off after the Page 1 example, so **Pages 2, 3, and 4 responsibilities above are inferred** from the stated hierarchy (Main Section → Subsection → Notes → Images) rather than explicitly given. Please confirm or correct:

1. Does Page 2 = Subsections list (scoped to a Main Section), Page 3 = Notes list (scoped to a Subsection), Page 4 = single Note editor with image management? Or is the page breakdown different (e.g., is there a combined Subsections+Notes page, freeing up Page 4 for something else like a dashboard/search page)?
2. What format should Note content be — Markdown, rich text (WYSIWYG), or a custom block editor? This matters a lot for the editor UI and storage format.
3. Should images be embedded inline in note content (like Markdown image syntax) or attached as a separate gallery per note?
4. Any specific packaging requirement for Arch — e.g., should this ship as an **AUR package**, a Flatpak, or a raw AppImage/binary?
5. Is a "Should" feature like search or manual reordering actually required for v1, or can it be deferred?

---

## 10. Success Criteria (v1)

- A user can create a full hierarchy (Main Section → Subsection → Note → Image) entirely offline.
- App requires no setup beyond installing/running the binary — no accounts, no config server.
- All CRUD operations across all 4 levels work reliably with no data loss across restarts.
- App runs natively and performantly on Arch Linux.
