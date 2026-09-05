"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "../common/Dialog";
import { Input } from "../common/Input";
import { Button } from "../common/Button";
import { Badge } from "../common/Badge";
import { PlusIcon, ArrowRightIcon } from "../common/Icons";
import { Note } from "../../lib/api/types";

export interface CreateNoteModalProps {
  isOpen: boolean;
  subsectionName: string;
  subsectionColor: string;
  onClose: () => void;
  onSubmit: (title: string) => Promise<Note>;
}

function CreateNoteForm({
  subsectionName,
  subsectionColor,
  onClose,
  onSubmit,
}: {
  subsectionName: string;
  subsectionColor: string;
  onClose: () => void;
  onSubmit: (title: string) => Promise<Note>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [openInEditor, setOpenInEditor] = useState(true);
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
      const created = await onSubmit(trimmed);
      onClose();
      if (openInEditor) {
        router.push(`/editor?id=${created.id}`);
      }
    } catch (err) {
      console.error("Failed to create note:", err);
      setError(err instanceof Error ? err.message : "Failed to create note");
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex items-center gap-2 font-mono text-xs text-outline">
        <span>Creating inside</span>
        <Badge variant="custom" color={subsectionColor} dot size="sm">
          {subsectionName}
        </Badge>
      </div>

      <Input
        label="Note Title"
        placeholder="e.g. Closures & Scope, Event Loop Basics"
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

      {/* Create-and-open-editor option */}
      <label className="flex items-center gap-2.5 cursor-pointer select-none group">
        <input
          type="checkbox"
          checked={openInEditor}
          onChange={(e) => setOpenInEditor(e.target.checked)}
          disabled={isSubmitting}
          className="w-3.5 h-3.5 rounded accent-[#418fff] cursor-pointer"
        />
        <span className="font-sans text-xs text-on-surface-variant group-hover:text-on-surface transition-colors flex items-center gap-1.5">
          Jump straight into the editor after creating
          <ArrowRightIcon size={12} className="text-outline" />
        </span>
      </label>

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
          icon={<PlusIcon size={14} />}
          isLoading={isSubmitting}
        >
          Create Note
        </Button>
      </div>
    </form>
  );
}

export function CreateNoteModal({
  isOpen,
  subsectionName,
  subsectionColor,
  onClose,
  onSubmit,
}: CreateNoteModalProps) {
  if (!isOpen) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Note"
      description="Write a new study note inside this subsection."
      maxWidth="md"
    >
      <CreateNoteForm
        key={String(isOpen)}
        subsectionName={subsectionName}
        subsectionColor={subsectionColor}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    </Dialog>
  );
}
