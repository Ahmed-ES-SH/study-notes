"use client";

import React from "react";
import { MainSection } from "../../lib/api/types";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { EditIcon, CodeIcon } from "../common/Icons";

export interface SubsectionHeroProps {
  section: MainSection;
  subsectionCount: number;
  noteCount: number;
  onEditMeta: () => void;
}

function sectionAbbreviation(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function SubsectionHero({
  section,
  subsectionCount,
  noteCount,
  onEditMeta,
}: SubsectionHeroProps) {
  return (
    <div
      className="relative p-6 rounded-xl bg-surface-container-low border border-outline-variant/50 overflow-hidden space-y-4"
      style={{
        background: `linear-gradient(135deg, ${section.color}0d 0%, rgba(20, 28, 36, 0) 60%), #141c24`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {/* Abbreviation Badge */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center border border-outline-variant/40 shadow-xs shrink-0 font-mono text-sm font-bold tracking-wider"
            style={{
              backgroundColor: `${section.color}20`,
              color: section.color,
            }}
          >
            {sectionAbbreviation(section.name)}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: section.color }}
              />
              <span
                className="font-mono text-[11px] uppercase tracking-wider font-semibold"
                style={{ color: section.color }}
              >
                Active Domain
              </span>
            </div>
            <h1 className="font-sans text-2xl sm:text-3xl font-bold text-on-surface tracking-tight truncate">
              {section.name}
            </h1>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          icon={<EditIcon size={13} />}
          onClick={onEditMeta}
          className="shrink-0"
        >
          Edit Meta
        </Button>
      </div>

      {/* Metadata Pills */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-outline-variant/40">
        <Badge variant="custom" color={section.color} dot size="sm">
          {subsectionCount} {subsectionCount === 1 ? "Subsection" : "Subsections"}
        </Badge>
        <Badge variant="default" size="sm">
          <CodeIcon size={11} />
          {noteCount} {noteCount === 1 ? "Note" : "Notes"}
        </Badge>
        <Badge variant="outline" size="sm">
          Offline • SQLite
        </Badge>
      </div>
    </div>
  );
}
