"use client";

import React, { useState } from "react";
import { Dialog } from "../common/Dialog";
import { Input } from "../common/Input";
import { Button } from "../common/Button";
import { ColorPicker, PRESET_COLORS } from "./ColorPicker";
import { PlusIcon } from "../common/Icons";

export interface CreateSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, color: string) => Promise<void>;
}

function CreateSectionForm({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (name: string, color: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0].hex);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Section name is required");
      return;
    }
    if (trimmed.length > 60) {
      setError("Section name must be 60 characters or fewer");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(trimmed, color);
      onClose();
    } catch (err) {
      console.error("Failed to create section:", err);
      setError(err instanceof Error ? err.message : "Failed to create section");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Input
        label="Section Name"
        placeholder="e.g. Distributed Systems, Rust Internals, React"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (error) setError(null);
        }}
        error={error || undefined}
        autoFocus
        disabled={isSubmitting}
      />

      <ColorPicker value={color} onChange={setColor} />

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
          Create Section
        </Button>
      </div>
    </form>
  );
}

export function CreateSectionModal({
  isOpen,
  onClose,
  onSubmit,
}: CreateSectionModalProps) {
  if (!isOpen) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Section"
      description="Define a top-level knowledge domain for your notes and technical topics."
      maxWidth="md"
    >
      <CreateSectionForm onClose={onClose} onSubmit={onSubmit} />
    </Dialog>
  );
}
