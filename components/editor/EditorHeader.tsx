"use client";

import React from "react";
import Link from "next/link";
import { EditorMode, SaveStatus } from "../../lib/api/types";
import {
  BookIcon,
  CheckIcon,
  ChevronRightIcon,
  PanelRightIcon,
  TrashIcon,
} from "../common/Icons";

export interface EditorBreadcrumb {
  label: string;
  href?: string;
  color?: string;
}

export type EditorViewMode = Exclude<EditorMode, "zen">;

export interface EditorHeaderProps {
  breadcrumbs: EditorBreadcrumb[];
  saveStatus: SaveStatus;
  mode: EditorViewMode;
  onModeChange: (mode: EditorViewMode) => void;
  onEnterZen: () => void;
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
  onSaveAndClose: () => void;
  onDelete: () => void;
  isBusy?: boolean;
}

const VIEW_MODES: { value: EditorViewMode; label: string }[] = [
  { value: "edit", label: "Edit" },
  { value: "split", label: "Split" },
  { value: "preview", label: "Preview" },
];

function SaveStatusBadge({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return (
      <div
        className="flex items-center gap-1.5 font-mono text-[11px] text-accent-amber"
        title="Saving changes to local database"
      >
        <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span>Saving...</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 font-mono text-[11px] text-accent-green"
      title="All changes saved to local database"
    >
      <CheckIcon size={13} />
      <span>Saved</span>
    </div>
  );
}

export function EditorHeader({
  breadcrumbs,
  saveStatus,
  mode,
  onModeChange,
  onEnterZen,
  isInspectorOpen,
  onToggleInspector,
  onSaveAndClose,
  onDelete,
  isBusy = false,
}: EditorHeaderProps) {
  return (
    <div className="sticky top-14 z-30 w-full bg-surface-container-lowest/90 backdrop-blur-md border-b border-outline-variant/40 px-4 lg:px-6 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      {/* Breadcrumb trail + save indicator */}
      <div className="flex items-center gap-3 min-w-0">
        <nav className="flex items-center gap-1.5 font-mono text-[11px] text-outline truncate">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            const content = (
              <span
                className={`truncate flex items-center gap-1.5 ${
                  isLast
                    ? "text-primary font-semibold"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {crumb.color && (
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: crumb.color }}
                  />
                )}
                {crumb.label}
              </span>
            );
            return (
              <React.Fragment key={`${crumb.label}-${index}`}>
                {isLast || !crumb.href ? (
                  content
                ) : (
                  <Link href={crumb.href} className="shrink-0">
                    {content}
                  </Link>
                )}
                {!isLast && (
                  <ChevronRightIcon size={11} className="text-outline-variant shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </nav>

        <div className="h-4 w-px bg-outline-variant/50 shrink-0" />
        <SaveStatusBadge status={saveStatus} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* View mode toggle */}
        <div className="flex items-center bg-surface-container rounded p-0.5 border border-outline-variant/40">
          {VIEW_MODES.map((vm) => (
            <button
              key={vm.value}
              type="button"
              onClick={() => onModeChange(vm.value)}
              className={`px-2 py-0.5 rounded font-mono text-[11px] transition-colors cursor-pointer ${
                mode === vm.value
                  ? "bg-surface-container-highest text-primary font-semibold"
                  : "text-outline hover:text-on-surface hover:bg-surface-container-high"
              }`}
              title={`${vm.value} view`}
            >
              {vm.label}
            </button>
          ))}
        </div>

        {/* Zen / focus mode */}
        <button
          type="button"
          onClick={onEnterZen}
          className="flex items-center gap-1 px-2 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-mono text-[11px] border border-outline-variant/40 transition-colors cursor-pointer"
          title="Distraction-free focus mode"
        >
          <BookIcon size={13} />
          <span>Zen</span>
        </button>

        {/* Inspector drawer toggle */}
        <button
          type="button"
          onClick={onToggleInspector}
          className={`p-1.5 rounded border transition-colors cursor-pointer ${
            isInspectorOpen
              ? "bg-surface-container-high text-primary border-outline-variant/60"
              : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-primary border-outline-variant/40"
          }`}
          title="Toggle outline & media drawer"
        >
          <PanelRightIcon size={14} />
        </button>

        <div className="h-4 w-px bg-outline-variant/50 mx-0.5" />

        {/* Delete note */}
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 rounded bg-surface-container hover:bg-error/20 text-outline hover:text-error border border-outline-variant/40 transition-colors cursor-pointer"
          title="Delete note"
        >
          <TrashIcon size={14} />
        </button>

        {/* Save & close */}
        <button
          type="button"
          onClick={onSaveAndClose}
          disabled={isBusy}
          className="flex items-center gap-1 px-3 py-1 rounded bg-primary-container hover:bg-primary text-on-primary font-mono text-[11px] font-semibold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          title="Flush pending changes and return to notes list (Ctrl+S saves without leaving)"
        >
          <CheckIcon size={12} />
          <span>Save & Close</span>
        </button>
      </div>
    </div>
  );
}
