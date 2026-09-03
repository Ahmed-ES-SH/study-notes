# Phase 3 — Page 2: Subsections

**Goal:** Build the fully interactive, offline Subsection management screen (Page 2) of the Study Notes desktop app per PRD §3 Page 2, `DESIGN.md` (Terminal Noir design system), and `screens/javascript_subsections_devnotes/`.

---

## Scope Summary

Implement the Subsections view (Page 2) in Next.js (App Router with static export), strictly scoped to a selected parent `MainSection`. The user can view subsections in detailed card mode (with child note previews) or compact mode, search/filter subsections in real time, create new subsections, rename existing subsections, delete subsections with child note cascade confirmations, and navigate into Page 3 (Notes list), with full SQLite persistence.

---

## Architecture & Design Decisions Confirmed

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Routing Strategy** | Next.js dynamic query route `/section?id=[mainSectionId]` | Fully compatible with Next.js static export (`output: 'export'`) in Tauri; supports client-side URL parameters and direct browser back/forward history. |
| **Parent Section Scope** | Scoped fetch by `main_section_id` | Enforces hierarchical integrity; guarantees subsections belong strictly to their parent section. |
| **Child Note Previews** | Lightweight preview cards per subsection | Matches `screens/javascript_subsections_devnotes/code.html` showing the latest 2–3 notes under each subsection. |
| **View Mode Switching** | Detailed Card View vs Compact View | Detailed view shows full note preview strips; compact view collapses them for rapid scanning. |
| **Cascade Delete Safety** | Rust command `get_subsection_cascade_info` | Queries child notes and assets count in real time before triggering `ON DELETE CASCADE`. |
| **Section Not Found Handling** | Graceful fallback error view | If `id` is invalid or was deleted, shows a themed error state with a "Back to Sections Directory" action. |
| **Styling & Tokens** | Terminal Noir tokens (`globals.css`) | `#0b141c` canvas, `#141c24` cards, `#21262d` note preview chips, syntax-derived theme accents. |

---

## File Structure (New & Modified)

```
app/
├── section/
│   └── page.tsx                         # MODIFY — Page 2: Subsections directory scoped to sectionId
├── subsection/
│   └── page.tsx                         # NEW — Route placeholder for Page 3 navigation (?id=[subId])
components/
├── subsections/
│   ├── SubsectionHero.tsx               # NEW — Top parent section hero banner with color, badges, meta actions
│   ├── SubsectionToolbar.tsx            # NEW — "New Subsection" button, filter input, view toggles
│   ├── SubsectionCard.tsx               # NEW — Detailed card with note preview strip, tags, and action buttons
│   ├── SubsectionList.tsx               # NEW — Container managing card/compact views, search filtering, empty states
│   ├── CreateSubsectionModal.tsx        # NEW — Modal form to create a new subsection in parent section
│   ├── EditSubsectionModal.tsx          # NEW — Rename subsection modal
│   └── DeleteSubsectionDialog.tsx       # NEW — Cascade delete confirmation modal with note counts
lib/
├── api/
│   ├── subsections.ts                   # NEW — Typed Tauri invoke wrappers for Subsections & Cascade Info
│   └── types.ts                         # MODIFY — Add SubsectionCascadeInfo & SubsectionWithNotes interfaces
├── hooks/
│   └── useSubsections.ts                # NEW — Custom hook managing subsections fetch, mutations, and search
src-tauri/
├── src/
│   ├── db/
│   │   ├── commands.rs                  # MODIFY — Add get_subsection_cascade_info command
│   │   └── tests.rs                     # MODIFY — Add unit tests for subsection cascade info query
│   └── lib.rs                           # MODIFY — Register get_subsection_cascade_info command
```

---

## Data Layer & IPC Contracts

### 1. TypeScript Models (`lib/api/types.ts`)

```typescript
export interface Subsection {
  id: string;
  main_section_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  sort_order: number;
}

export interface SubsectionCascadeInfo {
  note_count: number;
  asset_count: number;
}

export interface NotePreview {
  id: string;
  subsection_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface SubsectionWithDetails extends Subsection {
  notes: NotePreview[];
}
```

### 2. Tauri Commands (`src-tauri/src/db/commands.rs`)

Existing commands utilized:
- `list_subsections(main_section_id: String) -> Result<Vec<Subsection>, String>`
- `create_subsection(main_section_id: String, name: String) -> Result<Subsection, String>`
- `update_subsection(id: String, name: Option<String>) -> Result<Subsection, String>`
- `delete_subsection(id: String) -> Result<(), String>`
- `list_notes(subsection_id: String) -> Result<Vec<Note>, String>`

New Rust helper command:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubsectionCascadeInfo {
    pub note_count: i64,
    pub asset_count: i64,
}

