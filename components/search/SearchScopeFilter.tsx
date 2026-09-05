"use client";

import React from "react";
import { PaletteScope } from "../../lib/hooks/useCommandPalette";

export interface SearchScopeFilterProps {
  scope: PaletteScope;
  onScopeChange: (scope: PaletteScope) => void;
  /** Whether the user is currently inside a domain / topic page. */
  hasDomainContext: boolean;
  hasTopicContext: boolean;
}

const SCOPES: {
  value: PaletteScope;
  label: string;
  needsContext: "domain" | "topic" | null;
}[] = [
  { value: "all", label: "All Notes", needsContext: null },
  { value: "domain", label: "Current Domain", needsContext: "domain" },
  { value: "topic", label: "Current Topic", needsContext: "topic" },
];

/** Segmented scope pills: Global / Current Domain / Current Topic search. */
export function SearchScopeFilter({
  scope,
  onScopeChange,
  hasDomainContext,
  hasTopicContext,
}: SearchScopeFilterProps) {
  const hasContext: Record<PaletteScope, boolean> = {
    all: true,
    domain: hasDomainContext,
    topic: hasTopicContext,
  };

  return (
    <div
      role="tablist"
      aria-label="Search scope"
      className="flex items-center gap-1 px-3 pt-2.5 pb-1 border-b border-outline-variant/40"
    >
      {SCOPES.map(({ value, label, needsContext }) => {
        const disabled = needsContext !== null && !hasContext[needsContext];
        const title = disabled
          ? `Open a ${needsContext === "domain" ? "domain" : "topic"} page to use this scope`
          : label;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={scope === value}
            disabled={disabled}
            title={title}
            onClick={() => onScopeChange(value)}
            className={`font-mono text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
              scope === value
                ? "bg-surface-container-high text-primary border-outline-variant/60"
                : disabled
                  ? "text-outline/40 border-transparent cursor-not-allowed"
                  : "text-outline hover:text-on-surface hover:bg-surface-container border-transparent cursor-pointer"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
