import { invoke } from "@tauri-apps/api/core";
import { ReorderEntityType } from "./types";

/**
 * Persists a new manual ordering. `ordered_ids` must contain the ids of the
 * entity collection in their desired final order; the backend rewrites
 * `sort_order` to a contiguous 0..N-1 range inside one atomic transaction.
 */
export async function reorderEntities(
  entityType: ReorderEntityType,
  orderedIds: string[]
): Promise<void> {
  await invoke("reorder_entities", {
    entityType,
    orderedIds,
  });
}
