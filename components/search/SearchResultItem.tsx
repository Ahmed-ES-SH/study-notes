"use client";

import React from "react";
import { PaletteItem } from "../../lib/hooks/useCommandPalette";
import { HighlightedText } from "./HighlightedText";
import { CodeIcon, FileTextIcon, HubIcon, BoltIcon } from "../common/Icons";

export interface SearchResultItemProps {
  item: PaletteItem;
  query: string;
  active: boolean;
  onHover: () => void;
  onSelect: (item: PaletteItem) => void;
}

const KIND_ICON: Record<PaletteItem["kind"], React.ReactNode> = {
  action: <BoltIcon size={14} />,
  section: <CodeIcon size={14} />,
  subsection: <HubIcon size={14} />,
  note: <FileTextIcon size={14} />,
};

const GROUP_LABEL: Record<PaletteItem["kind"], string> = {
  action: "Actions",
  section: "Domains",
  subsection: "Subsections",
  note: "Notes",
};

export function SearchResultItem({
  item,
  query,
  active,
  onHover,
  onSelect,
}: SearchResultItemProps) {
  const color =
    item.kind === "action"
      ? "var(--primary)"
      : item.kind === "note"
        ? item.sectionColor
        : item.color;

  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onClick={() => onSelect(item)}
      className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${
        active ? "bg-surface-container-high" : "hover:bg-surface-container"
      }`}
    >
      {/* Type / color icon */}
      <span
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border border-outline-variant/30"
        style={{ backgroundColor: `${color}18`, color }}
      >
        {KIND_ICON[item.kind]}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 min-w-0">
          <span className="font-sans text-sm font-medium text-on-surface truncate">
            <HighlightedText text={item.title} query={query} />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-outline shrink-0">
            {GROUP_LABEL[item.kind]}
          </span>
        </span>

        {item.kind === "note" && (
          <span className="block font-sans text-xs text-outline leading-relaxed line-clamp-2 mt-0.5">
            <HighlightedText text={item.snippet} query={query} />
          </span>
        )}

        {/* Breadcrumb path */}
        <span className="block font-mono text-[11px] text-outline/80 truncate mt-0.5">
          {item.kind === "note" && (
            <>
              <span
                className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle"
                style={{ backgroundColor: item.sectionColor }}
              />
              {item.sectionName} › {item.subsectionName}
            </>
          )}
          {item.kind === "subsection" && <>in {item.sectionName}</>}
          {item.kind === "section" && <>Knowledge Domain</>}
          {item.kind === "action" && item.hint}
        </span>
      </span>
    </button>
  );
}
