# Phase 2 — Page 1: Main Sections (Home)

**Goal:** Build the fully interactive, offline entry point (Page 1) of the Study Notes desktop app per PRD §3 Page 1, `DESIGN.md` (Terminal Noir design system), and `screens/all_sections_devnotes/`.

---

## Scope Summary

Implement the Home screen (Page 1) featuring the Main Sections directory in Next.js (App Router with static export), wired directly to the Tauri Rust SQLite backend. The user can view, search, toggle grid/list layout, create, edit, recolor, delete (with cascade impact preview), and navigate into any Main Section, with state and data persisting across application restarts.

---

## Architecture & Design Decisions Confirmed

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Rendering & Router** | Next.js Client Components with App Router | Required for Tauri static export (`output: 'export'`) and real-time IPC invocations. |
| **Backend Communication** | `@tauri-apps/api/core` `invoke` wrapped in typed API module | Keeps Tauri IPC calls isolated, typed, and easy to mock for testing. |
| **Icons** | Embedded Offline SVG Icon Components | Zero network dependency; strictly enforces FR-11 ("No Network Calls") without CDN font links. |
| **Styling** | Tailwind CSS v4 using Terminal Noir tokens (`DESIGN.md`, `globals.css`) | Consistent IDE-like dark aesthetic (`#0b141c` base, `#141c24` cards, crisp `#30363d` 1px borders). |
| **Color Picker** | Curated 12-palette preset swatches + custom Hex input | Matches technical syntax theme accents (Cobalt, Emerald, Amber, Violet, Cyan, Rose, Slate, etc.). |
| **Cascade Stats Query** | Rust command `get_main_section_cascade_info` | Fast, atomic computation of child subsections, notes, and assets for delete warning dialogs and card metadata. |
| **Navigation Target** | Scoped route `/section?id=[id]` | Prepared for Phase 3 (Page 2: Subsections). |

---

## File Structure (New & Modified)

```
app/
├── globals.css                          # EXISTING — theme tokens & typography
├── layout.tsx                           # MODIFY — Shell layout, metadata, font setup
├── page.tsx                             # MODIFY — Page 1 (Main Sections directory view)
├── section/
│   └── page.tsx                         # NEW — Route placeholder for Page 2 navigation
components/
├── common/
│   ├── Button.tsx                       # NEW — Primary, ghost, danger button variants
│   ├── Dialog.tsx                       # NEW — Accessible modal overlay with backdrop blur
│   ├── Input.tsx                        # NEW — Themed input with icon & error states
│   ├── Icons.tsx                        # NEW — Reusable, offline SVG icons matching screens
│   └── Badge.tsx                        # NEW — Syntax / status badges and tag chips
├── layout/
│   ├── AppSidebar.tsx                   # NEW — Collapsible rail navigation & sections list
│   └── AppHeader.tsx                    # NEW — Top bar with breadcrumb & quick actions
├── sections/
│   ├── SectionCard.tsx                  # NEW — Grid card item (color, stats, preview tags)
│   ├── SectionListRow.tsx               # NEW — Compact list row alternative view
│   ├── SectionGrid.tsx                  # NEW — Responsive grid / list container
│   ├── SectionFilterBar.tsx             # NEW — Search input, layout toggle, sort selector
│   ├── CreateSectionModal.tsx           # NEW — Modal form with name & color palette picker
│   ├── EditSectionModal.tsx             # NEW — Rename & recolor modal
│   ├── DeleteSectionDialog.tsx          # NEW — Confirmation modal with cascade counts
│   └── ColorPicker.tsx                  # NEW — Preset swatches + hex input
lib/
├── api/
│   ├── sections.ts                      # NEW — Typed Tauri invoke wrappers for Main Sections
│   └── types.ts                         # NEW — TypeScript interfaces matching Rust models
├── hooks/
│   ├── useMainSections.ts               # NEW — Custom hook for fetching and mutating sections
│   └── useDebounce.ts                   # NEW — Input debouncing hook for search
src-tauri/
├── src/
│   ├── db/
│   │   ├── commands.rs                  # MODIFY — Add get_main_section_cascade_info command
│   │   └── tests.rs                     # MODIFY — Add unit tests for cascade info query
│   └── lib.rs                           # MODIFY — Register any new Tauri commands
```

