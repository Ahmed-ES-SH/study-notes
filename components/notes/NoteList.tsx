"use client";

import React from "react";
import { Note, SearchResult } from "../../lib/api/types";
import { NoteCard } from "./NoteCard";
import { Button } from "../common/Button";
import { ReorderableList } from "../common/ReorderableList";
import { BookIcon, ManageSearchIcon, PlusIcon } from "../common/Icons";
import {
  useDeferredRender,
  DEFERRED_RENDER_THRESHOLD,
} from "../../lib/hooks/useDeferredRender";

export interface NoteListProps {
  notes: Note[];
  totalNotes: number;
  searchQuery: string;
  isLoading: boolean;
  onClearSearch: () => void;
  onCreateNote: () => void;
  onRename: (note: Note) => void;
  onDelete: (note: Note) => void;
  /** Active FTS results (BM25 rank order); null when not searching. */
  searchResults?: SearchResult[] | null;
  /** Persisted manual reorder of notes (drag + Alt+Arrow). */
  onReorder?: (orderedIds: string[]) => Promise<void>;
  onReorderError?: (message: string) => void;
  /** False while a search filter hides part of the list. */
  reorderEnabled?: boolean;
}

function NoteCardSkeleton() {
  return (
    <div className="p-5 bg-surface-container-low border border-outline-variant/60 rounded-xl space-y-3 animate-pulse">
      <div className="h-5 w-2/3 rounded bg-surface-container-high" />
      <div className="h-3 w-full rounded bg-surface-container-high" />
      <div className="h-3 w-1/2 rounded bg-surface-container-high" />
    </div>
  );
}

export function NoteList({
  notes,
  totalNotes,
  searchQuery,
  isLoading,
  onClearSearch,
  onCreateNote,
  onRename,
  onDelete,
  searchResults = null,
  onReorder,
  onReorderError,
  reorderEnabled = false,
}: NoteListProps) {
  // Progressive (windowed) rendering keeps the DOM small for 1,000–10,000+
  // note subsections; lists below the threshold render in full.
  // (Hook must run unconditionally, before the early returns below.)
  const { visibleItems, visibleCount, sentinelRef, hasMore } = useDeferredRender(
    notes,
    notes.length > DEFERRED_RENDER_THRESHOLD
  );

  const snippetsById = React.useMemo(() => {
    const map = new Map<string, string>();
    if (searchResults) {
      for (const r of searchResults) map.set(r.id, r.snippet);
    }
    return map;
  }, [searchResults]);
  const isFtsSearch = searchResults !== null;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <NoteCardSkeleton />
        <NoteCardSkeleton />
        <NoteCardSkeleton />
      </div>
    );
  }

  // Empty subsection — no notes at all
  if (totalNotes === 0) {
    return (
      <div className="p-10 rounded-xl bg-surface-container-lowest border border-outline-variant/40 border-dashed text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-surface-container-high text-primary flex items-center justify-center mx-auto border border-outline-variant/40">
          <BookIcon size={24} />
        </div>
        <div className="space-y-1.5 max-w-[28rem] mx-auto">
          <h2 className="font-sans font-semibold text-lg text-on-surface">
            No notes yet in this subsection
          </h2>
          <p className="font-sans text-xs text-outline leading-relaxed">
            Create your first note to start studying — everything is stored
            locally and works fully offline.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<PlusIcon size={14} />}
          onClick={onCreateNote}
        >
          Create First Note
        </Button>
      </div>
    );
  }

  // Search returned no matches
  if (notes.length === 0 && searchQuery.trim()) {
    return (
      <div className="p-10 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-surface-container-high text-outline flex items-center justify-center mx-auto border border-outline-variant/40">
          <ManageSearchIcon size={24} />
        </div>
        <div className="space-y-1.5 max-w-[28rem] mx-auto">
          <h2 className="font-sans font-semibold text-lg text-on-surface">
            No notes found matching “{searchQuery.trim()}”
          </h2>
          <p className="font-sans text-xs text-outline leading-relaxed">
            Full-text search covers note titles and markdown content. Try a
            different keyword or clear the search.
          </p>
        </div>
        <Button variant="secondary" onClick={onClearSearch}>
          Clear Search
        </Button>
      </div>
    );
  }

  // Progressive (windowed) rendering keeps the DOM small for 1,000–10,000+
  // note subsections; lists below the threshold render in full.
  const renderCard = (
    note: Note,
    reorderState?: {
      handleProps: { onGrabStart: () => void; onGrabEnd: () => void };
      isDragging: boolean;
    }
  ) => (
    <NoteCard
      key={note.id}
      note={note}
      onRename={onRename}
      onDelete={onDelete}
      snippet={isFtsSearch ? snippetsById.get(note.id) : undefined}
      highlightQuery={isFtsSearch ? searchQuery : undefined}
      dragHandleProps={reorderState?.handleProps}
      isDragging={reorderState?.isDragging}
    />
  );

  if (reorderEnabled && onReorder) {
    return (
      <ReorderableList
        items={notes}
        getId={(note) => note.id}
        ariaLabel="Notes"
        onReorder={onReorder}
        onError={onReorderError}
        className="flex flex-col gap-3"
      >
        {(note, state) => renderCard(note, state)}
      </ReorderableList>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {visibleItems.map((note) => renderCard(note))}
      {hasMore && (
        <div ref={sentinelRef} className="py-2 text-center font-mono text-[11px] text-outline">
          Rendering {visibleCount} of {notes.length} notes — scroll to load more
        </div>
      )}
    </div>
  );
}
