-- Migration 002: Performance Indexes for Sub-millisecond Hierarchical Lookups
CREATE INDEX IF NOT EXISTS idx_subsections_main_section ON subsections(main_section_id);
CREATE INDEX IF NOT EXISTS idx_subsections_sort ON subsections(main_section_id, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_notes_subsection ON notes(subsection_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(subsection_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_sort ON notes(subsection_id, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_assets_note ON assets(note_id);
