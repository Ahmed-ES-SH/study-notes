# Phase 4 — Page 3: Notes List

**Goal:** Build the fully interactive, offline Notes management screen (Page 3) of the Study Notes desktop app per PRD §3 Page 3.

---

## Scope Summary

Implement the Notes directory view (Page 3) in Next.js (App Router with static export), strictly scoped to a selected parent `Subsection` and its grandparent `MainSection`. The user can view notes in a list, search and filter notes by title in real time, create new notes, rename existing notes, delete notes with cascade confirmation (displaying attached media/asset counts), and navigate into Page 4 (Note Editor/Viewer), backed by local SQLite persistence via Tauri IPC commands.

---

## Architecture & Design Decisions Confirmed

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Routing Strategy** | Next.js dynamic query route `/subsection?id=[subsectionId]` | Fully compatible with Next.js static export (`output: 'export'`) in Tauri; supports client-side URL search parameters and standard history navigation without server-side dynamic paths. |
| **Hierarchical Scoping** | Scoped query by `subsection_id` + contextual parent hierarchy fetch | Enforces relational hierarchy; fetches the parent `Subsection` and grandparent `MainSection` to populate breadcrumbs and domain context. |
| **Cascade Delete Safety** | Rust command `get_note_cascade_info` | Queries child asset count in real time before triggering `ON DELETE CASCADE`, guaranteeing user awareness of deleted media attachments. |
| **Quick Action / Rename** | In-place / modal title rename | Allows renaming note titles without opening the full Page 4 markdown editor. |
| **Editor Navigation Handoff** | Navigation to `/editor?id=[noteId]` | Opens Page 4 with the note ID; creates placeholder route `app/editor/page.tsx` for clean handoff into Phase 5. |
| **Styling & Design Tokens** | Terminal Noir tokens (`DESIGN.md`, `globals.css`) | Base `#0b141c`, container `#141c24`, elevated `#182028`, hairline borders `#30363d`. |
| **Zero Network (FR-11)** | Embedded offline SVG icons in `Icons.tsx` | Strictly prevents remote font/icon CDN fetching, passing `pnpm check:offline`. |

---

## File Structure (New & Modified)

```
app/
├── subsection/
│   └── page.tsx                         # MODIFY — Page 3: Notes directory scoped to ?id=[subsectionId]
├── editor/
│   └── page.tsx                         # NEW — Route placeholder for Page 4 Note Editor (?id=[noteId])
components/
├── notes/
│   ├── NoteHeader.tsx                   # NEW — Parent context header with breadcrumbs and actions
│   ├── NoteToolbar.tsx                  # NEW — Search input only
│   ├── NoteCard.tsx                     # NEW — Card with title, date, short snippet, and actions
│   ├── NoteList.tsx                     # NEW — Container managing view rendering, filtering, and empty states
│   ├── CreateNoteModal.tsx              # NEW — Modal dialog to create a new note under current subsection
│   ├── EditNoteTitleModal.tsx           # NEW — Quick title rename modal without opening full editor
│   └── DeleteNoteDialog.tsx             # NEW — Cascade delete confirmation modal with attached asset counts
lib/
├── api/
│   ├── notes.ts                         # NEW — Typed Tauri invoke wrappers for Notes & Cascade Info
│   └── types.ts                         # MODIFY — Add NoteCascadeInfo and SubsectionContext
├── hooks/
│   └── useNotes.ts                      # NEW — Custom hook managing notes fetching, filtering, and mutations
src-tauri/
├── src/
│   ├── db/
│   │   ├── commands.rs                  # MODIFY — Add get_note_cascade_info command
│   │   └── tests.rs                     # MODIFY — Add unit tests for note cascade info query
│   └── lib.rs                           # MODIFY — Register get_note_cascade_info command
```

---

## Data Layer & IPC Contracts

### 1. TypeScript Models (`lib/api/types.ts`)

```typescript
export interface Note {
  id: string;
  subsection_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  sort_order: number;
}

export interface NoteCascadeInfo {
  asset_count: number;
}

export interface SubsectionContext {
  subsection: Subsection;
  main_section: MainSection;
}
```

### 2. Tauri Commands (`src-tauri/src/db/commands.rs`)

Existing commands utilized:
- `list_notes(subsection_id: String) -> Result<Vec<Note>, String>`
- `create_note(subsection_id: String, title: String) -> Result<Note, String>`
- `update_note(id: String, title: Option<String>, content: Option<String>) -> Result<Note, String>`
- `delete_note(id: String) -> Result<(), String>`
- `list_subsections(main_section_id: String) -> Result<Vec<Subsection>, String>`
- `list_main_sections() -> Result<Vec<MainSection>, String>`

