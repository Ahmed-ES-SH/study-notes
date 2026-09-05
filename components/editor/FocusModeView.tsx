"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { MarkdownPreview } from "./MarkdownPreview";
import { Button } from "../common/Button";
import { ChevronLeftIcon, CloseIcon } from "../common/Icons";

export interface FocusModeViewProps {
  title: string;
  content: string;
  subsectionId: string;
  onExit: () => void;
  assetsVersion?: number;
}

type ColumnWidth = "narrow" | "std" | "wide";

const WIDTH_CLASSES: Record<ColumnWidth, string> = {
  narrow: "max-w-[42rem]",
  std: "max-w-4xl",
  wide: "max-w-6xl",
};

const FONT_SIZES = [
  { label: "A-", px: 14 },
  { label: "A", px: 16 },
  { label: "A+", px: 19 },
] as const;

/**
 * Full-screen distraction-free reading canvas (study mode): rendered
 * markdown in a constrained reading column with width and font controls.
 */
export function FocusModeView({
  title,
  content,
  subsectionId,
  onExit,
  assetsVersion = 0,
}: FocusModeViewProps) {
  const [width, setWidth] = useState<ColumnWidth>("std");
  const [fontSize, setFontSize] = useState<number>(16);

  // Esc exits focus mode.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onExit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onExit]);

  return (
    <div className="fixed inset-0 z-50 bg-surface flex flex-col">
      {/* Top navigation bar */}
      <header className="h-14 shrink-0 px-4 lg:px-6 flex items-center justify-between gap-4 border-b border-outline-variant/40 bg-surface-container-lowest/80 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/subsection?id=${subsectionId}`}
            className="flex items-center gap-1.5 font-mono text-xs text-outline hover:text-on-surface transition-colors shrink-0"
          >
            <ChevronLeftIcon size={14} />
            <span>Back to Subsection</span>
          </Link>
          <div className="h-4 w-px bg-outline-variant/50" />
          <h2 className="font-sans font-semibold text-sm text-on-surface truncate">
            {title || "Untitled note"}
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Column width selector */}
          <div className="flex items-center bg-surface-container rounded p-0.5 border border-outline-variant/40">
            {(
              [
                ["narrow", "Narrow"],
                ["std", "Std"],
                ["wide", "Wide"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setWidth(value)}
                className={`px-2 py-0.5 rounded font-mono text-[11px] transition-colors cursor-pointer ${
                  width === value
                    ? "bg-surface-container-highest text-primary font-semibold"
                    : "text-outline hover:text-on-surface hover:bg-surface-container-high"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Font size controls */}
          <div className="flex items-center bg-surface-container rounded p-0.5 border border-outline-variant/40">
            {FONT_SIZES.map((size) => (
              <button
                key={size.label}
                type="button"
                onClick={() => setFontSize(size.px)}
                className={`px-2 py-0.5 rounded font-mono transition-colors cursor-pointer ${
                  fontSize === size.px
                    ? "bg-surface-container-highest text-primary font-semibold"
                    : "text-outline hover:text-on-surface hover:bg-surface-container-high"
                } ${size.px === 19 ? "text-[13px]" : size.px === 16 ? "text-[12px]" : "text-[11px]"}`}
              >
                {size.label}
              </button>
            ))}
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={<CloseIcon size={12} />}
            onClick={onExit}
          >
            Exit Zen
          </Button>
        </div>
      </header>

      {/* Reading canvas */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        <div
          className={`mx-auto px-6 py-10 ${WIDTH_CLASSES[width]}`}
          style={{ fontSize: `${fontSize}px` }}
        >
          <h1 className="md-h md-h1" style={{ marginBottom: "1.2em" }}>
            {title || "Untitled note"}
          </h1>
          <MarkdownPreview content={content} assetsVersion={assetsVersion} />
        </div>
      </main>

      <footer className="shrink-0 px-4 py-1.5 border-t border-outline-variant/30 bg-surface-container-lowest/60 font-mono text-[10px] text-text-muted text-center">
        Focus mode — press <span className="text-outline">Esc</span> to return
        to the editor
      </footer>
    </div>
  );
}
