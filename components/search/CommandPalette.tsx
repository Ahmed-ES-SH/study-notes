"use client";

import React, { useEffect, useRef } from "react";
import {
  useCommandPalette,
  PaletteItem,
} from "../../lib/hooks/useCommandPalette";
import { SearchResultItem } from "./SearchResultItem";
import { SearchScopeFilter } from "./SearchScopeFilter";
import { KeyboardShortcutBadge } from "../common/KeyboardShortcutBadge";
import { SearchIcon, CloseIcon } from "../common/Icons";

const GROUP_ORDER: PaletteItem["kind"][] = [
  "action",
  "section",
  "subsection",
  "note",
];
const GROUP_TITLE: Record<PaletteItem["kind"], string> = {
  action: "Quick Actions",
  section: "Knowledge Domains",
  subsection: "Subsections",
  note: "Notes",
};

/**
 * Elevated global command palette (⌘K / Ctrl+K). Keyboard-first: type to
 * search, ↑/↓ to move, Enter to open, Esc to dismiss.
 */
export function CommandPalette() {
  const palette = useCommandPalette();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (palette.isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [palette.isOpen]);

  // Keep the active row in view during keyboard navigation.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list
      .querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [palette.activeIndex]);

  if (!palette.isOpen) return null;

  // Insert group headers into the flat, keyboard-navigable result list.
  const rendered: React.ReactNode[] = [];
  const groupBounds: { kind: PaletteItem["kind"]; itemIdx: number }[] = [];
  let flatIndex = 0;
  for (const kind of GROUP_ORDER) {
    const groupItems = palette.items
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.kind === kind);
    if (groupItems.length === 0) continue;
    groupBounds.push({ kind, itemIdx: flatIndex });
    rendered.push(
      <div
        key={`header-${kind}`}
        className="px-4 pt-3 pb-1 font-mono text-[10px] uppercase tracking-wider text-outline font-semibold"
      >
        {GROUP_TITLE[kind]}
      </div>,
    );
    for (const { item, idx } of groupItems) {
      rendered.push(
        <SearchResultItem
          key={item.id}
          item={item}
          query={palette.query}
          active={idx === palette.activeIndex}
          onHover={() => palette.setActiveIndex(idx)}
          onSelect={palette.navigateTo}
        />,
      );
      flatIndex += 1;
    }
  }

  const empty =
    !palette.isSearching &&
    rendered.length === 0 &&
    palette.query.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) palette.close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={palette.handleKeyDown}
        className="w-full max-w-3xl bg-surface-container-low border border-outline-variant rounded-xl shadow-2xl overflow-hidden animate-pal-in"
      >
        {/* Input Row */}
        <div className="flex items-center gap-3 px-4 h-12 border-b border-outline-variant/40">
          <span className="text-outline shrink-0">
            <SearchIcon size={16} />
          </span>
          <input
            ref={inputRef}
            type="text"
            value={palette.query}
            onChange={(e) => palette.setQuery(e.target.value)}
            placeholder="Search notes, subsections, domains, or type a command..."
            className="flex-1 bg-transparent text-on-surface font-sans text-sm placeholder:text-outline outline-none"
          />
          <button
            type="button"
            onClick={palette.close}
            className="text-outline hover:text-on-surface p-1 rounded transition-colors cursor-pointer"
            title="Close palette"
          >
            <CloseIcon size={14} />
          </button>
        </div>

        {/* Scope Filters */}
        <SearchScopeFilter
          scope={palette.scope}
          onScopeChange={palette.setScope}
          hasDomainContext={palette.hasDomainContext}
          hasTopicContext={palette.hasTopicContext}
        />

        {/* Results */}
        <div
          ref={listRef}
          role="listbox"
          aria-label="Search results"
          className="max-h-[50vh] overflow-y-auto py-1"
        >
          {empty && (
            <div className="px-4 py-10 text-center space-y-1.5">
              <p className="font-sans text-sm text-on-surface font-medium">
                No matches for “{palette.query.trim()}”
              </p>
              <p className="font-sans text-xs text-outline">
                Full-text search covers note titles, markdown content, headings
                and code — try a shorter keyword.
              </p>
            </div>
          )}
          {palette.isSearching && (
            <div className="px-4 py-6 font-mono text-xs text-outline animate-pulse">
              Searching local index...
            </div>
          )}
          {rendered}
        </div>

        {/* Footer Hints */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-outline-variant/40 bg-surface-container-lowest/60">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-mono text-[10px] text-outline">
              <KeyboardShortcutBadge keys={["↑", "↓"]} /> navigate
            </span>
            <span className="flex items-center gap-1 font-mono text-[10px] text-outline">
              <KeyboardShortcutBadge keys={["↵"]} /> open
            </span>
            <span className="flex items-center gap-1 font-mono text-[10px] text-outline">
              <KeyboardShortcutBadge keys={["ESC"]} /> dismiss
            </span>
          </div>
          <span className="font-mono text-[10px] text-outline/70 hidden sm:inline">
            SQLite FTS5 · 100% offline
          </span>
        </div>
      </div>
    </div>
  );
}
