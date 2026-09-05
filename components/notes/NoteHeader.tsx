"use client";

import React from "react";
import Link from "next/link";
import { Subsection, MainSection } from "../../lib/api/types";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { ChevronRightIcon, PlusIcon } from "../common/Icons";

export interface NoteHeaderProps {
  subsection: Subsection;
  mainSection: MainSection | null;
  noteCount: number;
  onCreateNote: () => void;
}

export function NoteHeader({
  subsection,
  mainSection,
  noteCount,
  onCreateNote,
}: NoteHeaderProps) {
  const accentColor = mainSection?.color ?? "#8b919f";

  return (
    <div
      className="relative p-6 rounded-xl bg-surface-container-low border border-outline-variant/50 overflow-hidden space-y-4"
      style={{
        background: `linear-gradient(135deg, ${accentColor}0d 0%, rgba(20, 28, 36, 0) 60%), #141c24`,
      }}
    >
      {/* Breadcrumb Trail */}
      <nav className="flex items-center gap-1.5 font-mono text-[11px] text-outline min-w-0">
        <Link
          href="/"
          className="hover:text-on-surface transition-colors"
        >
          Main Sections
        </Link>
        <ChevronRightIcon size={11} className="text-outline/60 shrink-0" />
        {mainSection ? (
          <Link
            href={`/section?id=${mainSection.id}`}
            className="hover:text-on-surface transition-colors flex items-center gap-1.5 min-w-0"
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: mainSection.color }}
            />
            <span className="truncate max-w-[160px]">{mainSection.name}</span>
          </Link>
        ) : (
          <span>Main Sections</span>
        )}
        <ChevronRightIcon size={11} className="text-outline/60 shrink-0" />
        <span className="text-on-surface font-semibold truncate max-w-[200px]">
          {subsection.name}
        </span>
      </nav>

      {/* Header Block */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <h1 className="font-sans text-2xl sm:text-3xl font-bold text-on-surface tracking-tight truncate">
            {subsection.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="custom" color={accentColor} dot size="sm">
              {noteCount} {noteCount === 1 ? "Note" : "Notes"}
            </Badge>
            <Badge variant="outline" size="sm">
              Offline • SQLite
            </Badge>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={<PlusIcon size={13} />}
          onClick={onCreateNote}
          className="shrink-0"
        >
          New Note
        </Button>
      </div>
    </div>
  );
}
