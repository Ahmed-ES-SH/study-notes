import { invoke } from "@tauri-apps/api/core";
import {
  Subsection,
  SubsectionCascadeInfo,
  NotePreview,
} from "./types";

export async function fetchSubsections(mainSectionId: string): Promise<Subsection[]> {
  return await invoke<Subsection[]>("list_subsections", { mainSectionId });
}

export async function createSubsection(
  mainSectionId: string,
  name: string
): Promise<Subsection> {
  return await invoke<Subsection>("create_subsection", { mainSectionId, name });
}

export async function updateSubsection(id: string, name?: string): Promise<Subsection> {
  return await invoke<Subsection>("update_subsection", { id, name });
}

export async function deleteSubsection(id: string): Promise<void> {
  await invoke("delete_subsection", { id });
}

export async function getSubsectionCascadeInfo(
  id: string
): Promise<SubsectionCascadeInfo> {
  return await invoke<SubsectionCascadeInfo>("get_subsection_cascade_info", { id });
}

export async function fetchNotesForSubsection(
  subsectionId: string
): Promise<NotePreview[]> {
  return await invoke<NotePreview[]>("list_notes", { subsectionId });
}
