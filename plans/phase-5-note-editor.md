# Phase 5 — Page 4: Note Editor & Viewer

**Goal:** Build the core content-authoring and study experience (Page 4) of the Study Notes desktop app per PRD §3 Page 4, `DESIGN.md` (Terminal Noir design system), and `screens/note_editor_lexical_environment/`.

---

## Scope Summary

Implement the Note Editor & Viewer (Page 4) in Next.js (App Router with static export), strictly scoped to a selected `Note` by ID (`/editor?id=[noteId]`). The user can edit note titles and markdown content in real time, apply formatting via a sticky toolbar, preview rich rendered markdown with syntax-highlighted code blocks, attach and detach local images/media (copied to app-managed storage `~/.local/share/study-notes/assets/`), auto-save changes with debounced persistence and a flush-on-exit guarantee, inspect the note's heading outline and attached media in a collapsible drawer, switch into a distraction-free full-screen focus/study mode, and delete notes with cascade asset warnings — all fully offline and backed by SQLite.

---

## Architecture & Design Decisions Confirmed

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Routing Strategy** | Next.js dynamic query route `/editor?id=[noteId]` | Fully compatible with Next.js static export (`output: 'export'`) in Tauri; supports reload and standard browser back/forward history. |
| **Editor Technology** | Lightweight Controlled Markdown Engine with Syntax Highlighting | Clean, high-performance Markdown editing with line numbers, monospace code blocks, and split-view/preview rendering. |
| **Save Strategy (FR-10)** | Debounced Auto-Save (1200ms) + Immediate Flush (`Ctrl+S` / `Cmd+S`) | Prevents data loss; writes atomically to SQLite via `update_note`. Unmount hook flushes pending auto-saves before navigation completes. |
| **Save State Indicator** | Two-state visual indicator | Simple visual feedback: `Saving...` (Amber) or `Saved` (Emerald check). |
| **Image & Asset Storage (FR-4)** | App-Managed Local Storage (`~/.local/share/study-notes/assets/`) | User-selected images are copied into the app's local assets directory with a UUID filename; guarantees self-contained data backups per NFR "Portability". |
| **Inline Asset Rendering** | Tauri custom protocol / base64 asset resolver | Renders local image assets securely in the webview without network calls (FR-11). |
| **Focus Mode** | Distraction-free study canvas | Hides navigation chrome, centers content in a constrained reading column with font size and width controls. |
| **Collapsible Inspector Drawer** | Right-hand slideout panel (`NoteInspector`) | Contains live Table of Contents (parsed from `#` headers) and attached media gallery. |
| **Cascade Delete Safety** | In-editor delete with cascade confirmation | Queries `get_note_cascade_info(id)` and returns to Page 3 (`/subsection?id=[subId]`). |
| **Styling & Tokens** | Terminal Noir tokens (`DESIGN.md`, `globals.css`) | Base `#0b141c`, container `#141c24`, elevated `#182028`, hairline borders `#30363d`, syntax accents. |

---

## File Structure (New & Modified)

