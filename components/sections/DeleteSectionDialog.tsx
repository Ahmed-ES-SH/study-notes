"use client";

import React, { useState, useEffect } from "react";
import { Dialog } from "../common/Dialog";
import { Button } from "../common/Button";
import { MainSection, CascadeCounts } from "../../lib/api/types";
import { getMainSectionCascadeInfo } from "../../lib/api/sections";
import { AlertTriangleIcon, TrashIcon } from "../common/Icons";

export interface DeleteSectionDialogProps {
  isOpen: boolean;
  section: MainSection | null;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}

function DeleteSectionContent({
  section,
  onClose,
  onConfirm,
}: {
  section: MainSection;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}) {
  const [cascadeCounts, setCascadeCounts] = useState<CascadeCounts | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getMainSectionCascadeInfo(section.id)
      .then((counts) => {
        if (isMounted) {
          setCascadeCounts(counts);
          setIsLoadingCounts(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Failed to load cascade counts:", err);
          setCascadeCounts({ subsection_count: 0, note_count: 0, asset_count: 0 });
          setIsLoadingCounts(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [section.id]);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm(section.id);
      onClose();
    } catch (err) {
      console.error("Failed to delete section:", err);
      setError(err instanceof Error ? err.message : "Failed to delete section");
      setIsDeleting(false);
    }
  };

  const hasChildren =
    cascadeCounts &&
    (cascadeCounts.subsection_count > 0 ||
      cascadeCounts.note_count > 0 ||
      cascadeCounts.asset_count > 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Warning Banner */}
      <div className="p-4 rounded-lg bg-red-950/30 border border-red-800/40 flex items-start gap-3">
        <div className="p-2 rounded bg-red-900/50 text-error shrink-0 mt-0.5">
          <AlertTriangleIcon size={20} />
        </div>
        <div className="space-y-1 text-sm">
          <h4 className="font-semibold text-red-200">
            Permanent Cascade Deletion
          </h4>
          <p className="text-red-300/80 leading-relaxed">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-white">“{section.name}”</span>?
            This action is destructive and cannot be undone.
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
        ) : hasChildren ? (
          <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-center">
            <div className="p-2.5 rounded bg-surface-container-low border border-outline-variant/40">
              <div className="text-lg font-bold text-on-surface">
                {cascadeCounts?.subsection_count ?? 0}
              </div>
              <div className="text-[10px] text-outline uppercase">Subsections</div>
            </div>
            <div className="p-2.5 rounded bg-surface-container-low border border-outline-variant/40">
              <div className="text-lg font-bold text-on-surface">
                {cascadeCounts?.note_count ?? 0}
              </div>
              <div className="text-[10px] text-outline uppercase">Notes</div>
            </div>
            <div className="p-2.5 rounded bg-surface-container-low border border-outline-variant/40">
              <div className="text-lg font-bold text-on-surface">
                {cascadeCounts?.asset_count ?? 0}
              </div>
              <div className="text-[10px] text-outline uppercase">Assets</div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-outline italic">
            This section is empty (0 subsections, 0 notes).
          </p>
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
          Delete Section and All Contents
        </Button>
      </div>
    </div>
  );
}

export function DeleteSectionDialog({
  isOpen,
  section,
  onClose,
  onConfirm,
}: DeleteSectionDialogProps) {
  if (!isOpen || !section) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Main Section"
      maxWidth="md"
    >
      <DeleteSectionContent
        key={section.id}
        section={section}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    </Dialog>
  );
}
