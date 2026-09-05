"use client";

import React, { useRef, useState } from "react";
import { Asset } from "../../lib/api/types";
import { Dialog } from "../common/Dialog";
import { Button } from "../common/Button";
import { AlertTriangleIcon, ImageIcon, PlusIcon, TrashIcon } from "../common/Icons";

export interface AssetManagerModalProps {
  isOpen: boolean;
  assets: Asset[];
  onClose: () => void;
  onAttach: (fileName: string, fileBytes: number[], altText: string) => Promise<unknown>;
  onRemove: (asset: Asset) => Promise<void>;
}

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml", "image/bmp", "image/avif"];

export function AssetManagerModal({
  isOpen,
  assets,
  onClose,
  onAttach,
  onRemove,
}: AssetManagerModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [isAttaching, setIsAttaching] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetSelection = () => {
    setSelectedFile(null);
    setAltText("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setError(null);
    if (file && !ACCEPTED_TYPES.includes(file.type)) {
      setError(`Unsupported file type: ${file.type || "unknown"}. Use PNG, JPEG, GIF, WebP, BMP, AVIF or SVG.`);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    if (file && !altText.trim()) {
      // Default alt text from the file name without extension.
      setAltText(file.name.replace(/\.[^.]+$/, ""));
    }
  };

  const handleAttach = async () => {
    if (!selectedFile) return;
    setIsAttaching(true);
    setError(null);
    try {
      const buffer = await selectedFile.arrayBuffer();
      await onAttach(selectedFile.name, Array.from(new Uint8Array(buffer)), altText.trim() || selectedFile.name);
      resetSelection();
    } catch (err) {
      console.error("Failed to attach asset:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAttaching(false);
    }
  };

  const handleRemove = async (asset: Asset) => {
    setRemovingId(asset.id);
    setError(null);
    try {
      await onRemove(asset);
    } catch (err) {
      console.error("Failed to remove asset:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Attachments"
      description="Local files are copied into app-managed storage (~/.local/share/study-notes/assets) so notes stay self-contained and offline."
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Attach new file */}
        <div className="p-4 rounded-lg bg-surface-container border border-outline-variant/60 space-y-3">
          <div className="font-mono text-xs font-medium text-outline uppercase tracking-wider">
            Attach new file
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              onChange={handleFileChange}
              className="flex-1 min-w-0 text-xs font-mono text-outline file:mr-3 file:px-3 file:py-1.5 file:rounded file:border file:border-outline-variant file:bg-surface-container-high file:text-on-surface file:font-mono file:text-xs file:cursor-pointer cursor-pointer"
            />
            <Button
              variant="primary"
              size="sm"
              icon={<PlusIcon size={13} />}
              isLoading={isAttaching}
              disabled={!selectedFile}
              onClick={handleAttach}
            >
              Attach
            </Button>
          </div>

          <input
            type="text"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            maxLength={120}
            placeholder="Alt text (used in the markdown reference)"
            className="w-full h-8 px-2.5 rounded bg-surface-container-lowest border border-outline-variant/60 text-xs text-on-surface placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
          />

          {selectedFile && (
            <p className="font-mono text-[11px] text-outline">
              {selectedFile.name} · {(selectedFile.size / 1024).toFixed(1)} KB ·{" "}
              {selectedFile.type}
            </p>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-950/30 border border-red-800/50 text-error text-xs font-mono flex items-start gap-2">
            <AlertTriangleIcon size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Existing assets */}
        <div className="space-y-2.5">
          <div className="font-mono text-xs font-medium text-outline uppercase tracking-wider">
            Attached files ({assets.length})
          </div>

          {assets.length === 0 ? (
            <div className="p-6 rounded-lg border border-dashed border-outline-variant/50 text-center space-y-2">
              <div className="w-9 h-9 rounded-lg bg-surface-container text-outline flex items-center justify-center mx-auto border border-outline-variant/40">
                <ImageIcon size={18} />
              </div>
              <p className="font-sans text-xs text-outline">
                No attachments yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40"
                >
                  <div className="min-w-0">
                    <p className="font-sans text-xs text-on-surface truncate">
                      {asset.alt_text || "Untitled attachment"}
                    </p>
                    <p className="font-mono text-[10px] text-text-muted truncate">
                      {asset.file_path}
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<TrashIcon size={12} />}
                    isLoading={removingId === asset.id}
                    onClick={() => handleRemove(asset)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
