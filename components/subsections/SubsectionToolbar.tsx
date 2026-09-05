"use client";

import React from "react";
import { Button } from "../common/Button";
import { PlusIcon, GridViewIcon, ListViewIcon, CloseIcon } from "../common/Icons";

export type SubsectionViewMode = "detailed" | "compact";

export interface SubsectionToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: SubsectionViewMode;
  onViewModeChange: (mode: SubsectionViewMode) => void;
  totalCount: number;
  filteredCount: number;
  onCreateSubsection: () => void;
}

export function SubsectionToolbar({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  totalCount,
  filteredCount,
  onCreateSubsection,
}: SubsectionToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-container-lowest p-2 rounded-xl border border-outline-variant/40 shadow-sm">
      {/* Filter Input */}
      <div className="relative flex-1 max-w-md">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter subsections..."
          className="w-full bg-surface-container-low text-on-surface font-sans text-xs placeholder:text-outline px-3 pr-8 py-2 rounded-lg outline-none border border-transparent focus:border-outline-variant focus:bg-surface-container-high transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface p-0.5 rounded transition-colors"
            title="Clear filter"
          >
            <CloseIcon size={14} />
          </button>
        )}
      </div>

      {/* View Toggles & Action Button */}
      <div className="flex items-center gap-3 justify-between sm:justify-end px-1 sm:px-0">
        <div className="flex items-center gap-0.5 bg-surface-container-low p-0.5 rounded-lg border border-outline-variant/30">
          <button
            type="button"
            onClick={() => onViewModeChange("detailed")}
            title="Detailed Cards"
            aria-pressed={viewMode === "detailed"}
            className={`p-1.5 rounded transition-all cursor-pointer ${
              viewMode === "detailed"
                ? "bg-surface-container-high text-primary shadow-xs"
                : "text-outline hover:text-on-surface"
            }`}
          >
            <GridViewIcon size={16} />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("compact")}
            title="Compact View"
            aria-pressed={viewMode === "compact"}
            className={`p-1.5 rounded transition-all cursor-pointer ${
              viewMode === "compact"
                ? "bg-surface-container-high text-primary shadow-xs"
                : "text-outline hover:text-on-surface"
            }`}
          >
            <ListViewIcon size={16} />
          </button>
        </div>

        {totalCount > 0 && (
          <span className="font-mono text-[11px] text-outline px-2 py-0.5 rounded bg-surface-container hidden md:inline-block">
            {filteredCount === totalCount
              ? `${totalCount} ${totalCount === 1 ? "subsection" : "subsections"}`
              : `${filteredCount} of ${totalCount}`}
          </span>
        )}

        <Button
          variant="primary"
          icon={<PlusIcon size={14} />}
          onClick={onCreateSubsection}
        >
          New Subsection
        </Button>
      </div>
    </div>
  );
}