#[tauri::command]
pub fn get_subsection_cascade_info(
    state: State<'_, Mutex<Connection>>,
    id: String,
) -> Result<SubsectionCascadeInfo, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;

    let note_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM notes WHERE subsection_id = ?1",
        rusqlite::params![id],
        |r| r.get(0),
    ).unwrap_or(0);

    let asset_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM assets WHERE note_id IN (
            SELECT id FROM notes WHERE subsection_id = ?1
        )",
        rusqlite::params![id],
        |r| r.get(0),
    ).unwrap_or(0);

    Ok(SubsectionCascadeInfo {
        note_count,
        asset_count,
    })
}
```

### 3. Frontend API Client (`lib/api/subsections.ts`)

```typescript
import { invoke } from "@tauri-apps/api/core";
import { Subsection, SubsectionCascadeInfo, Note } from "./types";

export async function fetchSubsections(mainSectionId: string): Promise<Subsection[]> {
  return await invoke<Subsection[]>("list_subsections", { mainSectionId });
}

export async function createSubsection(mainSectionId: string, name: string): Promise<Subsection> {
  return await invoke<Subsection>("create_subsection", { mainSectionId, name });
}

export async function updateSubsection(id: string, name?: string): Promise<Subsection> {
  return await invoke<Subsection>("update_subsection", { id, name });
}

export async function deleteSubsection(id: string): Promise<void> {
  await invoke("delete_subsection", { id });
}

export async function getSubsectionCascadeInfo(id: string): Promise<SubsectionCascadeInfo> {
  return await invoke<SubsectionCascadeInfo>("get_subsection_cascade_info", { id });
}

