"use client";

import { useCallback, useEffect, useState } from "react";
import { ThemeMode, ResolvedTheme } from "../api/types";

export const THEME_STORAGE_KEY = "study-notes-theme";
/** Fired on `window` whenever any toggle changes the mode, so every
 * mounted ThemeToggle instance (header + sidebar) stays in sync. */
export const THEME_CHANGED_EVENT = "study-notes:theme-changed";

function readStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "dark" || stored === "light" || stored === "system"
    ? stored
    : "system";
}

/** OS-level preference via the standard CSS media query. */
function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") {
    return systemPrefersDark() ? "dark" : "light";
  }
  return mode;
}

/**
 * Tri-mode theme engine (System / Terminal Noir dark / Terminal Light light).
 *
 * - Persists the user's manual choice in `localStorage` across restarts.
 * - "System" tracks the OS color scheme live: via `prefers-color-scheme`
 *   in the browser and via Tauri's `onThemeChanged` window event in the
 *   desktop app, with no reload.
 * - Applies the resolved palette by setting `data-theme` on `<html>`, which
 *   swaps the CSS custom properties without remounting React.
 */
export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    // Sync client-only persisted state (localStorage) after hydration.
    // A lazy useState initializer would desync SSR markup and cause
    // hydration mismatches, so the lint rule is suppressed instead.
    /* eslint-disable react-hooks/set-state-in-effect -- see comment above */
    const stored = readStoredMode();
    setModeState(stored);
    const resolved = resolveTheme(stored);
    setResolvedTheme(resolved);
    /* eslint-enable react-hooks/set-state-in-effect */
    document.documentElement.dataset.theme = resolved;
  }, []);

  // Track OS theme shifts while in "system" mode.
  useEffect(() => {
    if (mode !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const resolved = media.matches ? "dark" : "light";
      setResolvedTheme(resolved);
      document.documentElement.dataset.theme = resolved;
    };
    media.addEventListener("change", onChange);

    // In the Tauri desktop shell, prefer the native window theme event.
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { getCurrentWebviewWindow } = await import(
          "@tauri-apps/api/webviewWindow"
        );
        const win = getCurrentWebviewWindow();
        const handler = await win.onThemeChanged((event) => {
          if (mode !== "system") return;
          const resolved: ResolvedTheme =
            event.payload === "light" ? "light" : "dark";
          setResolvedTheme(resolved);
          document.documentElement.dataset.theme = resolved;
        });
        if (cancelled) {
          handler();
        } else {
          unlisten = handler;
        }
      } catch {
        // Not running inside Tauri (e.g. plain `next dev` in a browser).
      }
    })();

    return () => {
      cancelled = true;
      media.removeEventListener("change", onChange);
      unlisten?.();
    };
  }, [mode]);

  // Stay in sync with other mounted ThemeToggle instances.
  useEffect(() => {
    const onThemeChanged = () => {
      const stored = readStoredMode();
      setModeState(stored);
      setResolvedTheme(resolveTheme(stored));
    };
    window.addEventListener(THEME_CHANGED_EVENT, onThemeChanged);
    return () => window.removeEventListener(THEME_CHANGED_EVENT, onThemeChanged);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage unavailable (private mode etc.) — theme still applies live.
    }
    const resolved = resolveTheme(next);
    setResolvedTheme(resolved);
    document.documentElement.dataset.theme = resolved;
    window.dispatchEvent(new Event(THEME_CHANGED_EVENT));
  }, []);

  return { mode, resolvedTheme, setMode };
}