```
app/
├── editor/
│   └── page.tsx                         # MODIFY — Page 4: Note Editor & Viewer scoped to ?id=[noteId]
components/
├── editor/
│   ├── EditorHeader.tsx                 # NEW — Top bar with breadcrumb trail, save status & primary actions
│   ├── EditorToolbar.tsx                # NEW — Sticky formatting toolbar (headings, bold, italic, code, lists, link, image)
│   ├── MarkdownEditor.tsx               # NEW — Controlled markdown textarea with line numbers & shortcuts
│   ├── MarkdownPreview.tsx              # NEW — Rich rendered markdown preview with syntax highlighting
│   ├── NoteInspector.tsx                # NEW — Collapsible right drawer with outline TOC and attached media gallery
│   ├── AssetManagerModal.tsx            # NEW — Modal to view, attach, and remove local image assets
│   └── FocusModeView.tsx                # NEW — Fullscreen distraction-free reading canvas with width/font controls
lib/
├── api/
│   ├── notes.ts                         # MODIFY — Add getNote query
│   ├── assets.ts                        # NEW — Typed Tauri invoke wrappers for local image asset operations
│   └── types.ts                         # MODIFY — Add Asset, EditorMode, SaveStatus interfaces
├── hooks/
│   ├── useAutoSave.ts                   # NEW — Custom hook managing debounced auto-save & flush on unmount
│   ├── useNoteEditor.ts                 # NEW — Custom hook managing note data, dirty state, and editor mode
│   └── useTableOfContents.ts            # NEW — Custom hook extracting heading hierarchy from markdown text
lib/
├── utils/
│   ├── markdownRenderer.ts              # NEW — Markdown parser & sanitizer with code block highlighting
│   └── assetPath.ts                     # NEW — Resolves local Tauri asset file paths for secure webview rendering
src-tauri/
├── src/
│   ├── db/
│   │   ├── commands.rs                  # MODIFY — Add get_note and attach_note_asset commands
│   │   └── tests.rs                     # MODIFY — Add unit tests for get_note and asset attachment
│   └── lib.rs                           # MODIFY — Register new Tauri commands
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

export interface Asset {
  id: string;
  note_id: string;
  file_path: string;
  alt_text: string;
  created_at: string;
}

export interface TableOfContentsItem {
  id: string;
  text: string;
  level: number; // 1 = H1, 2 = H2, 3 = H3
  line_number: number;
}

export type EditorMode = "edit" | "split" | "preview" | "zen";

export type SaveStatus = "saved" | "saving";

export interface NoteContextHierarchy {
  note: Note;
  subsection_name: string;
  main_section_id: string;
  main_section_name: string;
  main_section_color: string;
}
```

### 2. Tauri Commands (`src-tauri/src/db/commands.rs`)

Existing commands utilized:
- `update_note(id: String, title: Option<String>, content: Option<String>) -> Result<Note, String>`
- `delete_note(id: String) -> Result<(), String>`
- `list_assets(note_id: String) -> Result<Vec<Asset>, String>`
- `delete_asset(id: String) -> Result<(), String>`
- `get_note_cascade_info(id: String) -> Result<NoteCascadeInfo, String>`

New Rust helper commands:
```rust
#[tauri::command]
pub fn get_note(
    state: State<'_, Mutex<Connection>>,
    id: String,
) -> Result<Note, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, subsection_id, title, content, created_at, updated_at, sort_order
         FROM notes WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(Note {
                id: row.get(0)?,
                subsection_id: row.get(1)?,
                title: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                sort_order: row.get(6)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn attach_note_asset(
    state: State<'_, Mutex<Connection>>,
    note_id: String,
    source_file_path: String,
    alt_text: String,
) -> Result<Asset, String> {
    let mut conn = state.lock().map_err(|e| e.to_string())?;

    // 1. Resolve local app data assets directory: ~/.local/share/study-notes/assets/
    let data_dir = dirs::data_local_dir()
        .ok_or_else(|| "Failed to resolve local data directory".to_string())?
        .join("study-notes")
        .join("assets");
    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;

    // 2. Generate unique filename preserving original extension
    let source_path = std::path::Path::new(&source_file_path);
    let extension = source_path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("png");
    let asset_id = uuid::Uuid::new_v4().to_string();
    let dest_filename = format!("{}.{}", asset_id, extension);
    let dest_path = data_dir.join(&dest_filename);

    // 3. Copy file to managed app storage
    std::fs::copy(source_path, &dest_path).map_err(|e| e.to_string())?;

    // 4. Record in SQLite assets table inside an atomic transaction
    let now = chrono::Utc::now().to_rfc3339();
    let relative_path = format!("assets/{}", dest_filename);

    let tx = conn.transaction().map_err(|e| {
        std::fs::remove_file(&dest_path).ok();
        e.to_string()
    })?;

    let insert_res = tx.execute(
        "INSERT INTO assets (id, note_id, file_path, alt_text, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![asset_id, note_id, relative_path, alt_text, now],
    );

    match insert_res {
        Ok(_) => tx.commit().map_err(|e| e.to_string())?,
        Err(e) => {
            // Transaction rolls back on drop; clean up the copied file
            std::fs::remove_file(&dest_path).ok();
            return Err(e.to_string());
        }
    }

    Ok(Asset {
        id: asset_id,
        note_id,
        file_path: relative_path,
        alt_text,
        created_at: now,
    })
}
```

