"use client";

import React from "react";
import { SectionWithStats } from "../../lib/hooks/useMainSections";
import { SectionCard } from "./SectionCard";
import { SectionListRow } from "./SectionListRow";
import { Button } from "../common/Button";
import { ManageSearchIcon, PlusIcon, CodeIcon } from "../common/Icons";

export interface SectionGridProps {
  sections: SectionWithStats[];
  totalSectionsCount: number;
  searchQuery: string;
  viewMode: "grid" | "list";
  isLoading: boolean;
  onClearSearch: () => void;
  onCreateSection: () => void;
  onEditSection: (section: SectionWithStats) => void;
  onDeleteSection: (section: SectionWithStats) => void;
  onAddSubsection?: (sectionId: string) => void;
}

export function SectionGrid({
  sections,
  totalSectionsCount,
  searchQuery,
  viewMode,
  isLoading,
  onClearSearch,
  onCreateSection,
  onEditSection,
  onDeleteSection,
  onAddSubsection,
}: SectionGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="h-48 bg-surface-container-low border border-outline-variant/30 rounded-xl p-5 flex flex-col justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface-container-high" />
              <div className="space-y-2 flex-1">
                <div className="h-3 w-20 bg-surface-container-high rounded" />
                <div className="h-4 w-40 bg-surface-container-high rounded" />
              </div>
            </div>
            <div className="h-4 w-3/4 bg-surface-container-high rounded" />
            <div className="h-8 bg-surface-container-high/50 rounded" />
          </div>
        ))}
      </div>
    );
  }

  // State 1: No sections created yet
  if (totalSectionsCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4 bg-surface-container-lowest border border-outline-variant/40 rounded-xl">
        <div className="w-14 h-14 rounded-2xl bg-surface-container-high text-primary flex items-center justify-center border border-outline-variant/50 shadow-inner">
          <CodeIcon size={28} />
        </div>
        <div className="space-y-1.5 max-w-md">
          <h3 className="font-sans font-semibold text-lg text-on-surface">
            No knowledge domains yet
          </h3>
          <p className="font-sans text-xs text-outline leading-relaxed">
            Create your first main section to start organizing developer notes,
            taxonomies, code snippets, and study materials.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<PlusIcon size={14} />}
          onClick={onCreateSection}
        >
          Create First Section
        </Button>
      </div>
    );
  }

  // State 2: No search matches
  if (sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4 bg-surface-container-lowest border border-outline-variant/40 rounded-xl">
        <div className="w-14 h-14 rounded-2xl bg-surface-container-high text-outline flex items-center justify-center border border-outline-variant/50">
          <ManageSearchIcon size={28} />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <h3 className="font-sans font-semibold text-base text-on-surface">
            No matching domain found
          </h3>
          <p className="font-sans text-xs text-outline leading-relaxed">
            No sections match “{searchQuery}”. Try searching with broader keywords or clear the filter.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={onClearSearch}>
          Clear Filter
        </Button>
      </div>
    );
  }

  // Grid or List display
  if (viewMode === "list") {
    return (
      <div className="flex flex-col gap-2.5">
        {sections.map((section) => (
          <SectionListRow
            key={section.id}
            section={section}
            onEdit={onEditSection}
            onDelete={onDeleteSection}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sections.map((section) => (
        <SectionCard
          key={section.id}
          section={section}
          onEdit={onEditSection}
          onDelete={onDeleteSection}
          onAddSubsection={onAddSubsection}
        />
      ))}
    </div>
  );
}
