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

export interface Asset {
  id: string;
  note_id: string;
  file_path: string;
  alt_text: string;
  created_at: string;
}
