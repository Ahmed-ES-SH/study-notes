import { invoke } from "@tauri-apps/api/core";
import { SearchQuery, SearchResult } from "./types";

export async function searchNotes(
  query: string,
  options: Omit<SearchQuery, "query"> = {}
): Promise<SearchResult[]> {
  return await invoke<SearchResult[]>("search_notes", {
    query,
    mainSectionId: options.main_section_id ?? null,
    subsectionId: options.subsection_id ?? null,
    limit: options.limit ?? 30,
  });
}
