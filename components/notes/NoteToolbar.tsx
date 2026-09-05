"use client";

import React from "react";
import { SearchIcon, CloseIcon } from "../common/Icons";

export interface NoteToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalCount: number;
  filteredCount: number;
}

export function NoteToolbar({
  searchQuery,
  onSearchChange,
  totalCount,
  filteredCount,
}: NoteToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-container-lowest p-2 rounded-xl border border-outline-variant/40 shadow-sm">
      {/* Search Input */}
      <div className="relative flex-1 max-w-[28rem]">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none">
          <SearchIcon size={14} />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search notes..."
          className="w-full bg-surface-container-low text-on-surface font-sans text-xs placeholder:text-outline pl-9 pr-8 py-2 rounded-lg outline-none border border-transparent focus:border-outline-variant focus:bg-surface-container-high transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface p-0.5 rounded transition-colors"
            title="Clear search"
          >
            <CloseIcon size={14} />
          </button>
        )}
      </div>

      {/* Match Counter */}
      {totalCount > 0 && (
        <span className="font-mono text-[11px] text-outline px-2 py-0.5 rounded bg-surface-container self-center hidden sm:inline-block">
          {searchQuery.trim()
            ? `${filteredCount} ${filteredCount === 1 ? "note" : "notes"} matching “${searchQuery.trim()}”`
            : filteredCount === totalCount
              ? `${totalCount} ${totalCount === 1 ? "note" : "notes"}`
              : `${filteredCount} of ${totalCount} notes`}
        </span>
      )}
    </div>
  );
}
