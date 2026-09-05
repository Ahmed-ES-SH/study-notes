"use client";

import { useCallback, useMemo, useState } from "react";
import type { DragEvent, KeyboardEvent } from "react";

export interface UseDragReorderOptions {
  /** Canonical order of item ids coming from the data layer. */
  ids: string[];
  /** When false all drag/keyboard interactions are inert. */
  enabled?: boolean;
  /** Persists the new ordering; must also update the data-layer state so
   * `ids` reflects the new order once persistence settles. */
  onReorder: (orderedIds: string[]) => Promise<void> | void;
  /** Invoked when persistence fails after the local revert. */
  onError?: (message: string) => void;
}

function arrayMove(ids: string[], from: number, to: number): string[] {
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Optimistic drag-and-drop reordering state machine.
 *
 * The local order updates immediately on drop/keyboard move, then the change
 * is persisted in the background. If persistence fails, the caller restores
 * its own order and the local override is dropped, restoring `ids`.
 */
export function useDragReorder({
  ids,
  enabled = true,
  onReorder,
  onError,
}: UseDragReorderOptions) {
  // Optimistic order overlay; null means "follow the data layer order".
  const [override, setOverride] = useState<string[] | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // Index of the item whose grip is currently mouse-held; only that item is
  // draggable so plain clicks / text selection on the card still work.
  const [armedIndex, setArmedIndex] = useState<number | null>(null);

  const order = override ?? ids;

  const commit = useCallback(
    (nextOrder: string[]) => {
      setOverride(nextOrder);
      Promise.resolve(onReorder(nextOrder))
        .catch((err) => {
          console.error("Failed to persist new order:", err);
          onError?.(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          // Success: the data layer now reflects the new order. Failure: the
          // caller reverted, so dropping the overlay restores its order.
          setOverride(null);
        });
    },
    [onReorder, onError]
  );

  const moveItem = useCallback(
    (from: number, to: number) => {
      if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) {
        return;
      }
      commit(arrayMove(order, from, to));
    },
    [order, commit]
  );

  const moveBy = useCallback(
    (index: number, delta: number) => moveItem(index, index + delta),
    [moveItem]
  );

  const clearDrag = useCallback(() => {
    setDragIndex(null);
    setOverIndex(null);
    setArmedIndex(null);
  }, []);

  const itemHandlers = useMemo(
    () => (index: number) => ({
      draggable: enabled && armedIndex === index,
      onDragStart: (e: DragEvent) => {
        if (!enabled || armedIndex !== index) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = "move";
        // Required for Firefox to initiate the drag at all.
        e.dataTransfer.setData("text/plain", order[index] ?? "");
        setDragIndex(index);
      },
      onDragOver: (e: DragEvent) => {
        if (dragIndex === null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setOverIndex(index);
      },
      onDrop: (e: DragEvent) => {
        if (dragIndex === null) return;
        e.preventDefault();
        moveItem(dragIndex, index);
        clearDrag();
      },
      onDragEnd: clearDrag,
      onKeyDown: (e: KeyboardEvent) => {
        if (!enabled) return;
        if (e.altKey && e.key === "ArrowUp") {
          e.preventDefault();
          moveBy(index, -1);
        } else if (e.altKey && e.key === "ArrowDown") {
          e.preventDefault();
          moveBy(index, 1);
        }
      },
      onGrabStart: () => setArmedIndex(index),
      onGrabEnd: () => {
        if (dragIndex === null) setArmedIndex(null);
      },
    }),
    [enabled, armedIndex, order, dragIndex, moveItem, moveBy, clearDrag]
  );

  return {
    order,
    dragIndex,
    overIndex,
    armedIndex,
    itemHandlers,
    moveItem,
    moveBy,
    clearDrag,
  };
}
