"use client";

import React, { useState } from "react";
import { Dialog } from "../common/Dialog";
import { Input } from "../common/Input";
import { Button } from "../common/Button";
import { Note } from "../../lib/api/types";
import { EditIcon } from "../common/Icons";

export interface EditNoteTitleModalProps {
  isOpen: boolean;
  note: Note | null;
  onClose: () => void;
  onSubmit: (id: string, title: string) => Promise<void>;
}

function EditNoteTitleForm({
  note,
  onClose,
  onSubmit,
}: {
  note: Note;
  onClose: () => void;
  onSubmit: (id: string, title: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(note.title);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Note title is required");
      return;
    }
    if (trimmed.length > 120) {
      setError("Note title must be 120 characters or fewer");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(note.id, trimmed);
      onClose();
    } catch (err) {
      console.error("Failed to rename note:", err);
      setError(err instanceof Error ? err.message : "Failed to rename note");
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Input
        label="Note Title"
        placeholder="Note title"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          if (error) setError(null);
        }}
        error={error || undefined}
        helperText="1–120 characters"
        maxLength={120}
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
          Save Title
        </Button>
      </div>
    </form>
  );
}

export function EditNoteTitleModal({
  isOpen,
  note,
  onClose,
  onSubmit,
}: EditNoteTitleModalProps) {
  if (!isOpen || !note) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Rename Note"
      description="Quickly update the title without opening the full editor."
      maxWidth="md"
    >
      <EditNoteTitleForm
        key={note.id + note.updated_at}
        note={note}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    </Dialog>
  );
}
