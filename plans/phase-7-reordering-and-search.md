# Phase 7 — Deferred Features: Manual Reordering & Local Full-Text Search

**Goal:** Implement the PRD "Should" functional requirements: **FR-6 (Manual Reordering)** across all three structural levels (Main Sections, Subsections, Notes) and **FR-9 (Local Full-Text Search)** with a global `Cmd+K` command palette and in-page scoped search, operating 100% offline with SQLite FTS5.

---

## Scope Summary

Deliver the complete manual organization and discovery suite for the Study Notes app:
1. **Manual Drag-and-Drop Reordering (FR-6):** Enable intuitive, visual drag-and-drop and keyboard-accessible reordering of Main Sections (Page 1), Subsections (Page 2), and Notes (Page 3). Persist user-defined sort order atomically into the `sort_order` column in SQLite via batch IPC commands.
2. **Local Full-Text Search & Discovery (FR-9):** Build an ultra-fast, offline search engine using SQLite FTS5 virtual tables (`notes_fts`) with automatic synchronization triggers. Support search over note titles, markdown text, headings, and code snippets with rank scoring, exact match weighting, and snippet extraction with keyword highlighting.
3. **Global Command Palette (`Cmd+K` / `Ctrl+K`):** Provide an elevated system command palette accessible anywhere in the application to instantly jump to any Main Section, Subsection, or Note, switch themes, or trigger quick actions.
4. **Scoped In-Page Filtering & Highlighting:** Enhance the existing filter bars on Page 2 and Page 3 with full-text search capability, match count badges, and snippet previews highlighting query terms.

---

## Architecture & Design Decisions Confirmed

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Search Engine Core** | SQLite FTS5 (`notes_fts` virtual table with BM25 ranking) | Zero external dependencies; sub-millisecond full-text queries across 10,000+ notes directly within SQLite, strictly complying with FR-11 (100% offline). |
| **FTS Synchronization** | SQLite SQL Triggers (`AFTER INSERT`, `AFTER UPDATE`, `AFTER DELETE` on `notes`) | Guaranteed automatic data consistency between the primary `notes` table and `notes_fts` index within the same atomic transaction. |
| **Search Scoping** | Tri-tier Scope: Global (All Notes), Main Section-scoped, or Subsection-scoped | Allows rapid global lookup via Command Palette as well as focused exploration within a specific study topic. |
| **Global Command Palette** | Elevated modal overlay (`#161b22`, 1px border `#30363d`, `Cmd+K`) | Matches `DESIGN.md` specification; keyboard-first navigation (`↑`/`↓` to navigate, `Enter` to open, `Esc` to dismiss). |
| **Reordering Interaction** | Drag handles (`drag_indicator`) + Accessible `Move Up` / `Move Down` controls | Provides smooth visual pointer reordering while ensuring full keyboard accessibility for screen readers and power users. |
| **Reorder Persistence** | Atomic batch update command `reorder_entities(entity_type, ordered_ids)` | Updates all affected rows in a single `BEGIN IMMEDIATE` transaction; eliminates race conditions or partial sort order states. |
| **Search Highlight UX** | Client-side safe mark wrapping (`<mark className="bg-amber-500/20 text-amber-300">`) | Clear visual feedback for matched search terms without breaking markdown rendering or code syntax blocks. |

---

## File Structure (New & Modified)