export async function fetchNotesForSubsection(subsectionId: string): Promise<Note[]> {
  return await invoke<Note[]>("list_notes", { subsectionId });
}
```

---

## Detailed UI & Feature Breakdown

### 1. Breadcrumbs & Parent Section Hero (`components/subsections/SubsectionHero.tsx`)
- **Breadcrumb trail**:
  - `Main Sections` (clickable link back to `/`) `>` `[Parent Section Name]`.
- **Parent Section Banner**:
  - Themed background with subtle ambient glow (`bg-primary/5`).
  - Section abbreviation badge (e.g. `JS`, `TS`, `DB`) with active color dot.
  - Section title in `headline-lg` and domain subtitle.
  - Quick metadata pills: Subsections count, total notes count under section.
  - Action trigger: `Edit Meta` button to quickly rename or recolor the parent section without leaving Page 2.

### 2. Action Toolbar & Filter Controls (`components/subsections/SubsectionToolbar.tsx`)
- **Action Buttons**:
  - `+ New Subsection` (Primary button, opens creation modal).
- **Search & View Controls**:
  - Live filter input (`Filter subsections...`) with clear button.
  - View layout toggles:
    - **Detailed Cards (`view_agenda`)**: Shows cards with note preview strips.
    - **Compact View (`table_rows`)**: Hides preview strips for high-density scanning.

### 3. Subsection Card (`components/subsections/SubsectionCard.tsx`)
- **Card Header**:
  - Section color indicator dot + Subsection title (`headline-md`).
  - Active status badges (e.g., `N Notes`, `Updated X ago`).
- **Child Note Preview Strip**:
  - Responsive 2-column or 3-column grid of preview tiles for child notes.
  - Preview tile displays note title, snippet preview, and tag indicator.
  - Clicking a note preview tile navigates directly to Page 4 (Note Editor) or Page 3 (Notes List).
  - If no notes exist in the subsection: clean empty prompt ("No notes yet in this subsection").
- **Card Action Bar**:
  - `Browse N Notes →` button: navigates to Page 3 (`/subsection?id=[subsectionId]`).
  - `+` Add Note button: triggers quick note creation in this subsection.
  - `•••` Context Menu: Rename subsection, Delete subsection.

### 4. Create & Edit Subsection Modals
- **CreateSubsectionModal (`components/subsections/CreateSubsectionModal.tsx`)**:
  - Displays parent section name badge.
  - Name input field with auto-focus, validation (required, 1–60 chars, trimmed).
  - "Cancel" and "Create Subsection" buttons (supports Enter key submission).
- **EditSubsectionModal (`components/subsections/EditSubsectionModal.tsx`)**:
  - Rename existing subsection title.
  - Pre-filled with existing name.
  - Persists changes via `update_subsection`.

### 5. Cascade Delete Confirmation Dialog (`components/subsections/DeleteSubsectionDialog.tsx`)
- Critical safety guard implementing PRD §2.2 & FR-5.
- Displays danger warning dialog:
  - *"Are you sure you want to delete subsection **[Subsection Name]**?"*
  - *"This will permanently delete **N notes** and all attached media files."*
- Dynamic note count queried via `get_subsection_cascade_info(id)`.
- Danger-styled "Delete Subsection and Notes" button + "Cancel" button.

### 6. Empty & Error States
- **Section Not Found Error**: If `?id=` parameter is invalid or missing, displays a themed container: *"Main Section not found"* with a button to return to the Sections Directory (`/`).
- **No Subsections in Section**: *"No subsections yet — create your first one to organize your notes."* with an instant creation button inside the empty state.
- **No Search Matches**: *"No subsections match your filter"* with a button to reset search.

---

## Implementation Steps

| # | Task | Dependencies | Output Files |
|---|------|--------------|--------------|
| **1** | **Add Rust Subsection Cascade Info Command**<br>Implement `get_subsection_cascade_info` in `commands.rs`, register in `lib.rs`, and write unit tests in `tests.rs`. | Phase 1 Backend | `src-tauri/src/db/commands.rs`<br>`src-tauri/src/lib.rs`<br>`src-tauri/src/db/tests.rs` |
| **2** | **Create TypeScript Subsections API Client**<br>Implement typed invoke wrappers for subsections in `lib/api/subsections.ts` and add types to `lib/api/types.ts`. | Task 1 | `lib/api/subsections.ts`<br>`lib/api/types.ts` |
| **3** | **Implement Subsections Data Hook**<br>Build `useSubsections.ts` hook for fetching subsections, note previews, and mutations scoped to `mainSectionId`. | Task 2 | `lib/hooks/useSubsections.ts` |
| **4** | **Build Parent Section Hero & Breadcrumbs**<br>Create `SubsectionHero.tsx` with section color swatch, badges, stats, and "Edit Meta" trigger. | Phase 2 Primitives | `components/subsections/SubsectionHero.tsx` |
| **5** | **Build Subsections Toolbar & Filter Controls**<br>Create `SubsectionToolbar.tsx` with `+ New Subsection` button, search input, and card/compact layout switchers. | Phase 2 Primitives | `components/subsections/SubsectionToolbar.tsx` |
| **6** | **Build Subsection Card & Note Preview Strip**<br>Create `SubsectionCard.tsx` rendering subsection header, note preview tiles, and navigation actions. | Task 3, 5 | `components/subsections/SubsectionCard.tsx` |
| **7** | **Implement Subsections Modals & Cascade Dialog**<br>Create `CreateSubsectionModal`, `EditSubsectionModal`, and `DeleteSubsectionDialog` with real-time note counts. | Task 2, 4 | `components/subsections/CreateSubsectionModal.tsx`<br>`components/subsections/EditSubsectionModal.tsx`<br>`components/subsections/DeleteSubsectionDialog.tsx` |
| **8** | **Assemble Page 2 View (`app/section/page.tsx`)**<br>Wire `SubsectionHero`, `SubsectionToolbar`, `SubsectionList`, and modals with query param parsing and error boundaries. | Tasks 1–7 | `app/section/page.tsx` |
| **9** | **Add Page 3 Placeholder Route (`app/subsection/page.tsx`)**<br>Create placeholder for Page 3 (Notes list) with breadcrumbs back to Page 2. | Task 8 | `app/subsection/page.tsx` |
| **10** | **Offline & Build Verification**<br>Run `cargo test`, `pnpm check:offline`, `pnpm lint`, and `pnpm build` to verify clean build. | All Tasks | — |

---

## Edge Cases & Error Handling

1. **Invalid or Deleted Parent `main_section_id`:**
   - Gracefully displays a "Main Section Not Found" state with a "Back to Sections Directory" button instead of crashing.
2. **Empty Subsections (0 child notes):**
   - Renders a clean "No notes yet" preview container with an inline `+ Add Note` button.
3. **Cascade Delete Confirmation Accuracy:**
   - Before executing `delete_subsection`, queries `get_subsection_cascade_info` to ensure the modal shows the exact count of notes and assets that will be removed.
4. **Name Validation:**
   - Subsection names are trimmed, required, and constrained to 1–60 characters. Submitting empty or whitespace-only names is blocked.
5. **Back Navigation & History:**
   - Breadcrumb link and browser back button cleanly return to Page 1 (`/`) without losing section state.
6. **Zero Network Calls (FR-11):**
   - All icons, fonts, and styles are 100% locally bundled.

---

## Exit Criteria

- [ ] `cargo test` passes for all unit tests including subsection cascade query tests.
- [ ] `pnpm check:offline` reports 0 outbound network violations.
- [ ] `pnpm lint` and `pnpm build` pass with zero errors.
- [ ] Page 2 displays the parent section hero banner with correct title, color swatch, and breadcrumbs.
- [ ] Subsections for the current parent section are listed with accurate note preview tiles.
- [ ] User can switch between Detailed Card View and Compact View.
- [ ] Real-time search filters subsections by title.
- [ ] User can create a new subsection via toolbar button or bottom quick banner.
- [ ] User can rename an existing subsection.
- [ ] User can delete a subsection after confirming the cascade delete dialog showing child note counts.
- [ ] Clicking a subsection navigates to Page 3 (`/subsection?id=[subsectionId]`).
- [ ] Invalid section IDs render a friendly error state with back-navigation.
- [ ] All data operations persist across application restarts.

---

## Estimated Effort

- **~11-13 files** created or modified
- **~700-900 lines** of TypeScript/React code
- **~50-70 lines** of Rust backend code
- **~60 lines** of Rust tests
