"use client";

import React, { useEffect, useRef } from "react";
import { CloseIcon } from "./Icons";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
  showCloseButton?: boolean;
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "md",
  showCloseButton = true,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    // Move focus into the dialog unless a child (e.g. autoFocus input) already has it.
    if (isOpen && dialogRef.current && !dialogRef.current.contains(document.activeElement)) {
      dialogRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const maxWidthClass = {
    sm: "max-w-[28rem]",
    md: "max-w-[32rem]",
    lg: "max-w-[42rem]",
    xl: "max-w-4xl",
  }[maxWidth];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060f16]/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`w-full ${maxWidthClass} bg-surface-container-low border border-outline-variant rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all focus:outline-none`}
      >
        {(title || showCloseButton) && (
          <div className="px-6 py-4 border-b border-outline-variant/60 flex items-start justify-between bg-surface-container/40">
            <div className="space-y-1">
              {title && (
                <h3 className="font-sans font-semibold text-lg text-on-surface">
                  {title}
                </h3>
              )}
              {description && (
                <p className="font-sans text-xs text-outline leading-relaxed">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors -mr-1 -mt-1"
                aria-label="Close dialog"
              >
                <CloseIcon size={18} />
              </button>
            )}
          </div>
        )}
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
