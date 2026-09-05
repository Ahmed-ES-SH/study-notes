"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SectionWithStats } from "../../lib/hooks/useMainSections";
import { formatRelativeTime } from "../../lib/utils/format";
import {
  ClockIcon,
  EditIcon,
  TrashIcon,
  ArrowRightIcon,
  CodeIcon,
  PlusIcon,
} from "../common/Icons";
import { DragHandle } from "../common/DragHandle";

export interface SectionCardProps {
  section: SectionWithStats;
  onEdit: (section: SectionWithStats) => void;
  onDelete: (section: SectionWithStats) => void;
  onAddSubsection?: (sectionId: string) => void;
  /** Present while manual reordering is enabled for the grid. */
  dragHandleProps?: {
    onGrabStart: () => void;
    onGrabEnd: () => void;
  };
  isDragging?: boolean;
}

export function SectionCard({
  section,
  onEdit,
  onDelete,
  onAddSubsection,
  dragHandleProps,
  isDragging,
}: SectionCardProps) {
  const router = useRouter();
  const noteCount = section.stats?.note_count ?? 0;
  const subCount = section.stats?.subsection_count ?? (section.subsections?.length ?? 0);
  const previewSubs = section.subsections?.slice(0, 5) ?? [];

  return (
    <div className="group flex flex-col bg-surface-container-low hover:bg-surface-container/90 border border-outline-variant/60 hover:border-outline/40 rounded-xl overflow-hidden shadow-sm transition-all duration-200">
      {/* Top Card Body */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          {/* Header Row: Icon + Category + Title + Time + Context Actions */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              {dragHandleProps && (
                <DragHandle
                  onGrabStart={dragHandleProps.onGrabStart}
                  onGrabEnd={dragHandleProps.onGrabEnd}
                  isDragging={isDragging}
                  label={`Drag to reorder ${section.name}`}
                />
              )}

              {/* Domain Icon Box */}
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform border border-outline-variant/30 shadow-xs"
                style={{
                  backgroundColor: `${section.color}18`,
                  color: section.color,
                }}
              >
                <CodeIcon size={22} />
              </div>

              {/* Title & Accent Label */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: section.color }}
                  />
                  <span
                    className="font-mono text-[11px] uppercase tracking-wider font-semibold truncate"
                    style={{ color: section.color }}
                  >
                    Knowledge Domain
                  </span>
                </div>
                <Link
                  href={`/section?id=${section.id}`}
                  className="block font-sans font-semibold text-lg text-on-surface hover:text-primary transition-colors truncate"
                  title={section.name}
                >
                  {section.name}
                </Link>
              </div>
            </div>

            {/* Time & Action buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex items-center gap-1 font-mono text-xs text-outline mr-1">
                <ClockIcon size={12} />
                <span>{formatRelativeTime(section.updated_at)}</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(section);
                }}
                className="p-1.5 rounded text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors"
                title="Edit Section"
              >
                <EditIcon size={14} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(section);
                }}
                className="p-1.5 rounded text-outline hover:text-error hover:bg-red-950/40 transition-colors"
                title="Delete Section"
              >
                <TrashIcon size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Subsections Preview Pills */}
        <div className="space-y-2">
          <div className="flex items-center justify-between font-mono text-xs text-outline">
            <span>Subsections ({subCount})</span>
            <span className="text-outline-variant text-[11px]">
              {noteCount} {noteCount === 1 ? "note" : "notes"} total
            </span>
          </div>

          {previewSubs.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {previewSubs.map((sub) => (
                <Link
                  key={sub.id}
                  href={`/section?id=${section.id}#sub-${sub.id}`}
                  className="font-mono text-xs px-2 py-1 rounded bg-surface-container-high hover:bg-surface-bright text-on-surface-variant hover:text-on-surface border border-outline-variant/30 transition-colors truncate max-w-[200px]"
                >
                  {sub.name}
                </Link>
              ))}
              {subCount > 5 && (
                <span className="font-mono text-xs px-2 py-1 rounded bg-surface-container text-outline border border-outline-variant/30">
                  +{subCount - 5} more
                </span>
              )}
            </div>
          ) : (
            <p className="font-sans text-xs text-outline/80 italic py-1">
              No subsections created yet.
            </p>
          )}
        </div>
      </div>

      {/* Footer Action Bar */}
      <div className="px-5 py-2.5 bg-surface-container-lowest/80 border-t border-outline-variant/40 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (onAddSubsection) {
              onAddSubsection(section.id);
            } else {
              router.push(`/section?id=${section.id}`);
            }
          }}
          className="font-mono text-xs text-outline hover:text-primary flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Manage subsections"
        >
          <PlusIcon size={13} />
          <span>Subsection</span>
        </button>
        <Link
          href={`/section?id=${section.id}`}
          className="font-mono text-xs text-primary hover:text-primary-fixed flex items-center gap-1 font-medium transition-colors"
        >
          <span>Open Stream</span>
          <ArrowRightIcon size={14} />
        </Link>
      </div>
    </div>
  );
}