```
app/
├── layout.tsx                           # MODIFY — Mount global CommandPalette modal listener (Cmd+K / Ctrl+K)
components/
├── search/
│   ├── CommandPalette.tsx               # NEW — Elevated Cmd+K modal with quick search, recent items & actions
│   ├── SearchResultItem.tsx             # NEW — Search item row with breadcrumb path, title, snippet & score badge
│   ├── SearchScopeFilter.tsx            # NEW — Segmented pills to toggle Global / Section / Subsection search
│   └── HighlightedText.tsx              # NEW — Utility component highlighting matched query keywords safely
├── common/
│   ├── DragHandle.tsx                   # NEW — Monospace visual drag grip affordance with hover indicator
│   ├── ReorderableList.tsx              # NEW — Accessible wrapper managing drag events and reorder callbacks
│   └── KeyboardShortcutBadge.tsx        # NEW — Noir-styled keyboard shortcut chip (e.g. ⌘K, ↵, ESC)
├── sections/
│   ├── SectionCard.tsx                  # MODIFY — Add drag handle & sort drop-target styling
│   └── SectionGrid.tsx                  # MODIFY — Integrate reorder handler for Main Sections
├── subsections/
│   ├── SubsectionCard.tsx               # MODIFY — Add drag handle & sort drop-target styling
│   └── SubsectionList.tsx               # MODIFY — Integrate reorder handler for Subsections
├── notes/
│   ├── NoteCard.tsx / NoteListRow.tsx   # MODIFY — Add drag handles & full-text match snippet highlights
│   ├── NoteToolbar.tsx                  # MODIFY — Wire full-text search query execution
│   └── NoteList.tsx                     # MODIFY — Integrate reorder handler for Notes
lib/
├── api/
│   ├── search.ts                        # NEW — Typed Tauri invoke wrappers for full-text search
│   ├── reorder.ts                       # NEW — Typed Tauri invoke wrappers for batch entity reordering
│   └── types.ts                         # MODIFY — Add SearchResult, SearchQuery, ReorderPayload interfaces
├── hooks/
│   ├── useCommandPalette.ts             # NEW — Custom hook managing Cmd+K shortcuts, search input, and results
│   ├── useDragReorder.ts                # NEW — Custom hook managing drag state, drop targets, and optimistic reordering
│   └── useDebounce.ts                   # EXISTING / MODIFY — Debounce search input queries (150ms)
src-tauri/
├── migrations/
│   └── 003_full_text_search.sql         # NEW — SQLite FTS5 virtual table and automatic synchronization triggers
├── src/
│   ├── db/
│   │   ├── commands.rs                  # MODIFY — Add search_notes and reorder_entities commands
│   │   ├── migration.rs                 # MODIFY — Support running 003 migration
│   │   ├── schema.rs                    # MODIFY — Document FTS5 table and trigger definitions
│   │   └── tests.rs                     # MODIFY — Add unit tests for FTS5 queries, triggers, and batch reordering
│   └── lib.rs                           # MODIFY — Register search_notes and reorder_entities commands
```

---

## Data Layer & IPC Contracts

### 1. Database FTS5 Migration (`src-tauri/migrations/003_full_text_search.sql`)

```sql
-- Migration 003: Full-Text Search (FTS5) for Notes with Sync Triggers

-- 1. Create FTS5 Virtual Table
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    id UNINDEXED,
    title,
    content,
    content='notes',
    content_rowid='rowid',
    tokenize='porter unicode61'
);

-- 2. Populate FTS Index with Existing Notes
INSERT INTO notes_fts(rowid, id, title, content)
SELECT rowid, id, title, content FROM notes;

-- 3. Trigger: Keep FTS in sync after INSERT
CREATE TRIGGER IF NOT EXISTS notes_fts_ai AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(rowid, id, title, content)
    VALUES (new.rowid, new.id, new.title, new.content);
END;

-- 4. Trigger: Keep FTS in sync after UPDATE
CREATE TRIGGER IF NOT EXISTS notes_fts_au AFTER UPDATE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, id, title, content)
    VALUES ('delete', old.rowid, old.id, old.title, old.content);
    INSERT INTO notes_fts(rowid, id, title, content)
    VALUES (new.rowid, new.id, new.title, new.content);
END;

-- 5. Trigger: Keep FTS in sync after DELETE
CREATE TRIGGER IF NOT EXISTS notes_fts_ad AFTER DELETE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, id, title, content)
    VALUES ('delete', old.rowid, old.id, old.title, old.content);
END;
```

### 2. TypeScript Models & IPC Interfaces (`lib/api/types.ts`)

```typescript
export interface SearchQuery {
  query: string;
  main_section_id?: string;
  subsection_id?: string;
  limit?: number;
}

export interface SearchResult {
  id: string;
  subsection_id: string;
  subsection_name: string;
  main_section_id: string;
  main_section_name: string;
  main_section_color: string;
  title: string;
  snippet: string;
  updated_at: string;
  rank: number;
}

export type ReorderEntityType = 'main_sections' | 'subsections' | 'notes';

export interface ReorderPayload {
  entity_type: ReorderEntityType;
  ordered_ids: string[];
}
```

### 3. Rust Backend Commands (`src-tauri/src/db/commands.rs`)

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub subsection_id: String,
    pub subsection_name: String,
    pub main_section_id: String,
    pub main_section_name: String,
    pub main_section_color: String,
    pub title: String,
    pub snippet: String,
    pub updated_at: String,
    pub rank: f64,
}