---

## Data Layer & IPC Contracts

### 1. TypeScript Models (`lib/api/types.ts`)

```typescript
export interface MainSection {
  id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
  sort_order: number;
}

export interface CascadeCounts {
  subsection_count: number;
  note_count: number;
  asset_count: number;
}
```

### 2. Tauri Commands (`src-tauri/src/db/commands.rs`)

Existing commands utilized:
- `list_main_sections()` -> `Vec<MainSection>`
- `create_main_section(name: String, color: String)` -> `MainSection`
- `update_main_section(id: String, name: Option<String>, color: Option<String>)` -> `MainSection`
- `delete_main_section(id: String)` -> `()`

New Rust command:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MainSectionCascadeInfo {
    pub subsection_count: i64,
    pub note_count: i64,
    pub asset_count: i64,
}

#[tauri::command]
pub fn get_main_section_cascade_info(
    state: State<'_, Mutex<Connection>>,
    id: String,
) -> Result<MainSectionCascadeInfo, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    
    let sub_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM subsections WHERE main_section_id = ?1",
        rusqlite::params![id],
        |r| r.get(0),
    ).unwrap_or(0);

    let note_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM notes WHERE subsection_id IN (
            SELECT id FROM subsections WHERE main_section_id = ?1
        )",
        rusqlite::params![id],
        |r| r.get(0),
    ).unwrap_or(0);

    let asset_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM assets WHERE note_id IN (
            SELECT id FROM notes WHERE subsection_id IN (
                SELECT id FROM subsections WHERE main_section_id = ?1
            )
        )",
        rusqlite::params![id],
        |r| r.get(0),
    ).unwrap_or(0);

    Ok(MainSectionCascadeInfo {
        subsection_count: sub_count,
        note_count,
        asset_count,
    })
}
```

### 3. Frontend API Client (`lib/api/sections.ts`)

```typescript
import { invoke } from "@tauri-apps/api/core";
import { MainSection, CascadeCounts } from "./types";

export async function fetchMainSections(): Promise<MainSection[]> {
  return await invoke<MainSection[]>("list_main_sections");
}

export async function createMainSection(name: string, color: string): Promise<MainSection> {
  return await invoke<MainSection>("create_main_section", { name, color });
}

export async function updateMainSection(id: string, name?: string, color?: string): Promise<MainSection> {
  return await invoke<MainSection>("update_main_section", { id, name, color });
}

export async function deleteMainSection(id: string): Promise<void> {
  await invoke("delete_main_section", { id });
}

