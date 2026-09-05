"use client";

import React from "react";
import { SearchIcon, GridViewIcon, ListViewIcon, ChevronDownIcon, CloseIcon } from "../common/Icons";

export type SortOption = "manual" | "updated" | "name" | "created";

export interface SectionFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  totalCount: number;
  filteredCount: number;
}

export function SectionFilterBar({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortChange,
  totalCount,
  filteredCount,
}: SectionFilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-container-lowest p-2 rounded-xl border border-outline-variant/40 shadow-sm">
      {/* Search Input */}
      <div className="relative flex-1 max-w-[28rem]">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none">
          <SearchIcon size={16} />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search domain or subsection... (e.g. closures, sql)"
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

      {/* View Toggle & Sort Selector */}
      <div className="flex items-center gap-3 justify-between sm:justify-end px-1 sm:px-0">
        {/* Layout Switcher */}
        <div className="flex items-center gap-0.5 bg-surface-container-low p-0.5 rounded-lg border border-outline-variant/30">
          <button
            type="button"
            onClick={() => onViewModeChange("grid")}
            title="Grid Layout"
            className={`p-1.5 rounded transition-all cursor-pointer ${
              viewMode === "grid"
                ? "bg-surface-container-high text-primary shadow-xs"
                : "text-outline hover:text-on-surface"
            }`}
          >
            <GridViewIcon size={16} />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("list")}
            title="Compact List"
            className={`p-1.5 rounded transition-all cursor-pointer ${
              viewMode === "list"
                ? "bg-surface-container-high text-primary shadow-xs"
                : "text-outline hover:text-on-surface"
            }`}
          >
            <ListViewIcon size={16} />
          </button>
        </div>

        <div className="h-4 w-px bg-outline-variant/40 hidden sm:block" />

        {/* Sort selector */}
        <div className="flex items-center gap-1.5 font-mono text-xs text-outline">
          <span>Sort:</span>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="appearance-none bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 text-on-surface font-mono text-xs rounded px-2.5 py-1 pr-6 cursor-pointer outline-none focus:border-primary-container"
            >
              <option value="manual">Custom Order</option>
              <option value="updated">Last Updated</option>
              <option value="name">Alphabetical (A-Z)</option>
              <option value="created">Creation Date</option>
            </select>
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 text-outline pointer-events-none">
              <ChevronDownIcon size={12} />
            </div>
          </div>
        </div>

        {/* Counter Badge */}
        {totalCount > 0 && (
          <span className="font-mono text-[11px] text-outline px-2 py-0.5 rounded bg-surface-container hidden md:inline-block">
            {filteredCount === totalCount
              ? `${totalCount} domains`
              : `${filteredCount} of ${totalCount}`}
          </span>
        )}
      </div>
    </div>
  );
}