#[tauri::command]
pub fn search_notes(
    state: State<'_, Mutex<Connection>>,
    query: String,
    main_section_id: Option<String>,
    subsection_id: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<SearchResult>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let sanitized_query = sanitize_fts5_query(&query);
    if sanitized_query.trim().is_empty() {
        return Ok(Vec::new());
    }

    let limit_val = limit.unwrap_or(30).clamp(1, 100);

    let sql = "
        SELECT 
            n.id, 
            n.subsection_id, 
            s.name AS subsection_name,
            m.id AS main_section_id,
            m.name AS main_section_name,
            m.color AS main_section_color,
            n.title,
            snippet(notes_fts, 2, '<mark>', '</mark>', '...', 24) AS snippet,
            n.updated_at,
            bm25(notes_fts) AS rank
        FROM notes_fts f
        JOIN notes n ON f.id = n.id
        JOIN subsections s ON n.subsection_id = s.id
        JOIN main_sections m ON s.main_section_id = m.id
        WHERE notes_fts MATCH ?1
          AND (?2 IS NULL OR m.id = ?2)
          AND (?3 IS NULL OR s.id = ?3)
        ORDER BY rank ASC
        LIMIT ?4
    ";

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(
        rusqlite::params![sanitized_query, main_section_id, subsection_id, limit_val],
        |row| {
            Ok(SearchResult {
                id: row.get(0)?,
                subsection_id: row.get(1)?,
                subsection_name: row.get(2)?,
                main_section_id: row.get(3)?,
                main_section_name: row.get(4)?,
                main_section_color: row.get(5)?,
                title: row.get(6)?,
                snippet: row.get(7)?,
                updated_at: row.get(8)?,
                rank: row.get(9)?,
            })
        },
    ).map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for r in rows {
        if let Ok(item) = r {
            results.push(item);
        }
    }
    Ok(results)
}