export async function getMainSectionCascadeInfo(id: string): Promise<CascadeCounts> {
  return await invoke<CascadeCounts>("get_main_section_cascade_info", { id });
}
```

---

## Detailed UI & Feature Breakdown

### 1. App Shell & Layout (`components/layout/`)
- **AppSidebar (`components/layout/AppSidebar.tsx`)**:
  - Logo branding: "DevNotes" + version badge (`v1.0`).
  - Quick Search shortcut trigger (`Cmd+K` / `Ctrl+K`) — placeholder active; wired in Phase 7.
  - Navigation items: "Sections Directory" (Active state), "Global Search" (placeholder for Phase 7).
  - Dynamic Sections List: Render live list of Main Sections with color dots and collapse/expand indicators.
  - Bottom storage indicator: Local SQLite status label.
- **AppHeader (`components/layout/AppHeader.tsx`)**:
  - Breadcrumbs: `DevNotes Core / Sections Directory / Overview`.
  - Offline status indicator badge (`Synced` / `Local SQLite`).
  - Action buttons for theme/study mode toggle and command palette.

### 2. Main Sections Dashboard (`app/page.tsx`)
- **Header Strip**:
  - Category label: `DEVNOTES CORE / SECTIONS DIRECTORY`.
  - Main title: "Knowledge Domains & Sections".
  - Subtitle: "Explore your structured developer study streams, inspect nested technical subsections, and monitor mastery retention across engineering verticals."
  - Action button: `+ New Section` (opens creation modal).
- **Filter & View Controller Bar (`components/sections/SectionFilterBar.tsx`)**:
  - Live search input: Instant client-side filtering matching section names.
  - Layout switchers: **Grid View** (`grid-cols-1 md:grid-cols-2`) vs **Compact List View**.
  - Sort selector dropdown: By Alphabetical (A-Z), Last Updated, or Creation Date.
- **Section Grid / List (`components/sections/SectionGrid.tsx`)**:
  - Renders `SectionCard` in grid mode or `SectionListRow` in list mode.
  - Smooth hover transitions and active highlight styles matching `screens/all_sections_devnotes/code.html`.

### 3. Section Card (`components/sections/SectionCard.tsx`)
- **Visuals & Header**:
  - Domain icon container with themed color tint.
  - Color badge + section title.
  - Last updated relative time indicator (e.g., "2d ago", "Just now").
  - Context menu / action triggers (Edit section, Delete section).
- **Subsections Preview & Stats**:
  - Subsections count badge.
  - Informative subtitle / description snippet.
  - Notes count indicator.
- **Card Footer**:
  - Quick `+ Subsection` button.
  - `Open Stream →` button triggering route navigation to Page 2 (`/section?id=[id]`).

### 4. Create Section Modal (`components/sections/CreateSectionModal.tsx`)
- Triggered by `+ New Section` button in header and empty state.
- **Form Controls**:
  - **Name Input**: Text input with autofocus, validation (required, 1-60 characters, trimmed).
  - **Color Picker (`components/sections/ColorPicker.tsx`)**:
    - Preset Palette: 12 curated terminal syntax colors (Cobalt `#388bfd`, Emerald `#3fb950`, Amber `#d29922`, Purple `#a371f7`, Cyan `#22d3ee`, Rose `#f85149`, Indigo `#6366f1`, Sky `#0ea5e9`, Lime `#84cc16`, Pink `#ec4899`, Orange `#f97316`, Slate `#94a3b8`).
    - Custom Hex Input with instant swatch preview.
- **Actions**: "Cancel" (Esc / button) and "Create Section" (Enter / primary button).
- Optimistic update or immediate re-fetch to update state without page reload.

### 5. Edit Section Modal (`components/sections/EditSectionModal.tsx`)
- Allows renaming existing section and picking a new color.
- Pre-filled with current name and color swatch.
- Persists changes via `update_main_section` Tauri command.

### 6. Cascade Delete Confirmation Dialog (`components/sections/DeleteSectionDialog.tsx`)
- Critical safety guard implementing PRD §2.2 & FR-5.
- Displays danger alert banner with explicit cascade counts:
  - *"Are you sure you want to delete **[Section Name]**?"*
  - *"This will permanently remove **N subsections**, **M notes**, and all attached media files."*
- Fetches real-time counts using `get_main_section_cascade_info(id)`.
- Danger-styled "Delete Section and All Contents" button + "Cancel" button.

### 7. Empty State
- **No Sections Exist**:
  - Terminal-themed graphic with text: *"No sections yet — create your first one."*
  - Prominent "Create First Section" call-to-action button.
- **No Search Results**:
  - Icon: `manage_search`.
  - *"No knowledge domain found matching '[query]'"*.
  - "Clear Filter" button to reset search input.

### 8. Navigation Routing
- Clicking a section card navigates to `/section?id=[id]`.
- Creates a placeholder page `app/section/page.tsx` for Page 2 with breadcrumbs back to Page 1 (`/`), validating the navigation handoff ahead of Phase 3.

---

## Implementation Steps

