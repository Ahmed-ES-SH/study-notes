"use client";

import React, { useState, useEffect } from "react";
import { Dialog } from "../common/Dialog";
import { Button } from "../common/Button";
import { Subsection, SubsectionCascadeInfo } from "../../lib/api/types";
import { getSubsectionCascadeInfo } from "../../lib/api/subsections";
import { AlertTriangleIcon, TrashIcon } from "../common/Icons";

export interface DeleteSubsectionDialogProps {
  isOpen: boolean;
  subsection: Subsection | null;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}

function DeleteSubsectionContent({
  subsection,
  onClose,
  onConfirm,
}: {
  subsection: Subsection;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}) {
  const [cascadeInfo, setCascadeInfo] = useState<SubsectionCascadeInfo | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getSubsectionCascadeInfo(subsection.id)
      .then((info) => {
        if (isMounted) {
          setCascadeInfo(info);
          setIsLoadingCounts(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Failed to load cascade info:", err);
          setCascadeInfo({ note_count: 0, asset_count: 0 });
          setIsLoadingCounts(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [subsection.id]);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm(subsection.id);
      onClose();
    } catch (err) {
      console.error("Failed to delete subsection:", err);
      setError(err instanceof Error ? err.message : "Failed to delete subsection");
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Warning Banner */}
      <div className="p-4 rounded-lg bg-red-950/30 border border-red-800/40 flex items-start gap-3">
        <div className="p-2 rounded bg-red-900/50 text-error shrink-0 mt-0.5">
          <AlertTriangleIcon size={20} />
        </div>
        <div className="space-y-1 text-sm">
          <h4 className="font-semibold text-red-200">Permanent Cascade Deletion</h4>
          <p className="text-red-300/80 leading-relaxed">
            Are you sure you want to delete subsection{" "}
            <span className="font-semibold text-white">“{subsection.name}”</span>?
            This will permanently delete{" "}
            <span className="font-semibold text-red-200">
              {isLoadingCounts ? "…" : (cascadeInfo?.note_count ?? 0)}{" "}
              {(cascadeInfo?.note_count ?? 0) === 1 ? "note" : "notes"}
            </span>{" "}
            and all attached media files. This action cannot be undone.
          </p>
        </div>
      </div>

      {/* Impact Breakdown */}
      <div className="p-4 rounded-lg bg-surface-container border border-outline-variant/60 space-y-2.5">
        <div className="text-xs font-mono font-medium text-outline uppercase tracking-wider">
          Cascade Impact Summary
        </div>
        {isLoadingCounts ? (
          <div className="flex items-center gap-2 text-xs text-outline py-2">
            <svg className="animate-spin h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Calculating child records...</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-center">
            <div className="p-2.5 rounded bg-surface-container-low border border-outline-variant/40">
              <div className="text-lg font-bold text-on-surface">
                {cascadeInfo?.note_count ?? 0}
              </div>
              <div className="text-[10px] text-outline uppercase">Notes</div>
            </div>
            <div className="p-2.5 rounded bg-surface-container-low border border-outline-variant/40">
              <div className="text-lg font-bold text-on-surface">
                {cascadeInfo?.asset_count ?? 0}
              </div>
              <div className="text-[10px] text-outline uppercase">Assets</div>
            </div>
          </div>
        )}
      </div>

      {error && <span className="font-mono text-xs text-error">{error}</span>}

      <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-outline-variant/50">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={isDeleting}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="danger-solid"
          icon={<TrashIcon size={14} />}
          isLoading={isDeleting}
          onClick={handleDelete}
        >
          Delete Subsection and Notes
        </Button>
      </div>
    </div>
  );
}

export function DeleteSubsectionDialog({
  isOpen,
  subsection,
  onClose,
  onConfirm,
}: DeleteSubsectionDialogProps) {
  if (!isOpen || !subsection) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Subsection"
      maxWidth="md"
    >
      <DeleteSubsectionContent
        key={subsection.id}
        subsection={subsection}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    </Dialog>
  );
}
