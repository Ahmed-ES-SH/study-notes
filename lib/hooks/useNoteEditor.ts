"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Asset,
  EditorMode,
  NoteContextHierarchy,
} from "../api/types";
import {
  fetchNoteContext,
  updateNote as updateNoteApi,
} from "../api/notes";
import { attachAsset, fetchNoteAssets, removeAsset } from "../api/assets";
import { useAutoSave, EditorDraft } from "./useAutoSave";

interface EditorSnapshot {
  noteId: string;
  context: NoteContextHierarchy;
}

export function useNoteEditor(noteId: string | null) {
  const [snapshot, setSnapshot] = useState<EditorSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<EditorMode>("edit");
  const [preZenMode, setPreZenMode] = useState<EditorMode>("edit");
  const [assets, setAssets] = useState<Asset[]>([]);

  const isLoading =
    noteId !== null &&
    (snapshot === null || snapshot.noteId !== noteId);

  const note = snapshot && snapshot.noteId === noteId ? snapshot.context.note : null;
  const context = snapshot && snapshot.noteId === noteId ? snapshot.context : null;

  const saveDraft = useCallback(
    async (draft: EditorDraft) => {
      if (!noteId) throw new Error("No note selected");
      const updated = await updateNoteApi(noteId, draft.title, draft.content);
      setSnapshot((prev) =>
        prev && prev.noteId === noteId
          ? { ...prev, context: { ...prev.context, note: updated } }
          : prev
      );
    },
    [noteId]
  );

  const { status: saveStatus, isDirty, markDirty, flush, resetDirty } = useAutoSave({
    save: saveDraft,
    enabled: !!noteId && !isLoading && !loadError,
  });

  const editTitle = useCallback(
    (nextTitle: string) => {
      setTitle(nextTitle);
      markDirty({ title: nextTitle, content });
    },
    [content, markDirty]
  );

  const editContent = useCallback(
    (nextContent: string) => {
      setContent(nextContent);
      markDirty({ title, content: nextContent });
    },
    [title, markDirty]
  );

  // Load note context + assets whenever the queried id changes.
  useEffect(() => {
    if (!noteId) return;
    let isMounted = true;

    fetchNoteContext(noteId)
      .then((ctx) => {
        if (!isMounted) return;
        setSnapshot({ noteId, context: ctx });
        setLoadError(null);
        setTitle(ctx.note.title);
        setContent(ctx.note.content);
        resetDirty({ title: ctx.note.title, content: ctx.note.content });
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Failed to load note:", err);
        setLoadError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      isMounted = false;
    };
  }, [noteId, reloadToken, resetDirty]);

  const reloadAssets = useCallback(async (): Promise<void> => {
    if (!noteId) return;
    const list = await fetchNoteAssets(noteId);
    setAssets(list);
  }, [noteId]);

  // Initial asset fetch (errors are non-fatal: gallery shows empty).
  useEffect(() => {
    if (!noteId || isLoading || loadError) return;
    let isMounted = true;
    fetchNoteAssets(noteId)
      .then((list) => {
        if (isMounted) setAssets(list);
      })
      .catch((err) => console.error("Failed to load assets:", err));
    return () => {
      isMounted = false;
    };
  }, [noteId, isLoading, loadError]);

  const attachNewAsset = useCallback(
    async (fileName: string, fileBytes: number[], altText: string): Promise<Asset> => {
      if (!noteId) throw new Error("No note selected");
      const created = await attachAsset(noteId, fileName, fileBytes, altText);
      setAssets((prev) => [...prev, created]);
      return created;
    },
    [noteId]
  );

  const removeAssetById = useCallback(async (id: string): Promise<void> => {
    await removeAsset(id);
    setAssets((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const enterZen = useCallback(() => {
    setPreZenMode(mode === "zen" ? preZenMode : mode);
    setMode("zen");
  }, [mode, preZenMode]);

  const exitZen = useCallback(() => {
    setMode(preZenMode === "zen" ? "split" : preZenMode);
  }, [preZenMode]);

  const reload = useCallback(() => {
    setSnapshot(null);
    setLoadError(null);
    setReloadToken((t) => t + 1);
  }, []);

  const isNotFound = !isLoading && !loadError && !context;

  return {
    note,
    context,
    isLoading,
    isNotFound,
    loadError,
    reload,
    title,
    content,
    editTitle,
    editContent,
    mode,
    setMode,
    isZen: mode === "zen",
    enterZen,
    exitZen,
    saveStatus,
    isDirty,
    flushSave: flush,
    assets,
    reloadAssets,
    attachNewAsset,
    removeAssetById,
  };
}
