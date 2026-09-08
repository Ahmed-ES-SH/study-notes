"use client";

import { useCallback } from "react";

/**
 * Window event fired by global entry points (command palette) to ask the
 * open editor page to export its note as PDF. The editor page owns the
 * listener because only it has the note state and pending-autosave handle.
 */
export const PRINT_EXPORT_EVENT = "study-notes:export-note-pdf";

export function requestPrintExport(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PRINT_EXPORT_EVENT));
  }
}

/**
 * PDF export trigger shared by the editor header, Ctrl+P, and the command
 * palette: flushes pending autosave so the printed content matches the
 * textarea, gives React a beat to commit, then opens the print dialog.
 * WebKitGTK (Tauri's Linux webview) maps window.print() to the native
 * WebKit print operation, whose dialog offers "Print to File → PDF".
 */
export function usePrintExport(flushSave: () => Promise<void>) {
  return useCallback(async () => {
    await flushSave();
    await new Promise((resolve) => window.setTimeout(resolve, 150));
    window.print();
  }, [flushSave]);
}
