"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SaveStatus } from "../api/types";

export interface EditorDraft {
  title: string;
  content: string;
}

interface UseAutoSaveArgs {
  /** Persists the given draft. Must reject on failure. */
  save: (draft: EditorDraft) => Promise<unknown>;
  /** Debounce window after the last keystroke (FR-10: 1200ms). */
  delayMs?: number;
  /** Saves are suppressed until the note has loaded. */
  enabled: boolean;
}

/**
 * Debounced auto-save engine for the note editor. Tracks the latest draft,
 * schedules a save 1200ms after the last edit, and exposes an awaited
 * `flush()` used by Ctrl+S, "Save & Close" and the unmount safety net.
 */
export function useAutoSave({ save, delayMs = 1200, enabled }: UseAutoSaveArgs) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [isDirty, setIsDirty] = useState(false);

  const saveRef = useRef(save);
  const enabledRef = useRef(enabled);

  // Keep the latest save callback / enabled flag reachable from timers and
  // the unmount flush without re-creating them.
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const draftRef = useRef<EditorDraft>({ title: "", content: "" });
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const performSave = useCallback(async (): Promise<void> => {
    if (inFlightRef.current) {
      await inFlightRef.current;
    }
    if (!enabledRef.current || !dirtyRef.current) return;

    const snapshot = { ...draftRef.current };
    const run = (async () => {
      setStatus("saving");
      try {
        await saveRef.current(snapshot);
        // Only drop the dirty flag if the user hasn't typed since the
        // snapshot was taken — otherwise another save round is still due.
        if (
          draftRef.current.title === snapshot.title &&
          draftRef.current.content === snapshot.content
        ) {
          dirtyRef.current = false;
          setIsDirty(false);
        }
      } catch (err) {
        console.error("Auto-save failed:", err);
        // Keep dirtyRef true so the next debounce/flush retries; re-throw
        // so explicit flush() callers see the failure.
        throw err;
      } finally {
        setStatus("saved");
      }
    })();

    inFlightRef.current = run;
    try {
      await run;
    } finally {
      if (inFlightRef.current === run) {
        inFlightRef.current = null;
      }
    }
  }, []);

  /**
   * Records the latest draft and (re)starts the debounce timer.
   * Called on every keystroke — never re-render-heavy.
   */
  const markDirty = useCallback(
    (draft: EditorDraft) => {
      draftRef.current = draft;
      dirtyRef.current = true;
      setIsDirty(true);
      if (!enabledRef.current) return;

      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void performSave().catch(() => undefined);
      }, delayMs);
    },
    [clearTimer, delayMs, performSave]
  );

  /** Cancels the debounce and saves immediately. Safe to call when clean. */
  const flush = useCallback(async (): Promise<void> => {
    clearTimer();
    await performSave();
  }, [clearTimer, performSave]);

  /** Marks the draft clean without saving (used right after a note loads). */
  const resetDirty = useCallback(
    (draft: EditorDraft) => {
      clearTimer();
      draftRef.current = draft;
      dirtyRef.current = false;
      setIsDirty(false);
      setStatus("saved");
    },
    [clearTimer]
  );

  // Ctrl+S / Cmd+S force an immediate flush.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void flush().catch(() => undefined);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flush]);

  // Safety net: flush pending edits when the editor unmounts (or the note id
  // changes). Explicit flushes in navigation handlers stay the primary path.
  useEffect(() => {
    return () => {
      clearTimer();
      if (dirtyRef.current && enabledRef.current) {
        void performSave().catch(() => undefined);
      }
    };
  }, [clearTimer, performSave]);

  return {
    status,
    isDirty,
    markDirty,
    flush,
    resetDirty,
  };
}
