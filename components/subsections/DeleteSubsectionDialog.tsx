"use client";

import React from "react";
import { CascadeDeleteDialog } from "../common/CascadeDeleteDialog";
import { Subsection } from "../../lib/api/types";
import { getSubsectionCascadeInfo } from "../../lib/api/subsections";

export interface DeleteSubsectionDialogProps {
  isOpen: boolean;
  subsection: Subsection | null;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}

export function DeleteSubsectionDialog({
  isOpen,
  subsection,
  onClose,
  onConfirm,
}: DeleteSubsectionDialogProps) {
  return (
    <CascadeDeleteDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      target={
        subsection
          ? { type: "subsection", id: subsection.id, name: subsection.name }
          : null
      }
      fetchCounts={getSubsectionCascadeInfo}
      title="Delete Subsection"
      confirmLabel="Delete Subsection and Notes"
      noun="subsection"
    />
  );
}
