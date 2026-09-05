"use client";

import React, { useState } from "react";
import { Dialog } from "../common/Dialog";
import { Input } from "../common/Input";
import { Button } from "../common/Button";
import { Badge } from "../common/Badge";
import { PlusIcon } from "../common/Icons";

export interface CreateSubsectionModalProps {
  isOpen: boolean;
  parentSectionName: string;
  parentSectionColor: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<unknown>;
}

function CreateSubsectionForm({
  parentSectionName,
  parentSectionColor,
  onClose,
  onSubmit,
}: {
  parentSectionName: string;
  parentSectionColor: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
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
      await onSubmit(trimmed);
      onClose();
    } catch (err) {
      console.error("Failed to create subsection:", err);
      setError(err instanceof Error ? err.message : "Failed to create subsection");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex items-center gap-2 font-mono text-xs text-outline">
        <span>Creating inside</span>
        <Badge variant="custom" color={parentSectionColor} dot size="sm">
          {parentSectionName}
        </Badge>
      </div>

      <Input
        label="Subsection Name"
        placeholder="e.g. Closures, Async Patterns, Hooks"
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
          icon={<PlusIcon size={14} />}
          isLoading={isSubmitting}
        >
          Create Subsection
        </Button>
      </div>
    </form>
  );
}

export function CreateSubsectionModal({
  isOpen,
  parentSectionName,
  parentSectionColor,
  onClose,
  onSubmit,
}: CreateSubsectionModalProps) {
  if (!isOpen) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Subsection"
      description="Group related notes under a topic inside this section."
      maxWidth="md"
    >
      <CreateSubsectionForm
        parentSectionName={parentSectionName}
        parentSectionColor={parentSectionColor}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    </Dialog>
  );
}
