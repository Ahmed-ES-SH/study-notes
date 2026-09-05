"use client";

import React from "react";
import Link from "next/link";
import { Note } from "../../lib/api/types";
import { formatRelativeTime } from "../../lib/utils/format";
import { ClockIcon, EditIcon, TrashIcon, ArrowRightIcon } from "../common/Icons";

export interface NoteCardProps {
  note: Note;
  onRename: (note: Note) => void;
  onDelete: (note: Note) => void;
}

// Reduce raw markdown to a readable plain-text preview for the card snippet.
function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?(```|$)/g, " ") // fenced code blocks
    .replace(/`([^`]*)`/g, "$1") // inline code
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images → alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → link text
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/^\s*>\s?/gm, "") // blockquotes
    .replace(/^\s*[-*+]\s+/gm, "") // unordered list bullets
    .replace(/^\s*\d+\.\s+/gm, "") // ordered list markers
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
    .replace(/(\*|_)(.*?)\1/g, "$2") // italic
    .replace(/~~(.*?)~~/g, "$1") // strikethrough
    .replace(/==([^=]*)==/g, "$1") // highlights
    .replace(/\s*[-*_]{3,}\s*/g, " ") // horizontal rules
    .replace(/[\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function getSnippet(content: string, maxLength = 100): string {
  const plain = stripMarkdown(content);
  if (!plain) return "Empty note — no content yet.";
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength).trimEnd()}…`;
}

export function NoteCard({ note, onRename, onDelete }: NoteCardProps) {
  return (
    <div className="group flex flex-col gap-3 p-5 bg-surface-container-low hover:bg-surface-container/90 border border-outline-variant/60 hover:border-outline/40 rounded-xl shadow-sm transition-all duration-200">
      {/* Title & Metadata Row */}
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/editor?id=${note.id}`}
          className="font-sans text-xl font-semibold text-on-surface hover:text-primary transition-colors leading-snug min-w-0"
          title={note.title}
        >
          {note.title || "Untitled note"}
        </Link>
        <div className="flex items-center gap-1 font-mono text-xs text-outline shrink-0 pt-1">
          <ClockIcon size={12} />
          <span title={new Date(note.updated_at).toLocaleString()}>
            {formatRelativeTime(note.updated_at)}
          </span>
        </div>
      </div>

      {/* Plain-text Snippet Preview */}
      <p className="font-sans text-xs text-outline leading-relaxed line-clamp-2">
        {getSnippet(note.content)}
      </p>

      {/* Action Bar */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-outline-variant/40">
        <Link
          href={`/editor?id=${note.id}`}
          className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:text-primary-fixed font-medium transition-colors"
        >
          <span>Open</span>
          <ArrowRightIcon size={13} />
        </Link>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onRename(note)}
            className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded font-mono text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high border border-transparent hover:border-outline-variant/40 transition-colors cursor-pointer"
            title="Rename note title"
          >
            <EditIcon size={13} />
            Rename
          </button>
          <button
            type="button"
            onClick={() => onDelete(note)}
            className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded font-mono text-xs text-on-surface-variant hover:text-error hover:bg-red-950/40 border border-transparent hover:border-error/40 transition-colors cursor-pointer"
            title="Delete note"
          >
            <TrashIcon size={13} />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
