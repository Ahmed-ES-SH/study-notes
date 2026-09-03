"use client";

import React, { useState } from "react";

export const PRESET_COLORS = [
  { name: "Cobalt", hex: "#388bfd" },
  { name: "Emerald", hex: "#3fb950" },
  { name: "Amber", hex: "#d29922" },
  { name: "Violet", hex: "#a371f7" },
  { name: "Cyan", hex: "#22d3ee" },
  { name: "Rose", hex: "#f85149" },
  { name: "Indigo", hex: "#6366f1" },
  { name: "Sky", hex: "#0ea5e9" },
  { name: "Lime", hex: "#84cc16" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Orange", hex: "#f97316" },
  { name: "Slate", hex: "#94a3b8" },
];

export interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [prevValue, setPrevValue] = useState(value);
  const [hexInput, setHexInput] = useState(value);
  const [inputError, setInputError] = useState<string | null>(null);

  if (value !== prevValue) {
    setPrevValue(value);
    setHexInput(value);
    setInputError(null);
  }

  const isValidHex = (hex: string) => /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.trim();
    if (val && !val.startsWith("#")) {
      val = "#" + val;
    }
    setHexInput(val);

    if (isValidHex(val)) {
      setInputError(null);
      onChange(val);
    } else if (val === "" || val === "#") {
      setInputError("Hex code is required");
    } else {
      setInputError("Invalid hex format (e.g. #388bfd)");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="font-mono text-xs font-medium text-outline uppercase tracking-wider select-none">
        Domain Accent Color
      </label>

      {/* Preset Swatches */}
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
        {PRESET_COLORS.map((c) => {
          const isSelected = value.toLowerCase() === c.hex.toLowerCase();
          return (
            <button
              key={c.hex}
              type="button"
              onClick={() => {
                onChange(c.hex);
                setHexInput(c.hex);
                setInputError(null);
              }}
              title={c.name}
              className={`w-7 h-7 rounded-md transition-all cursor-pointer flex items-center justify-center relative ${
                isSelected
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-surface-container-low scale-110 shadow-md"
                  : "hover:scale-105 opacity-85 hover:opacity-100"
              }`}
              style={{ backgroundColor: c.hex }}
            >
              {isSelected && (
                <svg
                  className="w-3.5 h-3.5 text-white drop-shadow"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* Custom Hex Input with Live Preview */}
      <div className="flex items-center gap-2 mt-1">
        <div
          className="w-9 h-9 rounded border border-outline-variant shadow-inner shrink-0 transition-colors"
          style={{ backgroundColor: isValidHex(hexInput) ? hexInput : value }}
          title="Active Color Preview"
        />
        <div className="flex-1 flex flex-col">
          <input
            type="text"
            value={hexInput}
            onChange={handleHexChange}
            placeholder="#388bfd"
            maxLength={7}
            className="w-full bg-surface-container-low border border-outline-variant text-on-surface font-mono text-xs rounded px-3 py-2 outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container uppercase"
          />
        </div>
      </div>
      {inputError && <span className="font-mono text-xs text-error">{inputError}</span>}
    </div>
  );
}
