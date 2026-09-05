"use client";

import React, { useMemo } from "react";

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface HighlightedTextProps {
  text: string;
  /** Raw user query — split into whitespace-separated tokens, all of which
   * are highlighted case-insensitively wherever they appear in `text`. */
  query?: string;
  className?: string;
}

const MARK_CLASS = "bg-amber-500/20 text-amber-300 rounded-sm";

/**
 * Renders plain text with every occurrence of a query token wrapped in a
 * safe, styled `<mark>`. Any literal `<mark>` tags inside `text` (e.g. from
 * the backend snippet builder) are stripped first so no raw HTML is ever
 * injected — highlighting is recomputed client-side from the query.
 */
export function HighlightedText({ text, query, className }: HighlightedTextProps) {
  const segments = useMemo(() => {
    const plain = text.replace(/<\/?mark>/g, "");
    const tokens = (query ?? "").trim().split(/\s+/).filter(Boolean);
    if (!plain || tokens.length === 0) return [{ text: plain, hit: false }];

    const pattern = tokens.map(escapeRegex).join("|");
    const segments: { text: string; hit: boolean }[] = [];
    let last = 0;
    for (const match of plain.matchAll(new RegExp(`(${pattern})`, "gi"))) {
      const index = match.index ?? 0;
      if (index > last) segments.push({ text: plain.slice(last, index), hit: false });
      segments.push({ text: match[0], hit: true });
      last = index + match[0].length;
    }
    if (last < plain.length) segments.push({ text: plain.slice(last), hit: false });
    return segments;
  }, [text, query]);

  return (
    <span className={className}>
      {segments.map((segment, i) =>
        segment.hit ? (
          <mark key={i} className={MARK_CLASS}>
            {segment.text}
          </mark>
        ) : (
          <React.Fragment key={i}>{segment.text}</React.Fragment>
        )
      )}
    </span>
  );
}
