import { invoke } from "@tauri-apps/api/core";
import { Note, NoteCascadeInfo, NoteContextHierarchy } from "./types";

export async function fetchNote(id: string): Promise<Note> {
  return await invoke<Note>("get_note", { id });
}

export async function fetchNoteContext(id: string): Promise<NoteContextHierarchy> {
  return await invoke<NoteContextHierarchy>("get_note_context", { id });
}

export async function fetchNotes(subsectionId: string): Promise<Note[]> {
  return await invoke<Note[]>("list_notes", { subsectionId });
}

export async function createNote(subsectionId: string, title: string): Promise<Note> {
  return await invoke<Note>("create_note", { subsectionId, title });
}

export async function updateNote(id: string, title?: string, content?: string): Promise<Note> {
  return await invoke<Note>("update_note", { id, title, content });
}

export async function deleteNote(id: string): Promise<void> {
  await invoke("delete_note", { id });
}

export async function getNoteCascadeInfo(id: string): Promise<NoteCascadeInfo> {
  return await invoke<NoteCascadeInfo>("get_note_cascade_info", { id });
}
