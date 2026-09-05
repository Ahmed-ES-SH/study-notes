"use client";

import React, { useEffect, useState } from "react";
import { Asset, Note, TableOfContentsItem } from "../../lib/api/types";
import { resolveAssetSrc } from "../../lib/utils/assetPath";
import { formatRelativeTime } from "../../lib/utils/format";
import {
  BookIcon,
  ImageIcon,
  PlusCircleIcon,
  TrashIcon,
} from "../common/Icons";

export interface NoteInspectorProps {
  toc: TableOfContentsItem[];
  assets: Asset[];
  note: Note | null;
  onJumpToHeading: (id: string) => void;
  onInsertAsset: (asset: Asset) => void;
  onRemoveAsset: (asset: Asset) => void;
  onManageAssets: () => void;
}

/** Resolves one asset to an inline data URL for the thumbnail strip. */
function AssetThumb({ asset }: { asset: Asset }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;
    resolveAssetSrc(asset.file_path)
      .then((resolved) => {
        if (!isMounted) return;
        if (resolved) {
          setSrc(resolved);
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (isMounted) setFailed(true);
      });
    return () => {
      isMounted = false;
    };
  }, [asset.file_path]);

  if (failed) {
    return (
      <div className="aspect-video rounded bg-surface-container-lowest border border-outline-variant/40 flex items-center justify-center text-text-muted font-mono text-[10px]">
        missing
      </div>
    );
  }

  if (!src) {
    return (
      <div className="aspect-video rounded bg-surface-container-lowest border border-outline-variant/40 animate-pulse" />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={asset.alt_text || "attachment"}
      className="aspect-video w-full object-cover rounded border border-outline-variant/40"
    />
  );
}

export function NoteInspector({
  toc,
  assets,
  note,
  onJumpToHeading,
  onInsertAsset,
  onRemoveAsset,
  onManageAssets,
}: NoteInspectorProps) {
  return (
    <aside className="w-80 shrink-0 border-l border-outline-variant/40 bg-surface-container-low/60 flex flex-col h-full overflow-hidden">
      {/* Outline / TOC */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 py-3 border-b border-outline-variant/30 sticky top-0 bg-surface-container-low/95 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-outline">
            <BookIcon size={13} />
            <span>Outline</span>
            <span className="ml-auto font-normal normal-case tracking-normal text-text-muted">
              {toc.length} {toc.length === 1 ? "heading" : "headings"}
            </span>
          </div>
        </div>

        {toc.length === 0 ? (
          <p className="px-4 py-4 font-mono text-[11px] text-text-muted leading-relaxed">
            No headings yet. Add <span className="text-outline">#</span>,{" "}
            <span className="text-outline">##</span> or{" "}
            <span className="text-outline">###</span> lines to build the
            outline.
          </p>
        ) : (
          <nav className="py-2 px-2 space-y-0.5">
            {toc.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onJumpToHeading(item.id)}
                className={`w-full text-left px-2 py-1 rounded font-sans text-xs truncate transition-colors cursor-pointer ${
                  item.level === 1
                    ? "text-on-surface hover:bg-surface-container-high font-medium"
                    : item.level === 2
                      ? "pl-5 text-on-surface-variant hover:bg-surface-container-high"
                      : "pl-8 text-outline hover:bg-surface-container-high hover:text-on-surface"
                }`}
                title={item.text}
              >
                {item.text}
              </button>
            ))}
          </nav>
        )}

        {/* Media gallery */}
        <div className="px-4 py-3 border-t border-b border-outline-variant/30 mt-2 sticky top-[2.75rem] bg-surface-container-low/95 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-outline">
            <ImageIcon size={13} />
            <span>Media</span>
            <span className="ml-auto font-normal normal-case tracking-normal text-text-muted">
              {assets.length} {assets.length === 1 ? "file" : "files"}
            </span>
          </div>
        </div>

        {assets.length === 0 ? (
          <p className="px-4 py-4 font-mono text-[11px] text-text-muted leading-relaxed">
            No media attached yet. Use{" "}
            <span className="text-outline">Image</span> in the toolbar to
            attach local files.
          </p>
        ) : (
          <div className="p-3 grid grid-cols-2 gap-2.5">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="rounded-lg bg-surface-container-lowest border border-outline-variant/40 p-1.5 space-y-1.5"
              >
                <AssetThumb asset={asset} />
                <p
                  className="font-mono text-[10px] text-outline truncate"
                  title={asset.alt_text || asset.file_path}
                >
                  {asset.alt_text || asset.file_path}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onInsertAsset(asset)}
                    className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-primary font-mono text-[10px] transition-colors cursor-pointer"
                    title="Insert markdown reference at cursor"
                  >
                    <PlusCircleIcon size={11} />
                    Insert
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveAsset(asset)}
                    className="p-1 rounded bg-surface-container hover:bg-error/20 text-outline hover:text-error transition-colors cursor-pointer"
                    title="Detach asset (deletes local file)"
                  >
                    <TrashIcon size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={onManageAssets}
            className="w-full px-2 py-1.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-mono text-[11px] border border-outline-variant/40 transition-colors cursor-pointer"
          >
            Manage Attachments
          </button>
        </div>
      </div>

      {/* Note metadata */}
      {note && (
        <div className="px-4 py-3 border-t border-outline-variant/30 bg-surface-container-lowest/60 font-mono text-[10px] text-text-muted space-y-1">
          <div className="flex justify-between gap-2">
            <span>Created</span>
            <span className="text-outline">{formatRelativeTime(note.created_at)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Updated</span>
            <span className="text-outline">{formatRelativeTime(note.updated_at)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Chars</span>
            <span className="text-outline">{note.content.length}</span>
          </div>
        </div>
      )}
    </aside>
  );
}
