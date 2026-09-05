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

export interface Asset {
  id: string;
  note_id: string;
  file_path: string;
  alt_text: string;
  created_at: string;
}

export interface NoteContextHierarchy {
  note: Note;
  subsection_id: string;
  subsection_name: string;
  main_section_id: string;
  main_section_name: string;
  main_section_color: string;
}

export interface TableOfContentsItem {
  id: string;
  text: string;
  /** 1 = H1, 2 = H2, 3 = H3 */
  level: number;
  line_number: number;
}

export type EditorMode = "edit" | "split" | "preview" | "zen";

export type SaveStatus = "saved" | "saving";

// ── Phase 6: theming, diagnostics & cascade delete UX ──────────────

export type ThemeMode = "system" | "dark" | "light";

/** The palette actually applied to the document root. */
export type ResolvedTheme = "dark" | "light";

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

export interface CascadeDeleteTarget {
  type: "main_section" | "subsection" | "note";
  id: string;
  name: string;
  subsection_count?: number;
  note_count?: number;
  asset_count?: number;
}

// ── Phase 7: full-text search & manual reordering ───────────────────

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
  /** Content excerpt with `<mark>` wrappers around matched terms. */
  snippet: string;
  updated_at: string;
  /** BM25 score — more negative means a stronger match. */
  rank: number;
}

export type ReorderEntityType = "main_sections" | "subsections" | "notes";

export interface ReorderPayload {
  entity_type: ReorderEntityType;
  ordered_ids: string[];
}
