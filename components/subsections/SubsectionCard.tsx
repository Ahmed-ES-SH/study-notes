"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SubsectionWithDetails } from "../../lib/api/types";
import { formatRelativeTime } from "../../lib/utils/format";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { Dialog } from "../common/Dialog";
import { Input } from "../common/Input";
import {
  ClockIcon,
  MoreVerticalIcon,
  EditIcon,
  TrashIcon,
  ArrowRightIcon,
  PlusIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "../common/Icons";
import { DragHandle } from "../common/DragHandle";

export interface SubsectionCardProps {
  subsection: SubsectionWithDetails;
  color: string;
  viewMode: "detailed" | "compact";
  onRename: (subsection: SubsectionWithDetails) => void;
  onDelete: (subsection: SubsectionWithDetails) => void;
  onAddNote: (subsectionId: string, title: string) => Promise<unknown>;
  /** Present while manual reordering is enabled for the list. */
  dragHandleProps?: {
    onGrabStart: () => void;
    onGrabEnd: () => void;
  };
  isDragging?: boolean;
  /** Shift position up/down via the context menu (keyboard alternative). */
  onMoveBy?: (delta: number) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

function NotePreviewTile({
  subsectionId,
  title,
  content,
}: {
  subsectionId: string;
  title: string;
  content: string;
}) {
  const snippet =
    content.trim().length > 0 ? content.trim().slice(0, 90) : "Empty note — no content yet.";
  return (
    <Link
      href={`/subsection?id=${subsectionId}`}
      className="group/tile flex flex-col gap-1 p-2.5 rounded-lg bg-surface-container border border-outline-variant/40 hover:border-outline/50 hover:bg-surface-container-high transition-all min-w-0"
    >
      <span className="font-sans text-xs font-semibold text-on-surface truncate group-hover/tile:text-primary transition-colors">
        {title || "Untitled note"}
      </span>
      <span className="font-sans text-[11px] text-outline leading-relaxed line-clamp-2">
        {snippet}
      </span>
    </Link>
  );
}

function QuickAddNoteDialog({
  subsection,
  onClose,
  onSubmit,
}: {
  subsection: SubsectionWithDetails;
  onClose: () => void;
  onSubmit: (subsectionId: string, title: string) => Promise<unknown>;
}) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Note title is required");
      return;
    }
    if (trimmed.length > 60) {
      setError("Note title must be 60 characters or fewer");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(subsection.id, trimmed);
      onClose();
    } catch (err) {
      console.error("Failed to create note:", err);
      setError(err instanceof Error ? err.message : "Failed to create note");
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title="Quick Add Note"
      description={`Create a new note inside “${subsection.name}”.`}
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input
          label="Note Title"
          placeholder="e.g. Closures & Scope"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (error) setError(null);
          }}
          error={error || undefined}
          autoFocus
          disabled={isSubmitting}
        />
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-outline-variant/50">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" icon={<PlusIcon size={14} />} isLoading={isSubmitting}>
            Create Note
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function SubsectionCard({
  subsection,
  color,
  viewMode,
  onRename,
  onDelete,
  onAddNote,
  dragHandleProps,
  isDragging,
  onMoveBy,
  canMoveUp = false,
  canMoveDown = false,
}: SubsectionCardProps) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  const noteCount = subsection.notes.length;
  const isCompact = viewMode === "compact";

  const contextMenu = (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsMenuOpen((prev) => !prev);
        }}
        className="p-1.5 rounded text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors"
        title="Subsection actions"
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
      >
        <MoreVerticalIcon size={14} />
      </button>

      {isMenuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 top-9 z-50 w-44 py-1 rounded-lg bg-surface-container-high border border-outline-variant shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              disabled={onMoveBy === undefined || !canMoveUp}
              onClick={() => {
                setIsMenuOpen(false);
                onMoveBy?.(-1);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 font-mono text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowUpIcon size={13} />
              Move Up
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={onMoveBy === undefined || !canMoveDown}
              onClick={() => {
                setIsMenuOpen(false);
                onMoveBy?.(1);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 font-mono text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowDownIcon size={13} />
              Move Down
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsMenuOpen(false);
                onRename(subsection);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 font-mono text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors text-left cursor-pointer"
            >
              <EditIcon size={13} />
              Rename Subsection
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsMenuOpen(false);
                onDelete(subsection);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 font-mono text-xs text-on-surface-variant hover:text-error hover:bg-red-950/40 transition-colors text-left cursor-pointer"
            >
              <TrashIcon size={13} />
              Delete Subsection
            </button>
          </div>
        </>
      )}
    </div>
  );

  const header = (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        {dragHandleProps && (
          <DragHandle
            onGrabStart={dragHandleProps.onGrabStart}
            onGrabEnd={dragHandleProps.onGrabEnd}
            isDragging={isDragging}
            label={`Drag to reorder ${subsection.name}`}
          />
        )}
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <Link
          href={`/subsection?id=${subsection.id}`}
          className={`font-sans font-semibold text-on-surface hover:text-primary transition-colors truncate ${
            isCompact ? "text-sm" : "text-lg"
          }`}
          title={subsection.name}
        >
          {subsection.name}
        </Link>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <div className="flex items-center gap-1 font-mono text-xs text-outline mr-1">
          <ClockIcon size={12} />
          <span>{formatRelativeTime(subsection.updated_at)}</span>
        </div>
        {contextMenu}
      </div>
    </div>
  );

  if (isCompact) {
    return (
      <div className="flex items-center justify-between gap-4 px-4 py-3 bg-surface-container-low hover:bg-surface-container/90 border border-outline-variant/60 hover:border-outline/40 rounded-xl transition-all duration-200">
        {header}
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="default" size="sm">
            {noteCount} {noteCount === 1 ? "Note" : "Notes"}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            iconPosition="right"
            icon={<ArrowRightIcon size={13} />}
            onClick={() => router.push(`/subsection?id=${subsection.id}`)}
          >
            Browse
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex flex-col bg-surface-container-low hover:bg-surface-container/90 border border-outline-variant/60 hover:border-outline/40 rounded-xl overflow-hidden shadow-sm transition-all duration-200">
      {/* Card Header */}
      <div className="p-5 pb-4 space-y-3">
        {header}
        <div className="flex items-center gap-2">
          <Badge variant="custom" color={color} size="sm">
            {noteCount} {noteCount === 1 ? "Note" : "Notes"}
          </Badge>
        </div>
      </div>

      {/* Note Preview Strip */}
      <div className="px-5 pb-4 flex-1">
        {noteCount > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {subsection.notes.slice(0, 4).map((note) => (
              <NotePreviewTile
                key={note.id}
                subsectionId={subsection.id}
                title={note.title}
                content={note.content}
              />
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-surface-container-lowest border border-outline-variant/30 border-dashed text-center space-y-2">
            <p className="font-sans text-xs text-outline italic">
              No notes yet in this subsection.
            </p>
          </div>
        )}
        {noteCount > 4 && (
          <p className="font-mono text-[11px] text-outline mt-2">
            +{noteCount - 4} more {noteCount - 4 === 1 ? "note" : "notes"} in this subsection
          </p>
        )}
      </div>

      {/* Card Action Bar */}
      <div className="px-5 py-2.5 bg-surface-container-lowest/80 border-t border-outline-variant/40 flex items-center justify-between gap-2">
        <Link
          href={`/subsection?id=${subsection.id}`}
          className="font-mono text-xs text-primary hover:text-primary-fixed flex items-center gap-1 font-medium transition-colors"
        >
          <span>
            Browse {noteCount} {noteCount === 1 ? "Note" : "Notes"}
          </span>
          <ArrowRightIcon size={14} />
        </Link>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            icon={<PlusIcon size={13} />}
            onClick={() => setIsQuickAddOpen(true)}
          >
            Add Note
          </Button>
        </div>
      </div>

      {isQuickAddOpen && (
        <QuickAddNoteDialog
          subsection={subsection}
          onClose={() => setIsQuickAddOpen(false)}
          onSubmit={onAddNote}
        />
      )}
    </div>
  );
}