| # | Task | Dependencies | Output Files |
|---|------|--------------|--------------|
| **1** | **Add Rust Cascade Stats Command**<br>Implement `get_main_section_cascade_info` in `commands.rs`, register in `lib.rs`, and write unit test in `tests.rs`. | Phase 1 Backend | `src-tauri/src/db/commands.rs`<br>`src-tauri/src/lib.rs`<br>`src-tauri/src/db/tests.rs` |
| **2** | **Create TypeScript API & Models**<br>Define `types.ts` and implement typed invoke functions in `lib/api/sections.ts`. | Task 1 | `lib/api/types.ts`<br>`lib/api/sections.ts` |
| **3** | **Build Design System UI Primitives**<br>Implement Button, Input, Modal/Dialog, Badges, and Offline SVG Icons. | Phase 0 CSS | `components/common/Button.tsx`<br>`components/common/Dialog.tsx`<br>`components/common/Input.tsx`<br>`components/common/Icons.tsx`<br>`components/common/Badge.tsx` |
| **4** | **Implement Color Picker Component**<br>Build preset palette swatch selector + hex code validator. | Task 3 | `components/sections/ColorPicker.tsx` |
| **5** | **Implement Modals & Dialogs**<br>Create `CreateSectionModal`, `EditSectionModal`, and `DeleteSectionDialog` with cascade count warning. | Task 2, 3, 4 | `components/sections/CreateSectionModal.tsx`<br>`components/sections/EditSectionModal.tsx`<br>`components/sections/DeleteSectionDialog.tsx` |
| **6** | **Implement Section Cards & Filter Bar**<br>Build `SectionCard`, `SectionListRow`, `SectionFilterBar`, and `SectionGrid`. | Task 3, 5 | `components/sections/SectionCard.tsx`<br>`components/sections/SectionListRow.tsx`<br>`components/sections/SectionFilterBar.tsx`<br>`components/sections/SectionGrid.tsx` |
| **7** | **Assemble App Sidebar & Header Layout**<br>Build `AppSidebar` and `AppHeader` matching `all_sections_devnotes/code.html`. | Task 3 | `components/layout/AppSidebar.tsx`<br>`components/layout/AppHeader.tsx` |
| **8** | **Assemble Home Page (Page 1)**<br>Wire `app/page.tsx` with live data fetching, CRUD state hooks, search filtering, and view mode switching. | Tasks 1–7 | `app/page.tsx`<br>`lib/hooks/useMainSections.ts` |
| **9** | **Add Page 2 Placeholder Route**<br>Implement `/section/page.tsx` with breadcrumbs to receive route transition from Page 1. | Task 8 | `app/section/page.tsx` |
| **10** | **Offline & Build Verification**<br>Run `cargo test`, `pnpm check:offline`, `pnpm lint`, and `pnpm build` to verify clean build. | All Tasks | — |

---

## Edge Cases & Error Handling

1. **Empty / Whitespace Section Names:** Frontend form prevents submission if trimmed name is empty; displays inline error indicator.
2. **Special Characters in Section Names:** Sanitized and rendered cleanly without escaping glitches.
3. **Color Format Validation:** Supports hex codes (`#RRGGBB` or `#RGB`), falling back to default theme accent (`#6366f1` / `#388bfd`) if invalid.
4. **IPC / Backend Failure:** Graceful toast / error banner if SQLite command fails, preventing app freeze or silent failures.
5. **Fast Delete / Race Conditions:** Delete dialog disables submit button and displays loading spinner while cascade delete transaction executes.
6. **Zero Subsections / Notes Cascade:** Delete dialog handles sections with 0 children gracefully with clear copy ("This section has no subsections or notes").
7. **Offline Verification:** All icons and styles are 100% bundled locally; no external font/icon network requests.

---

## Exit Criteria

- [ ] `cargo test` passes for all unit tests including new cascade stats query.
- [ ] `pnpm check:offline` passes with 0 violations.
- [ ] `pnpm lint` and `pnpm build` compile with zero errors.
- [ ] User can view list/grid of Main Sections with color swatches and metadata.
- [ ] User can create a new Main Section with custom name and color palette picker.
- [ ] User can edit (rename and recolor) an existing Main Section.
- [ ] User can delete a Main Section after reviewing cascade delete confirmation showing exact child counts.
- [ ] Client-side search filters sections in real time.
- [ ] View toggle switches smoothly between Grid and Compact List views.
- [ ] Clicking a section routes to Page 2 (`/section?id=[id]`) with back-navigation.
- [ ] Data persists accurately after restarting Tauri / refreshing the application.

---

## Estimated Effort

- **~14-16 files** created or modified
- **~800-1,100 lines** of TypeScript/React code
- **~60-80 lines** of Rust backend code
- **~80 lines** of Rust tests
