"use client";

import React, { useState, useEffect } from "react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { CascadeDeleteTarget } from "../../lib/api/types";
import { AlertTriangleIcon, TrashIcon } from "./Icons";

export interface CascadeDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with `target.id`; must resolve for the dialog to close. */
  onConfirm: (id: string) => Promise<void>;
  target: CascadeDeleteTarget | null;
  /** Fetches the live cascade impact counts for the target. */
  fetchCounts: (
    id: string
  ) => Promise<{
    subsection_count?: number;
    note_count?: number;
    asset_count?: number;
  }>;
  /** Dialog title, e.g. "Delete Main Section". */
  title: string;
  /** Confirm button copy, e.g. "Delete Section and All Contents". */
  confirmLabel: string;
  /** Sentence describing what gets destroyed, e.g. "section". */
  noun: string;
}

type Counts = { subsection_count?: number; note_count?: number; asset_count?: number };

const LOADER_SPINNER = (
  <svg className="animate-spin h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

/**
 * Unified cascade-delete confirmation across all three deletion tiers
 * (Main Section / Subsection / Note): standardized hazard copy, live
 * child-count badge pills, and a loading state that blocks duplicate
 * confirm clicks during the destructive IPC call.
 */
export function CascadeDeleteDialog({
  isOpen,
  onClose,
  onConfirm,
  target,
  fetchCounts,
  title,
  confirmLabel,
  noun,
}: CascadeDeleteDialogProps) {
  if (!isOpen || !target) return null;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={title} maxWidth="md">
      <CascadeDeleteContent
        key={target.id}
        target={target}
        onClose={onClose}
        onConfirm={onConfirm}
        fetchCounts={fetchCounts}
        confirmLabel={confirmLabel}
        noun={noun}
      />
    </Dialog>
  );
}

function CascadeDeleteContent({
  target,
  onClose,
  onConfirm,
  fetchCounts,
  confirmLabel,
  noun,
}: Omit<CascadeDeleteDialogProps, "isOpen" | "title"> & { target: CascadeDeleteTarget }) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchCounts(target.id)
      .then((result) => {
        if (isMounted) {
          setCounts(result);
          setIsLoadingCounts(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Failed to load cascade counts:", err);
          setCounts({});
          setIsLoadingCounts(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [target.id, fetchCounts]);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm(target.id);
      onClose();
    } catch (err) {
      console.error(`Failed to delete ${noun}:`, err);
      setError(err instanceof Error ? err.message : `Failed to delete ${noun}`);
      setIsDeleting(false);
    }
  };

  const badges: { label: string; value: number }[] = [];
  if (target.type === "main_section") {
    badges.push({ label: "Subsections", value: counts?.subsection_count ?? 0 });
  }
  if (target.type !== "note") {
    badges.push({ label: "Notes", value: counts?.note_count ?? 0 });
  }
  badges.push({ label: "Assets", value: counts?.asset_count ?? 0 });

  const hasChildren = badges.some((b) => b.value > 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Warning Banner */}
      <div className="p-4 rounded-lg border border-accent-rose/40 bg-accent-rose/5 flex items-start gap-3">
        <div className="p-2 rounded bg-accent-rose/15 text-accent-rose shrink-0 mt-0.5 border border-accent-rose/30">
          <AlertTriangleIcon size={20} />
        </div>
        <div className="space-y-1 text-sm">
          <h4 className="font-semibold text-on-surface">Permanent Deletion</h4>
          <p className="text-on-surface-variant leading-relaxed">
            Are you sure you want to delete {noun}{" "}
            <span className="font-semibold text-on-surface">“{target.name}”</span>?
            {isLoadingCounts ? (
              <span> Calculating what will be removed…</span>
            ) : hasChildren ? (
              <span>
                {" "}
                This permanently removes the {noun} and{" "}
                <span className="font-semibold text-accent-rose">
                  everything nested inside it
                </span>
                , including media files on disk.
              </span>
            ) : (
              <span>
                {" "}
                This {noun} has no children — only its own record is removed.
              </span>
            )}{" "}
            This action cannot be undone.
          </p>
        </div>
      </div>

      {/* Cascade Impact Summary */}
      <div className="p-4 rounded-lg bg-surface-container border border-outline-variant/60 space-y-2.5">
        <div className="text-xs font-mono font-medium text-outline uppercase tracking-wider">
          Cascade Impact Summary
        </div>
        {isLoadingCounts ? (
          <div className="flex items-center gap-2 text-xs text-outline py-2">
            {LOADER_SPINNER}
            <span>Calculating child records...</span>
          </div>
        ) : hasChildren ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {badges.map((badge) => (
              <span
                key={badge.label}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-mono text-xs font-bold ${
                  badge.value > 0
                    ? "bg-surface-container-low border-accent-rose/40 text-on-surface"
                    : "bg-surface-container-low border-outline-variant/40 text-outline"
                }`}
              >
                <span>{badge.value}</span>
                <span className="font-medium text-[10px] uppercase text-outline">
                  {badge.label}
                </span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-outline italic">
            Nothing nested inside — safe to remove.
          </p>
        )}
      </div>

      {error && <span className="font-mono text-xs text-error">{error}</span>}

      <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-outline-variant/50">
        <Button type="button" variant="ghost" onClick={onClose} disabled={isDeleting}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="danger-solid"
          icon={<TrashIcon size={14} />}
          isLoading={isDeleting}
          onClick={handleDelete}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
