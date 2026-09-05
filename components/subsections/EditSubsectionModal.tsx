"use client";

import React, { useState } from "react";
import { Dialog } from "../common/Dialog";
import { Input } from "../common/Input";
import { Button } from "../common/Button";
import { Subsection } from "../../lib/api/types";
import { EditIcon } from "../common/Icons";

export interface EditSubsectionModalProps {
  isOpen: boolean;
  subsection: Subsection | null;
  onClose: () => void;
  onSubmit: (id: string, name: string) => Promise<void>;
}

function EditSubsectionForm({
  subsection,
  onClose,
  onSubmit,
}: {
  subsection: Subsection;
  onClose: () => void;
  onSubmit: (id: string, name: string) => Promise<void>;
}) {
  const [name, setName] = useState(subsection.name);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Subsection name is required");
      return;
    }
    if (trimmed.length > 60) {
      setError("Subsection name must be 60 characters or fewer");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(subsection.id, trimmed);
      onClose();
    } catch (err) {
      console.error("Failed to rename subsection:", err);
      setError(err instanceof Error ? err.message : "Failed to rename subsection");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Input
        label="Subsection Name"
        placeholder="Subsection name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (error) setError(null);
        }}
        error={error || undefined}
        maxLength={60}
        autoFocus
        disabled={isSubmitting}
      />

      <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-outline-variant/50">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          icon={<EditIcon size={14} />}
          isLoading={isSubmitting}
        >
          Save Changes
        </Button>
      </div>
    </form>
  );
}

export function EditSubsectionModal({
  isOpen,
  subsection,
  onClose,
  onSubmit,
}: EditSubsectionModalProps) {
  if (!isOpen || !subsection) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Rename Subsection"
      description="Update the title of this subsection."
      maxWidth="md"
    >
      <EditSubsectionForm
        key={subsection.id + subsection.updated_at}
        subsection={subsection}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    </Dialog>
  );
}
