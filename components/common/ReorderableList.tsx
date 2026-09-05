"use client";

import React from "react";
import { useDragReorder } from "../../lib/hooks/useDragReorder";

export interface ReorderItemState {
  isDragging: boolean;
  isDropTarget: boolean;
  /** Spread onto the drag handle: arms pointer-initiated dragging. */
  handleProps: {
    onGrabStart: () => void;
    onGrabEnd: () => void;
  };
  /** Shift this item one position up/down (optimistic + persisted). */
  moveBy: (delta: number) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export interface ReorderableListProps<T> {
  items: T[];
  getId: (item: T) => string;
  ariaLabel: string;
  /** Persists the submitted id order; must map to `reorderEntities`. */
  onReorder: (orderedIds: string[]) => Promise<void> | void;
  onError?: (message: string) => void;
  /** Disable all reordering interactions (e.g. while filtering). */
  enabled?: boolean;
  className?: string;
  /** Visual drop-position indicator between rows. */
  showDropIndicator?: boolean;
  children: (item: T, state: ReorderItemState) => React.ReactNode;
}

/**
 * Generic accessible reorder wrapper: renders each item inside a focusable
 * listitem that supports pointer drag (via the item's DragHandle) and
 * Alt+ArrowUp / Alt+ArrowDown keyboard reordering.
 */
export function ReorderableList<T>({
  items,
  getId,
  ariaLabel,
  onReorder,
  onError,
  enabled = true,
  className = "",
  showDropIndicator = true,
  children: renderItem,
}: ReorderableListProps<T>) {
  const ids = React.useMemo(() => items.map(getId), [items, getId]);
  const { order, dragIndex, overIndex, itemHandlers, moveBy } = useDragReorder({
    ids,
    enabled,
    onReorder,
    onError,
  });

  const itemsById = React.useMemo(() => {
    const map = new Map<string, T>();
    items.forEach((item) => map.set(getId(item), item));
    return map;
  }, [items, getId]);

  const count = order.length;

  return (
    <div role="list" aria-label={ariaLabel} className={className}>
      {order.map((id, index) => {
        const item = itemsById.get(id);
        if (item === undefined) return null;

        const handlers = itemHandlers(index);
        const isDragging = dragIndex === index;
        const isDropTarget = overIndex === index && dragIndex !== null && dragIndex !== index;

        return (
          <div key={id}>
            {showDropIndicator && isDropTarget && (
              <div
                aria-hidden
                className="h-0.5 rounded-full bg-[#388bfd] shadow-[0_0_6px_#388bfd] -my-px"
              />
            )}
            <div
              role="listitem"
              tabIndex={enabled ? 0 : -1}
              aria-label={`${ariaLabel} item ${index + 1} of ${count}`}
              className={`group/reorder-item rounded-xl outline-none focus-visible:ring-1 focus-visible:ring-[#388bfd] ${
                isDragging
                  ? "opacity-60 shadow-2xl ring-2 ring-[#388bfd] ring-offset-2 ring-offset-background"
                  : ""
              }`}
              {...handlers}
            >
              {renderItem(item, {
                isDragging,
                isDropTarget,
                handleProps: {
                  onGrabStart: handlers.onGrabStart,
                  onGrabEnd: handlers.onGrabEnd,
                },
                moveBy: (delta: number) => moveBy(index, delta),
                canMoveUp: index > 0,
                canMoveDown: index < count - 1,
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