New Rust helper command:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteCascadeInfo {
    pub asset_count: i64,
}

#[tauri::command]
pub fn get_note_cascade_info(
    state: State<'_, Mutex<Connection>>,
    id: String,
) -> Result<NoteCascadeInfo, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;

    let asset_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM assets WHERE note_id = ?1",
        rusqlite::params![id],
        |r| r.get(0),
    ).unwrap_or(0);

    Ok(NoteCascadeInfo {
        asset_count,
    })
}
```

### 3. Frontend API Client (`lib/api/notes.ts`)

```typescript
import { invoke } from "@tauri-apps/api/core";
import { Note, NoteCascadeInfo } from "./types";

export async function fetchNotes(subsectionId: string): Promise<Note[]> {
  return await invoke<Note[]>("list_notes", { subsectionId });
}

export async function createNote(subsectionId: string, title: string): Promise<Note> {
  return await invoke<Note>("create_note", { subsectionId, title });
}

export async function updateNote(
  id: string,
  title?: string,
  content?: string
): Promise<Note> {
  return await invoke<Note>("update_note", { id, title, content });
}

export async function deleteNote(id: string): Promise<void> {
  await invoke("delete_note", { id });
}

export async function getNoteCascadeInfo(id: string): Promise<NoteCascadeInfo> {
  return await invoke<NoteCascadeInfo>("get_note_cascade_info", { id });
}
```

---

## Detailed UI & Feature Breakdown

### 1. Breadcrumbs & Subsection Context Header (`components/notes/NoteHeader.tsx`)
- **Breadcrumb trail**:
  - `Main Sections` (`/`) `>` `[Section Name]` (`/section?id=[mainSectionId]`) `>` `[Subsection Name]`.
  - Color dot indicating the parent Main Section's active accent color.
- **Header Block**:
  - Subsection title.
  - `N Notes` counter badge.
  - `+ New Note` button (opens creation modal).

### 2. Action Toolbar & Filter Controls (`components/notes/NoteToolbar.tsx`)
- **Search & Filtering**:
  - Search input with placeholder: `Search notes...`
  - Real-time client-side substring matching on note title.

### 3. Note Card Component (`components/notes/NoteCard.tsx`)
- **Card Info**:
  - Note Title (`text-xl font-semibold`).
  - Metadata row: Last modified relative time.
- **Short Snippet Preview**:
  - Plain-text snippet preview (first ~100 characters cleanly stripped of markdown syntax, computed client-side).
- **Action Buttons**:
  - `Open` Note (routes to Page 4 `/editor?id=[noteId]`).
  - `Rename` Note (opens quick rename modal).
  - `Delete` Note (opens cascade confirmation dialog).

### 4. Create & Quick Edit Note Modals
- **CreateNoteModal (`components/notes/CreateNoteModal.tsx`)**:
  - Autofocused title input field.
  - Validation: 1–120 characters, non-empty, trimmed.
  - "Cancel" and "Create Note" actions.
  - Option to create and jump directly into the editor.
- **EditNoteTitleModal (`components/notes/EditNoteTitleModal.tsx`)**:
  - Allows instant title renaming without loading the full editor.
  - Pre-filled with current title.
  - Persists changes via `update_note`.

### 5. Cascade Delete Confirmation Dialog (`components/notes/DeleteNoteDialog.tsx`)
- Critical safety guard implementing PRD §2.2, FR-3 & FR-5.
- Displays danger alert modal:
  - *"Are you sure you want to delete note **[Note Title]**?"*
  - *"This will permanently delete this note and **N attached images/media files**."*
- Real-time count queried via `get_note_cascade_info(id)`.
- Danger-styled "Delete Note and Assets" button + "Cancel" button.

### 6. Empty & Error States
- **Subsection Not Found Error**: If `?id=` is invalid, displays themed message with "Back to Main Sections" button.
- **Empty Subsection (0 Notes)**: Friendly empty state *"No notes yet in this subsection — create your first note to start studying"* with prominent `+ Create First Note` button.
- **No Search Matches**: *"No notes found matching '[query]'"* with "Clear Search" button.

---

## Implementation Steps

| # | Task | Dependencies | Output Files |
|---|------|--------------|--------------|
| **1** | **Add Rust Note Cascade Info Command**<br>Implement `get_note_cascade_info` in `commands.rs`, register in `lib.rs`, and write unit tests in `tests.rs`. | Phase 1 Backend | `src-tauri/src/db/commands.rs`<br>`src-tauri/src/lib.rs`<br>`src-tauri/src/db/tests.rs` |
| **2** | **Create TypeScript Notes API Client**<br>Implement typed invoke wrappers for notes in `lib/api/notes.ts` and update interfaces in `lib/api/types.ts`. | Task 1 | `lib/api/notes.ts`<br>`lib/api/types.ts` |
| **3** | **Implement Notes Data Hook**<br>Build `useNotes.ts` custom hook managing notes fetching, real-time search filtering, and mutations. | Task 2 | `lib/hooks/useNotes.ts` |
| **4** | **Build Note Card**<br>Create `NoteCard.tsx` rendering title, date, short plaintext snippet, and action buttons. | Task 3 | `components/notes/NoteCard.tsx` |
| **5** | **Implement Note Modals & Delete Dialog**<br>Create `CreateNoteModal`, `EditNoteTitleModal`, and `DeleteNoteDialog` with cascade asset count query. | Task 2 | `components/notes/CreateNoteModal.tsx`<br>`components/notes/EditNoteTitleModal.tsx`<br>`components/notes/DeleteNoteDialog.tsx` |
| **6** | **Build Note Context Header & Search Toolbar**<br>Create `NoteHeader.tsx` displaying breadcrumbs and title, and `NoteToolbar.tsx` with search input. | Task 3 | `components/notes/NoteHeader.tsx`<br>`components/notes/NoteToolbar.tsx` |
| **7** | **Assemble Page 3 View (`app/subsection/page.tsx`)**<br>Wire `NoteHeader`, `NoteToolbar`, `NoteList`, and modals with query param parsing, context loading, and error states. | Tasks 1–6 | `app/subsection/page.tsx`<br>`components/notes/NoteList.tsx` |
| **8** | **Add Page 4 Placeholder Route (`app/editor/page.tsx`)**<br>Create placeholder for Page 4 (Note Editor) with breadcrumbs back to Page 3, enabling navigation testing. | Task 7 | `app/editor/page.tsx` |
| **9** | **Offline & Build Verification**<br>Run `cargo test`, `pnpm check:offline`, `pnpm lint`, and `pnpm build` to verify clean offline build. | All Tasks | — |

---

## Edge Cases & Error Handling

1. **Invalid or Missing `subsection_id`:**
   - Displays a themed error card ("Subsection not found") with a direct link back to the main sections directory (`/`).
2. **Grandparent Section Resolution:**
   - When a subsection is loaded, its `main_section_id` is used to load the parent section for breadcrumb navigation and color theming. If the parent section is missing, breadcrumbs fallback gracefully to "Main Sections".
3. **Empty Notes State:**
   - If a subsection has zero notes, renders a clear call-to-action to create the first note rather than an empty container.
4. **Markdown Snippet Parsing Safety:**
   - Preview snippet function safely strips markdown formatting client-side for plain-text display.
5. **Cascade Delete Confirmation:**
   - Queries `get_note_cascade_info(noteId)` before showing delete dialog to display exact count of associated media files that will be deleted.
6. **Title Validation:**
   - Note titles are validated (1–120 characters, non-empty, trimmed) before submission.
7. **Zero Network Calls (FR-11):**
   - Strictly uses local offline SVG icons and CSS variables; zero remote CDN dependencies.

---

## Exit Criteria

- [ ] `cargo test` passes for all unit tests including note cascade query tests.
- [ ] `pnpm check:offline` reports 0 outbound network violations.
- [ ] `pnpm lint` and `pnpm build` pass with zero errors.
- [ ] Page 3 displays breadcrumbs (`Main Sections > [Section] > [Subsection]`) with the correct section accent color.
- [ ] Notes under the selected subsection are fetched and displayed accurately.
- [ ] Real-time search filters notes by title.
- [ ] User can create a new note and either stay on Page 3 or navigate to the editor.
- [ ] User can rename a note title using the quick rename modal.
- [ ] User can delete a note after confirming the cascade delete dialog showing attached asset counts.
- [ ] Clicking a note's "Open" button navigates to Page 4 (`/editor?id=[noteId]`).
- [ ] All data persists across restarts in local SQLite database.

---

## Estimated Effort

- **~9-11 files** created or modified
- **~400-600 lines** of TypeScript/React code
- **~40-60 lines** of Rust backend code
- **~60 lines** of Rust tests
