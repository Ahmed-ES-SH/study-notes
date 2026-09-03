"use client";

import React, { useState } from "react";
import { Dialog } from "../common/Dialog";
import { Input } from "../common/Input";
import { Button } from "../common/Button";
import { ColorPicker } from "./ColorPicker";
import { MainSection } from "../../lib/api/types";
import { EditIcon } from "../common/Icons";

export interface EditSectionModalProps {
  isOpen: boolean;
  section: MainSection | null;
  onClose: () => void;
  onSubmit: (id: string, name: string, color: string) => Promise<void>;
}

function EditSectionForm({
  section,
  onClose,
  onSubmit,
}: {
  section: MainSection;
  onClose: () => void;
  onSubmit: (id: string, name: string, color: string) => Promise<void>;
}) {
  const [name, setName] = useState(section.name);
  const [color, setColor] = useState(section.color);
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
      await onSubmit(section.id, trimmed, color);
      onClose();
    } catch (err) {
      console.error("Failed to update section:", err);
      setError(err instanceof Error ? err.message : "Failed to update section");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Input
        label="Section Name"
        placeholder="Section name"
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
          icon={<EditIcon size={14} />}
          isLoading={isSubmitting}
        >
          Save Changes
        </Button>
      </div>
    </form>
  );
}

export function EditSectionModal({
  isOpen,
  section,
  onClose,
  onSubmit,
}: EditSectionModalProps) {
  if (!isOpen || !section) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Section"
      description={`Update configuration and theme for ${section.name}.`}
      maxWidth="md"
    >
      <EditSectionForm
        key={section.id + section.updated_at}
        section={section}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    </Dialog>
  );
}