### 3. Frontend API Client (`lib/api/notes.ts` & `lib/api/assets.ts`)

```typescript
import { invoke } from "@tauri-apps/api/core";
import { Note, Asset } from "./types";

export async function fetchNote(id: string): Promise<Note> {
  return await invoke<Note>("get_note", { id });
}

export async function saveNoteContent(
  id: string,
  title?: string,
  content?: string
): Promise<Note> {
  return await invoke<Note>("update_note", { id, title, content });
}

export async function attachAsset(
  noteId: string,
  sourceFilePath: string,
  altText: string
): Promise<Asset> {
  return await invoke<Asset>("attach_note_asset", {
    noteId,
    sourceFilePath,
    altText,
  });
}

export async function removeAsset(id: string): Promise<void> {
  await invoke("delete_asset", { id });
}

export async function fetchNoteAssets(noteId: string): Promise<Asset[]> {
  return await invoke<Asset[]>("list_assets", { noteId });
}
```

---

## Detailed UI & Feature Breakdown

### 1. Editor Status Header (`components/editor/EditorHeader.tsx`)
- **Breadcrumb trail**:
  - `[Main Section]` (link) `>` `[Subsection]` (link to `/subsection?id=[subId]`) `>` `Editing: [Note Title]`.
- **Auto-Save Status Badge**:
  - `Saving...` — Amber indicator during active IPC save.
  - `Saved` — Emerald check icon after successful save.
- **Top Actions**:
  - **View Mode Toggle**: Switches between Edit, Split-View, and Preview.
  - **Zen Mode Toggle**: Enters distraction-free full-screen mode (`FocusModeView`).
  - **Save & Close Button**: Flushes pending changes immediately and navigates back to Page 3 (`/subsection?id=[subId]`).
  - **Toggle Inspector Drawer Button**: Shows/hides right-hand TOC & media drawer.

### 2. Sticky Formatting Toolbar (`components/editor/EditorToolbar.tsx`)
- Sticky under the status header:
  - **Headers**: `H1`, `H2`, `H3` quick toggle buttons.
  - **Inline Styles**: Bold (`⌘B`), Italic (`⌘I`).
  - **Code**: Code block insert (with language selector: JS, TS, Rust, Python, SQL) + inline code button.
  - **Lists**: Bullet list, Numbered list, Blockquote.
  - **Inserts**:
    - `Link`: Inserts `[text](url)` (`⌘K`).
    - `Attach Image`: Opens local file picker to copy and insert image as `![alt](asset_path)`.

### 3. Markdown Canvas & Split Preview (`components/editor/MarkdownEditor.tsx` & `MarkdownPreview.tsx`)
- **Title Input**:
  - Frameless large typography input (`font-bold text-3xl leading-snug`).
  - Real-time binding with auto-save dirty tracker.
- **Editor Canvas**:
  - Monospace line numbering gutter.
  - Markdown text editor with tab-indent support (`Tab` / `Shift+Tab`), auto-closing quotes/brackets, and keyboard shortcuts.
- **Split / Live Preview Mode**:
  - Synchronized dual-pane layout (Editor on left, Live Rendered Markdown on right).
  - Syntax-highlighted code blocks with copy buttons.
  - Embedded local asset images rendered from the local data store.