#[tauri::command]
pub fn reorder_entities(
    state: State<'_, Mutex<Connection>>,
    entity_type: String,
    ordered_ids: Vec<String>,
) -> Result<(), String> {
    let mut conn = state.lock().map_err(|e| e.to_string())?;
    let table = match entity_type.as_str() {
        "main_sections" => "main_sections",
        "subsections" => "subsections",
        "notes" => "notes",
        _ => return Err("Invalid entity_type for reordering".to_string()),
    };

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    {
        let query = format!("UPDATE {} SET sort_order = ?1 WHERE id = ?2", table);
        let mut stmt = tx.prepare(&query).map_err(|e| e.to_string())?;
        for (index, id) in ordered_ids.iter().enumerate() {
            stmt.execute(rusqlite::params![index as i64, id])
                .map_err(|e| e.to_string())?;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

fn sanitize_fts5_query(input: &str) -> String {
    // Strips actual FTS5 operator characters that would cause syntax errors
    // while preserving characters common in developer content:
    //   . (method calls, version strings: v1.0, std.vec)
    //   / (paths, async/await)
    //   # (Rust generics, language tags)
    //   @ (decorators, annotations)
    //   : (namespaces: std::vec, HTTP status codes)
    //   + (operators, increments)
    // Stripped: " * ( ) that have special FTS5 meaning when unquoted
    let cleaned: String = input
        .chars()
        .filter(|c| {
            c.is_alphanumeric()
                || c.is_whitespace()
                || matches!(*c, '_' | '-' | '.' | '/' | '#' | '@' | ':' | '+')
        })
        .collect();
    let tokens: Vec<String> = cleaned
        .split_whitespace()
        .filter(|t| !t.is_empty())
        .map(|tok| format!("\"{}\"*", tok))
        .collect();
    tokens.join(" ")
}
```

---

## Detailed UI & Feature Breakdown

### 1. Global Command Palette (`components/search/CommandPalette.tsx`)
- **Activation:**
  - `Cmd+K` / `Ctrl+K` global keyboard listener registered in root layout.
  - Search trigger icon in `AppSidebar` and `AppHeader`.
- **Search Experience:**
  - Elevated modal window (`max-w-2xl bg-surface-container-low border border-outline-variant shadow-2xl`).
  - 48px input field with placeholder: *"Search notes, subsections, domains, or type a command..."*
  - Debounced execution (150ms) to ensure instant responsiveness without UI lag.
- **Results Presentation (`components/search/SearchResultItem.tsx`):**
  - Grouped sections: **Notes** (with matched snippet previews), **Subsections**, and **Main Sections**.
  - Hierarchical breadcrumbs: `[Main Section (with color dot)] › [Subsection] › [Note Title]`.
  - Snippet rendering with `<mark>` tag styling highlighting exact match locations.
  - Keyboard navigation: `ArrowDown` / `ArrowUp` selects items with active highlight; `Enter` navigates directly to `/editor?id=[noteId]` or `/section?id=[sectionId]`; `Esc` closes palette.
- **Scope Filters (`components/search/SearchScopeFilter.tsx`):**
  - Filter chips: `All Notes`, `Current Domain`, `Current Topic`.

### 2. In-Page Scoped Search & Snippet Highlighting
- **Notes List Search (Page 3):**
  - Integrated into `NoteToolbar.tsx`.
  - Typing in the search input executes `search_notes(query, None, Some(subsection_id))`.
  - Displays match count badge: *"4 notes matching 'closures'"*.
  - Expansive card view renders live FTS snippets with highlighted keywords.
- **Subsections List Search (Page 2):**
  - Filters subsections matching title or child note contents within the selected Main Section.

### 3. Drag-and-Drop Manual Reordering (FR-6)
- **Visual Affordances (`components/common/DragHandle.tsx`):**
  - Monospace 6-dot drag handle icon (`drag_indicator`) visible on cards and list rows on hover.
  - Cursor changes to `grab` / `grabbing`.
  - Active drag card renders with elevated shadow and 2px cobalt outline (`#388bfd`).
  - Drop target renders a crisp horizontal indicator line showing insertion position.
- **Optimistic UI Updates (`lib/hooks/useDragReorder.ts`):**
  - List immediately reflects new order on drag end.
  - Dispatches `reorder_entities` IPC command in the background.
  - Reverts gracefully with an error toast if database persistence fails.
- **Reordering Levels:**
  1. **Main Sections (Page 1):** Reorder knowledge domain cards/rows; persists across sidebar and home grid.
  2. **Subsections (Page 2):** Reorder topics within a Main Section.
  3. **Notes (Page 3):** Reorder notes within a Subsection.

### 4. Keyboard Accessibility & Context Menu Ordering
- **Keyboard Shortcuts:**
  - Select item and press `Alt+ArrowUp` / `Alt+ArrowDown` to shift position up or down without using a mouse.
- **Context Menu Actions:**
  - Card dropdown context menu includes "Move Up" and "Move Down" actions.
  - Disabled at list boundaries (first item cannot move up, last item cannot move down).

---

## Implementation Steps

| # | Task | Dependencies | Output Files |
|---|------|--------------|--------------|
| **1** | **Add FTS5 Migration & Rust Search/Reorder Commands**<br>Create `migrations/003_full_text_search.sql`, implement `search_notes` (with FTS query sanitizer) and `reorder_entities` in `commands.rs`, register in `lib.rs`, and write unit tests in `tests.rs`. | Phase 1 Backend | `src-tauri/migrations/003_full_text_search.sql`<br>`src-tauri/src/db/commands.rs`<br>`src-tauri/src/db/migration.rs`<br>`src-tauri/src/db/tests.rs` |
| **2** | **Create TypeScript Search & Reorder API Clients**<br>Implement `lib/api/search.ts` and `lib/api/reorder.ts`; update interfaces in `lib/api/types.ts`. | Task 1 | `lib/api/search.ts`<br>`lib/api/reorder.ts`<br>`lib/api/types.ts` |
| **3** | **Build HighlightedText & DragHandle UI Primitives**<br>Create `components/search/HighlightedText.tsx`, `components/common/DragHandle.tsx`, and `components/common/KeyboardShortcutBadge.tsx`. | Phase 0 CSS | `components/search/HighlightedText.tsx`<br>`components/common/DragHandle.tsx`<br>`components/common/KeyboardShortcutBadge.tsx` |
| **4** | **Implement Command Palette Hook & Component**<br>Build `lib/hooks/useCommandPalette.ts` and `components/search/CommandPalette.tsx` with search input, result ranking, keyboard navigation (`↑`/`↓`/`Enter`/`Esc`), and scope filters. | Tasks 2, 3 | `lib/hooks/useCommandPalette.ts`<br>`components/search/CommandPalette.tsx`<br>`components/search/SearchResultItem.tsx`<br>`components/search/SearchScopeFilter.tsx` |
| **5** | **Integrate Global Command Palette into App Layout**<br>Wire `CommandPalette` in `app/layout.tsx` with global `Cmd+K` / `Ctrl+K` keydown listener and sidebar search trigger. | Task 4 | `app/layout.tsx`<br>`components/layout/AppHeader.tsx`<br>`components/layout/AppSidebar.tsx` |
| **6** | **Implement Drag-and-Drop Reorder Hook & Wrapper**<br>Create `lib/hooks/useDragReorder.ts` and `components/common/ReorderableList.tsx` supporting pointer drag, optimistic state, and `Alt+Arrow` keyboard reordering. | Task 2, 3 | `lib/hooks/useDragReorder.ts`<br>`components/common/ReorderableList.tsx` |
| **7** | **Integrate Reordering on Main Sections (Page 1)**<br>Add drag handles and reorder handlers to `SectionCard.tsx`, `SectionListRow.tsx`, and `SectionGrid.tsx`. | Task 6 | `components/sections/SectionCard.tsx`<br>`components/sections/SectionListRow.tsx`<br>`components/sections/SectionGrid.tsx` |
| **8** | **Integrate Reordering on Subsections (Page 2)**<br>Add drag handles and reorder handlers to `SubsectionCard.tsx` and `SubsectionList.tsx`. | Task 6 | `components/subsections/SubsectionCard.tsx`<br>`components/subsections/SubsectionList.tsx` |
| **9** | **Integrate Reordering & Full-Text Search on Notes List (Page 3)**<br>Wire FTS search in `NoteToolbar.tsx` and integrate drag reordering in `NoteCard.tsx`, `NoteListRow.tsx`, and `NoteList.tsx`. | Tasks 4, 6 | `components/notes/NoteToolbar.tsx`<br>`components/notes/NoteCard.tsx`<br>`components/notes/NoteListRow.tsx`<br>`components/notes/NoteList.tsx` |
| **10** | **Offline & Build Verification**<br>Run `cargo test`, `pnpm check:offline`, `pnpm lint`, and `pnpm build` to verify search accuracy, reorder persistence, and offline compliance. | All Tasks | — |

---

## Edge Cases & Error Handling

1. **FTS5 Special Character Syntax Errors:**
   - Special characters like `"`, `*`, `(`, `)`, `NOT`, `AND`, `OR` in user search queries are safely sanitized via `sanitize_fts5_query()` before passing to SQLite `MATCH`, preventing FTS syntax crashes.
2. **Search Over Empty or Whitespace-Only Queries:**
   - Immediately returns empty result list without dispatching database query.
3. **Concurrent Reordering Collisions:**
   - Reorder updates run inside an atomic `BEGIN IMMEDIATE` / `COMMIT` SQLite transaction to prevent conflicting `sort_order` assignments.
4. **Reorder Index Gaps / Duplicates:**
   - Reordering normalizes `sort_order` to contiguous `0..N-1` integers on every save, preventing index drift over time.
5. **Keyboard Accessibility for Reordering:**
   - Users without a pointing device can use `Alt+Up` / `Alt+Down` or the context menu "Move Up" / "Move Down" actions to reorder items.
6. **Zero-Network Policy (FR-11):**
   - Search indexing and query evaluation happen 100% locally in SQLite in the Rust process with zero external API calls or telemetry.

---

## Exit Criteria

- [ ] `cargo test` passes for all unit tests including migration 003, FTS5 sync triggers, `search_notes`, and `reorder_entities`.
- [ ] `pnpm check:offline` passes with 0 violations.
- [ ] `pnpm lint` and `pnpm build` compile with zero errors.
- [ ] Pressing `Cmd+K` / `Ctrl+K` opens the global Command Palette from anywhere in the app.
- [ ] Searching across notes returns accurate, ranked results matching title and content with highlighted snippets.
- [ ] Clicking a search result navigates directly to the target Note Editor or Section.
- [ ] Main Sections can be dragged and dropped to reorder on Page 1, persisting across app restarts.
- [ ] Subsections can be dragged and dropped to reorder on Page 2, persisting across app restarts.
- [ ] Notes can be dragged and dropped to reorder on Page 3, persisting across app restarts.
- [ ] `Alt+Up` / `Alt+Down` keyboard reordering works reliably across all lists.
- [ ] FTS5 index remains synchronized after creating, updating, and deleting notes.

---

## Estimated Effort

- **~14-16 files** created or modified
- **~900-1,100 lines** of TypeScript/React code
- **~110-140 lines** of Rust backend code
- **~90 lines** of Rust tests
