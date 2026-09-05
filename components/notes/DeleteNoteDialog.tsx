"use client";

import React from "react";
import { CascadeDeleteDialog } from "../common/CascadeDeleteDialog";
import { Note } from "../../lib/api/types";
import { getNoteCascadeInfo } from "../../lib/api/notes";

export interface DeleteNoteDialogProps {
  isOpen: boolean;
  note: Note | null;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}

export function DeleteNoteDialog({
  isOpen,
  note,
  onClose,
  onConfirm,
}: DeleteNoteDialogProps) {
  return (
    <CascadeDeleteDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      target={note ? { type: "note", id: note.id, name: note.title } : null}
      fetchCounts={getNoteCascadeInfo}
      title="Delete Note"
      confirmLabel="Delete Note and Assets"
      noun="note"
    />
  );
}
