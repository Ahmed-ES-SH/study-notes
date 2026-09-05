"use client";

import React from "react";
import { DragIndicatorIcon } from "./Icons";

export interface DragHandleProps {
  /** Called on pointer-down over the grip; the parent list enables dragging
   * on the item while the grip is held so only the handle starts a drag. */
  onGrabStart?: (e: React.MouseEvent) => void;
  onGrabEnd?: () => void;
  isDragging?: boolean;
  label?: string;
  className?: string;
}

/**
 * 6-dot monospace grip affordance. Invisible until the parent `.group` card
 * is hovered so it never competes with the primary card actions.
 */
export function DragHandle({
  onGrabStart,
  onGrabEnd,
  isDragging,
  label = "Drag to reorder",
  className = "",
}: DragHandleProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={onGrabStart}
      onMouseUp={onGrabEnd}
      onMouseLeave={onGrabEnd}
      className={`shrink-0 p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container-high transition-all cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#388bfd] ${
        isDragging ? "opacity-100 text-primary cursor-grabbing" : ""
      } ${className}`}
    >
      <DragIndicatorIcon size={14} />
    </button>
  );
}