### 4. Note Inspector & Table of Contents Drawer (`components/editor/NoteInspector.tsx`)
- **Dynamic Table of Contents**:
  - Real-time heading list parsed from markdown headings (`# H1`, `## H2`, `### H3`).
  - Smooth-scroll jumping to target heading when clicked.
- **Attached Media Gallery**:
  - Thumbnail strip of attached local assets.
  - "Insert at cursor" button and "Remove" asset action.

### 5. Full-Screen Focus Mode (`components/editor/FocusModeView.tsx`)
- Distraction-free reading/study canvas:
  - Top navigation bar with "Back to Subsection" button.
  - Reading column width selector: **Narrow** (`max-w-2xl`), **Std** (`max-w-4xl`), **Wide** (`max-w-6xl`).
  - Font size adjustment buttons: `A-` (14px), `A` (16px default), `A+` (19px).
  - Rendered markdown with syntax-highlighted code blocks (read-only view).

### 6. Auto-Save Engine (`lib/hooks/useAutoSave.ts`)
- **Debounced Save Loop**:
  - Triggers save 1200ms after last title/content keystroke.
  - Prevents database lock contention while ensuring low latency.
- **Immediate Flush Handlers**:
  - `Cmd+S` / `Ctrl+S` forces immediate save.
  - "Save & Close" button flushes pending state before calling `router.push()`.
  - React unmount effect flushes pending edits before navigation completes.

### 7. Empty & Error States
- **Note Not Found Error**: If `?id=` is invalid, displays themed error with a button to return to the parent subsection or home.
- **Image Load Fallback**: Graceful placeholder if an attached image asset file is missing on disk.

---

## Implementation Steps

| # | Task | Dependencies | Output Files |
|---|------|--------------|--------------|
| **1** | **Add Rust `get_note` and `attach_note_asset` Commands**<br>Implement note retrieval and local asset file-copy commands in `commands.rs`, register in `lib.rs`, and write unit tests in `tests.rs`. | Phase 1 Backend | `src-tauri/src/db/commands.rs`<br>`src-tauri/src/lib.rs`<br>`src-tauri/src/db/tests.rs` |
| **2** | **Create TypeScript API & Asset Clients**<br>Implement `lib/api/assets.ts`, update `lib/api/notes.ts`, and expand types in `lib/api/types.ts`. | Task 1 | `lib/api/assets.ts`<br>`lib/api/notes.ts`<br>`lib/api/types.ts` |
| **3** | **Build Markdown Parsing & Syntax Utilities**<br>Create `lib/utils/markdownRenderer.ts` and `lib/utils/assetPath.ts` with code highlighting and local asset resolution. | Phase 0 CSS | `lib/utils/markdownRenderer.ts`<br>`lib/utils/assetPath.ts` |
| **4** | **Implement Table of Contents & Auto-Save Hooks**<br>Build `useTableOfContents.ts`, `useAutoSave.ts`, and `useNoteEditor.ts` managing editor state and lifecycle save flushes. | Task 2, 3 | `lib/hooks/useTableOfContents.ts`<br>`lib/hooks/useAutoSave.ts`<br>`lib/hooks/useNoteEditor.ts` |
| **5** | **Build Editor Status Header & Breadcrumbs**<br>Create `EditorHeader.tsx` with breadcrumbs, save status indicator, view toggles, and drawer toggle. | Task 4 | `components/editor/EditorHeader.tsx` |
| **6** | **Build Sticky Formatting Toolbar**<br>Create `EditorToolbar.tsx` with headings, inline styles, code block insert, lists, link, and image attach trigger. | Task 4 | `components/editor/EditorToolbar.tsx` |
| **7** | **Build Markdown Editor & Preview Panes**<br>Create `MarkdownEditor.tsx` (with line numbers and shortcuts) and `MarkdownPreview.tsx` (rendered view with copyable code blocks). | Tasks 3, 6 | `components/editor/MarkdownEditor.tsx`<br>`components/editor/MarkdownPreview.tsx` |
| **8** | **Build Note Inspector & TOC Drawer**<br>Create `NoteInspector.tsx` with dynamic heading outline navigation and attached media gallery. | Tasks 4, 7 | `components/editor/NoteInspector.tsx` |
| **9** | **Build Local Asset Attachment Modal**<br>Create `AssetManagerModal.tsx` for browsing, uploading, and detaching images with local storage copy. | Tasks 2, 8 | `components/editor/AssetManagerModal.tsx` |
| **10** | **Build Full-Screen Focus Mode View**<br>Create `FocusModeView.tsx` with reading column width and font size controls. | Tasks 3, 7 | `components/editor/FocusModeView.tsx` |
| **11** | **Assemble Page 4 View (`app/editor/page.tsx`)**<br>Wire `EditorHeader`, `EditorToolbar`, `MarkdownEditor`, `MarkdownPreview`, `NoteInspector`, and `FocusModeView` with state persistence and delete confirmation. | Tasks 1–10 | `app/editor/page.tsx` |
| **12** | **Offline & Build Verification**<br>Run `cargo test`, `pnpm check:offline`, `pnpm lint`, and `pnpm build` to verify clean build and offline compliance. | All Tasks | — |

