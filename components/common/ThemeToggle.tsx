"use client";

import React from "react";
import { ThemeMode } from "../../lib/api/types";
import { useTheme } from "../../lib/hooks/useTheme";
import { SunIcon, MoonIcon, MonitorIcon } from "./Icons";

const OPTIONS: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: "system", label: "System theme", icon: <MonitorIcon size={14} /> },
  { value: "dark", label: "Dark (Terminal Noir)", icon: <MoonIcon size={14} /> },
  { value: "light", label: "Light (Terminal Light)", icon: <SunIcon size={14} /> },
];

export interface ThemeToggleProps {
  /** Show the text label next to the segmented control (sidebar mode). */
  showLabel?: boolean;
}

/**
 * Segmented System / Dark / Light switch. Uses the shared `useTheme` hook so
 * every mounted toggle stays in sync and OS theme shifts propagate live.
 */
export function ThemeToggle({ showLabel = false }: ThemeToggleProps) {
  const { mode, setMode } = useTheme();

  return (
    <div className="flex items-center gap-2">
      {showLabel && (
        <span className="font-mono text-[11px] uppercase tracking-wider text-outline">
          Theme
        </span>
      )}
      <div
        role="radiogroup"
        aria-label="Color theme"
        className="flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-container border border-outline-variant/40"
      >
        {OPTIONS.map((opt) => {
          const isActive = mode === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              title={opt.label}
              onClick={() => setMode(opt.value)}
              className={`flex items-center justify-center p-1.5 rounded-md transition-colors ${
                isActive
                  ? "bg-surface-container-high text-primary shadow-2xs"
                  : "text-outline hover:text-on-surface hover:bg-surface-container-high/60"
              }`}
            >
              {opt.icon}
            </button>
          );
        })}
      </div>
    </div>
  );
}
