import { invoke } from "@tauri-apps/api/core";
import { Asset } from "./types";

export async function fetchNoteAssets(noteId: string): Promise<Asset[]> {
  return await invoke<Asset[]>("list_assets", { noteId });
}

export async function attachAsset(
  noteId: string,
  fileName: string,
  fileBytes: number[],
  altText: string
): Promise<Asset> {
  return await invoke<Asset>("attach_note_asset", {
    noteId,
    fileName,
    altText,
    fileBytes,
  });
}

export async function removeAsset(id: string): Promise<void> {
  await invoke("delete_asset", { id });
}

/**
 * Reads a managed asset (`assets/<uuid>.<ext>`) from the local app storage
 * and returns it as an inline `data:` URL so the webview can render it
 * without any network access.
 */
export async function fetchAssetDataUrl(filePath: string): Promise<string> {
  return await invoke<string>("read_asset_data_url", { filePath });
}
