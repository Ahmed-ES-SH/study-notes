import { invoke } from "@tauri-apps/api/core";
import { MainSection, CascadeCounts, Subsection } from "./types";

export async function listMainSections(): Promise<MainSection[]> {
  return await invoke<MainSection[]>("list_main_sections");
}

export async function createMainSection(name: string, color: string): Promise<MainSection> {
  return await invoke<MainSection>("create_main_section", { name, color });
}

export async function updateMainSection(
  id: string,
  name?: string,
  color?: string
): Promise<MainSection> {
  return await invoke<MainSection>("update_main_section", { id, name, color });
}

export async function deleteMainSection(id: string): Promise<void> {
  await invoke("delete_main_section", { id });
}

export async function getMainSectionCascadeInfo(id: string): Promise<CascadeCounts> {
  return await invoke<CascadeCounts>("get_main_section_cascade_info", { id });
}

export async function listSubsections(mainSectionId: string): Promise<Subsection[]> {
  return await invoke<Subsection[]>("list_subsections", { mainSectionId });
}