---

## Edge Cases & Error Handling

1. **Unsaved Changes on Navigate Away:**
   - The `useAutoSave` unmount hook guarantees pending changes are flushed to SQLite immediately, preventing data loss.
2. **Invalid or Missing `note_id`:**
   - Displays a clean error screen ("Note not found") with a return button to the parent subsection or home.
3. **Local Image File Handling:**
   - When attaching an image, files are copied into `~/.local/share/study-notes/assets/[uuid].[ext]`. If copying fails, database insertion is rolled back and an error toast is displayed.
4. **Deleting an Attached Asset:**
   - Deleting an asset removes its entry from the SQLite `assets` table and cleans up the on-disk file in the assets directory.
5. **Keyboard Shortcuts:**
   - `Cmd+S` / `Ctrl+S` (Save), `Cmd+B` (Bold), `Cmd+I` (Italic), `Cmd+K` (Link), `Esc` (Exit Zen / close modal) work seamlessly on Linux.
6. **Auto-Save Race Conditions:**
   - Auto-save uses atomic `BEGIN IMMEDIATE` transactions in SQLite, preventing database locks or partial writes.
7. **Zero Network Calls (FR-11):**
   - Syntax highlighting, markdown parsing, icons, and fonts are 100% locally bundled with zero CDN requests.

---

## Exit Criteria

- [ ] `cargo test` passes for all unit tests including `get_note` and `attach_note_asset`.
- [ ] `pnpm check:offline` reports 0 outbound network violations.
- [ ] `pnpm lint` and `pnpm build` pass with zero errors.
- [ ] User can edit note title and markdown body with real-time preview.
- [ ] Sticky toolbar formats text (Headings, Bold, Italic, Code blocks, Lists, Link, Image).
- [ ] Auto-save persists edits to SQLite after 1200ms debounce with visible status indicator (`Saving...` / `Saved`).
- [ ] Unsaved changes are reliably flushed when navigating away without losing data.
- [ ] User can attach local image files (copied to app-managed storage) and render them inline.
- [ ] Table of Contents dynamically reflects markdown headings and scrolls to sections when clicked.
- [ ] User can toggle Full-Screen Focus mode with column width and font size controls.
- [ ] User can delete the note from within the editor after confirming cascade deletion.
- [ ] Note content and attached assets survive application restarts without data corruption.

---

## Estimated Effort

- **~13-15 files** created or modified
- **~900-1,100 lines** of TypeScript/React code
- **~80-110 lines** of Rust backend code
- **~80 lines** of Rust tests
