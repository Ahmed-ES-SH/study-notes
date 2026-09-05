"use client";

import React from "react";
import { CascadeDeleteDialog } from "../common/CascadeDeleteDialog";
import { MainSection } from "../../lib/api/types";
import { getMainSectionCascadeInfo } from "../../lib/api/sections";

export interface DeleteSectionDialogProps {
  isOpen: boolean;
  section: MainSection | null;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}

export function DeleteSectionDialog({
  isOpen,
  section,
  onClose,
  onConfirm,
}: DeleteSectionDialogProps) {
  return (
    <CascadeDeleteDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      target={
        section
          ? { type: "main_section", id: section.id, name: section.name }
          : null
      }
      fetchCounts={getMainSectionCascadeInfo}
      title="Delete Main Section"
      confirmLabel="Delete Section and All Contents"
      noun="section"
    />
  );
}
