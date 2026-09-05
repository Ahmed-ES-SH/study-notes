"use client";

import React from "react";
import { Note } from "../../lib/api/types";
import { NoteCard } from "./NoteCard";
import { Button } from "../common/Button";
import { BookIcon, ManageSearchIcon, PlusIcon } from "../common/Icons";

export interface NoteListProps {
  notes: Note[];
  totalNotes: number;
  searchQuery: string;
  isLoading: boolean;
  onClearSearch: () => void;
  onCreateNote: () => void;
  onRename: (note: Note) => void;
  onDelete: (note: Note) => void;
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
}: NoteListProps) {
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
        <div className="space-y-1.5 max-w-md mx-auto">
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
        <div className="space-y-1.5 max-w-md mx-auto">
          <h2 className="font-sans font-semibold text-lg text-on-surface">
            No notes found matching “{searchQuery.trim()}”
          </h2>
          <p className="font-sans text-xs text-outline leading-relaxed">
            Search matches note titles only. Try a different keyword or clear
            the search.
          </p>
        </div>
        <Button variant="secondary" onClick={onClearSearch}>
          Clear Search
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} onRename={onRename} onDelete={onDelete} />
      ))}
    </div>
  );
}
