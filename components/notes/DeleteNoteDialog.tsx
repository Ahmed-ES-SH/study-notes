"use client";

import React, { useState, useEffect } from "react";
import { Dialog } from "../common/Dialog";
import { Button } from "../common/Button";
import { Note, NoteCascadeInfo } from "../../lib/api/types";
import { getNoteCascadeInfo } from "../../lib/api/notes";
import { AlertTriangleIcon, TrashIcon } from "../common/Icons";

export interface DeleteNoteDialogProps {
  isOpen: boolean;
  note: Note | null;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}

function DeleteNoteContent({
  note,
  onClose,
  onConfirm,
}: {
  note: Note;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}) {
  const [cascadeInfo, setCascadeInfo] = useState<NoteCascadeInfo | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getNoteCascadeInfo(note.id)
      .then((info) => {
        if (isMounted) {
          setCascadeInfo(info);
          setIsLoadingCounts(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Failed to load cascade info:", err);
          setCascadeInfo({ asset_count: 0 });
          setIsLoadingCounts(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [note.id]);

  const assetCount = cascadeInfo?.asset_count ?? 0;

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm(note.id);
      onClose();
    } catch (err) {
      console.error("Failed to delete note:", err);
      setError(err instanceof Error ? err.message : "Failed to delete note");
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
          <h4 className="font-semibold text-red-200">Permanent Deletion</h4>
          <p className="text-red-300/80 leading-relaxed">
            Are you sure you want to delete note{" "}
            <span className="font-semibold text-white">“{note.title}”</span>?
            {isLoadingCounts ? (
              <span> This will permanently delete this note…</span>
            ) : assetCount > 0 ? (
              <span>
                {" "}
                This will permanently delete this note and{" "}
                <span className="font-semibold text-red-200">
                  {assetCount} attached{" "}
                  {assetCount === 1 ? "image/media file" : "images/media files"}
                </span>
                .
              </span>
            ) : (
              <span>
                {" "}
                This will permanently delete this note. It has no attached
                media files.
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
            <svg className="animate-spin h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Checking attached media files...</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-center">
            <div className="p-2.5 rounded bg-surface-container-low border border-outline-variant/40">
              <div className="text-lg font-bold text-on-surface">1</div>
              <div className="text-[10px] text-outline uppercase">Note</div>
            </div>
            <div className="p-2.5 rounded bg-surface-container-low border border-outline-variant/40">
              <div className="text-lg font-bold text-on-surface">{assetCount}</div>
              <div className="text-[10px] text-outline uppercase">
                {assetCount === 1 ? "Asset" : "Assets"}
              </div>
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
          Delete Note and Assets
        </Button>
      </div>
    </div>
  );
}

export function DeleteNoteDialog({
  isOpen,
  note,
  onClose,
  onConfirm,
}: DeleteNoteDialogProps) {
  if (!isOpen || !note) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Note"
      maxWidth="md"
    >
      <DeleteNoteContent
        key={note.id}
        note={note}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    </Dialog>
  );
}
