"use client";

import React from "react";

export interface KeyboardShortcutBadgeProps {
  /** Shortcut keys rendered left-to-right, e.g. ["⌘", "K"] or ["ESC"]. */
  keys: string[];
  className?: string;
}

/** Noir-styled keyboard shortcut chip, e.g. ⌘K, ↵, ESC. */
export function KeyboardShortcutBadge({ keys, className = "" }: KeyboardShortcutBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {keys.map((key, i) => (
        <kbd
          key={i}
          className="font-mono text-[10px] leading-none bg-surface-container-highest text-outline border border-outline-variant/40 px-1.5 py-0.5 rounded"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}
