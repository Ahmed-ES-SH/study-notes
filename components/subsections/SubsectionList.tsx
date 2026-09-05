"use client";

import React from "react";
import { SubsectionWithDetails } from "../../lib/api/types";
import { SubsectionCard } from "./SubsectionCard";
import { SubsectionViewMode } from "./SubsectionToolbar";
import { Button } from "../common/Button";
import { ReorderableList } from "../common/ReorderableList";
import { HubIcon, ManageSearchIcon, PlusIcon } from "../common/Icons";

export interface SubsectionListProps {
  subsections: SubsectionWithDetails[];
  totalSubsections: number;
  searchQuery: string;
  viewMode: SubsectionViewMode;
  isLoading: boolean;
  sectionColor: string;
  onClearSearch: () => void;
  onCreateSubsection: () => void;
  onRename: (subsection: SubsectionWithDetails) => void;
  onDelete: (subsection: SubsectionWithDetails) => void;
  onAddNote: (subsectionId: string, title: string) => Promise<unknown>;
  /** Persisted manual reorder of subsections (drag + Alt+Arrow). */
  onReorder?: (orderedIds: string[]) => Promise<void>;
  onReorderError?: (message: string) => void;
  /** False while a filter hides part of the list. */
  reorderEnabled?: boolean;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-40 rounded-xl bg-surface-container-low border border-outline-variant/30 animate-pulse"
        />
      ))}
    </div>
  );
}

export function SubsectionList({
  subsections,
  totalSubsections,
  searchQuery,
  viewMode,
  isLoading,
  sectionColor,
  onClearSearch,
  onCreateSubsection,
  onRename,
  onDelete,
  onAddNote,
  onReorder,
  onReorderError,
  reorderEnabled = false,
}: SubsectionListProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // No subsections in this section at all
  if (totalSubsections === 0) {
    return (
      <div className="p-10 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-surface-container-high text-primary flex items-center justify-center mx-auto border border-outline-variant/40">
          <HubIcon size={24} />
        </div>
        <div className="space-y-1.5 max-w-[28rem] mx-auto">
          <h3 className="font-sans font-semibold text-lg text-on-surface">
            No subsections yet
          </h3>
          <p className="font-sans text-xs text-outline leading-relaxed">
            Create your first one to organize your notes.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<PlusIcon size={14} />}
          onClick={onCreateSubsection}
        >
          Create Subsection
        </Button>
      </div>
    );
  }

  // Subsections exist but none match the filter
  if (subsections.length === 0) {
    return (
      <div className="p-10 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-surface-container-high text-outline flex items-center justify-center mx-auto border border-outline-variant/40">
          <ManageSearchIcon size={24} />
        </div>
        <div className="space-y-1.5 max-w-[28rem] mx-auto">
          <h3 className="font-sans font-semibold text-lg text-on-surface">
            No subsections match your filter
          </h3>
          <p className="font-sans text-xs text-outline leading-relaxed font-mono">
            “{searchQuery}” did not match any subsection titles.
          </p>
        </div>
        <Button variant="secondary" onClick={onClearSearch}>
          Reset Filter
        </Button>
      </div>
    );
  }

  const renderCard = (
    sub: SubsectionWithDetails,
    reorderState?: {
      handleProps: { onGrabStart: () => void; onGrabEnd: () => void };
      isDragging: boolean;
      moveBy: (delta: number) => void;
      canMoveUp: boolean;
      canMoveDown: boolean;
    }
  ) => (
    <SubsectionCard
      key={sub.id}
      subsection={sub}
      color={sectionColor}
      viewMode={viewMode}
      onRename={onRename}
      onDelete={onDelete}
      onAddNote={onAddNote}
      dragHandleProps={reorderState?.handleProps}
      isDragging={reorderState?.isDragging}
      onMoveBy={reorderState?.moveBy}
      canMoveUp={reorderState?.canMoveUp ?? false}
      canMoveDown={reorderState?.canMoveDown ?? false}
    />
  );

  if (viewMode === "compact") {
    if (reorderEnabled && onReorder) {
      return (
        <ReorderableList
          items={subsections}
          getId={(sub) => sub.id}
          ariaLabel="Subsections"
          onReorder={onReorder}
          onError={onReorderError}
          className="space-y-2"
        >
          {(sub, state) => renderCard(sub, state)}
        </ReorderableList>
      );
    }
    return <div className="space-y-2">{subsections.map((sub) => renderCard(sub))}</div>;
  }

  if (reorderEnabled && onReorder) {
    return (
      <ReorderableList
        items={subsections}
        getId={(sub) => sub.id}
        ariaLabel="Subsections"
        onReorder={onReorder}
        onError={onReorderError}
        className="grid grid-cols-1 xl:grid-cols-2 gap-4"
      >
        {(sub, state) => renderCard(sub, state)}
      </ReorderableList>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {subsections.map((sub) => renderCard(sub))}
    </div>
  );
}
