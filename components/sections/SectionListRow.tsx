"use client";

import React from "react";
import Link from "next/link";
import { SectionWithStats } from "../../lib/hooks/useMainSections";
import { formatRelativeTime } from "../../lib/utils/format";
import { ClockIcon, EditIcon, TrashIcon, ArrowRightIcon } from "../common/Icons";
import { DragHandle } from "../common/DragHandle";

export interface SectionListRowProps {
  section: SectionWithStats;
  onEdit: (section: SectionWithStats) => void;
  onDelete: (section: SectionWithStats) => void;
  dragHandleProps?: {
    onGrabStart: () => void;
    onGrabEnd: () => void;
  };
  isDragging?: boolean;
}

export function SectionListRow({
  section,
  onEdit,
  onDelete,
  dragHandleProps,
  isDragging,
}: SectionListRowProps) {
  const noteCount = section.stats?.note_count ?? 0;
  const subCount = section.stats?.subsection_count ?? (section.subsections?.length ?? 0);

  return (
    <div className="group flex items-center justify-between px-4 py-3 bg-surface-container-low hover:bg-surface-container border border-outline-variant/50 hover:border-outline/40 rounded-lg transition-all">
      {/* Left: Indicator, Title, Stats */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {dragHandleProps && (
          <DragHandle
            onGrabStart={dragHandleProps.onGrabStart}
            onGrabEnd={dragHandleProps.onGrabEnd}
            isDragging={isDragging}
            label={`Drag to reorder ${section.name}`}
          />
        )}
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-surface-container-high"
          style={{ backgroundColor: section.color }}
        />
        <div className="min-w-0 flex-1">
          <Link
            href={`/section?id=${section.id}`}
            className="font-sans font-medium text-sm text-on-surface hover:text-primary transition-colors truncate block"
          >
            {section.name}
          </Link>
          <div className="flex items-center gap-3 font-mono text-[11px] text-outline mt-0.5">
            <span>{subCount} {subCount === 1 ? "subsection" : "subsections"}</span>
            <span>•</span>
            <span>{noteCount} {noteCount === 1 ? "note" : "notes"}</span>
          </div>
        </div>
      </div>

      {/* Right: Time, Action buttons, Open Stream */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden sm:flex items-center gap-1 font-mono text-xs text-outline">
          <ClockIcon size={12} />
          <span>{formatRelativeTime(section.updated_at)}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(section)}
            className="p-1.5 rounded text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors"
            title="Edit Section"
          >
            <EditIcon size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(section)}
            className="p-1.5 rounded text-outline hover:text-error hover:bg-red-950/40 transition-colors"
            title="Delete Section"
          >
            <TrashIcon size={14} />
          </button>
        </div>

        <Link
          href={`/section?id=${section.id}`}
          className="p-1.5 rounded text-outline hover:text-primary hover:bg-surface-container-high transition-colors"
          title="Open Stream"
        >
          <ArrowRightIcon size={16} />
        </Link>
      </div>
    </div>
  );
}
