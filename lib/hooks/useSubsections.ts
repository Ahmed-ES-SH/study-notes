"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { SubsectionWithDetails, NotePreview } from "../api/types";
import {
  fetchSubsections,
  createSubsection,
  updateSubsection,
  deleteSubsection,
  fetchNotesForSubsection,
} from "../api/subsections";
import { reorderEntities } from "../api/reorder";
import { invoke } from "@tauri-apps/api/core";

interface SubsectionsSnapshot {
  mainSectionId: string;
  subsections: SubsectionWithDetails[];
}

export function useSubsections(mainSectionId: string | null) {
  const [snapshot, setSnapshot] = useState<SubsectionsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const isLoading =
    mainSectionId !== null &&
    (snapshot === null || snapshot.mainSectionId !== mainSectionId);

  const subsections = useMemo(
    () =>
      snapshot && snapshot.mainSectionId === mainSectionId
        ? snapshot.subsections
        : [],
    [snapshot, mainSectionId]
  );

  useEffect(() => {
    if (!mainSectionId) return;
    let isMounted = true;

    fetchSubsections(mainSectionId)
      .then(async (data) => {
        const detailed = await Promise.all(
          data.map(async (sub): Promise<SubsectionWithDetails> => {
            try {
              const notes = await fetchNotesForSubsection(sub.id);
              return { ...sub, notes };
            } catch {
              return { ...sub, notes: [] };
            }
          })
        );
        if (isMounted) {
          setSnapshot({ mainSectionId, subsections: detailed });
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Failed to load subsections:", err);
          setError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      isMounted = false;
    };
  }, [mainSectionId, reloadToken]);

  const updateSnapshot = useCallback(
    (fn: (subs: SubsectionWithDetails[]) => SubsectionWithDetails[]) => {
      setSnapshot((prev) =>
        prev ? { ...prev, subsections: fn(prev.subsections) } : prev
      );
    },
    []
  );

  const reload = useCallback(() => {
    setSnapshot(null);
    setReloadToken((t) => t + 1);
  }, []);

  const addSubsection = useCallback(
    async (name: string): Promise<SubsectionWithDetails> => {
      if (!mainSectionId) throw new Error("No parent section selected");
      const created = await createSubsection(mainSectionId, name);
      const withNotes: SubsectionWithDetails = { ...created, notes: [] };
      updateSnapshot((prev) => [...prev, withNotes]);
      return withNotes;
    },
    [mainSectionId, updateSnapshot]
  );

  const renameSubsection = useCallback(
    async (id: string, name: string): Promise<void> => {
      const updated = await updateSubsection(id, name);
      updateSnapshot((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updated } : s))
      );
    },
    [updateSnapshot]
  );

  const removeSubsection = useCallback(
    async (id: string): Promise<void> => {
      await deleteSubsection(id);
      updateSnapshot((prev) => prev.filter((s) => s.id !== id));
    },
    [updateSnapshot]
  );

  const reorderSubsections = useCallback(
    async (orderedIds: string[]): Promise<void> => {
      const previous = snapshot;
      updateSnapshot((prev) => {
        const byId = new Map(prev.map((s) => [s.id, s]));
        const next = orderedIds
          .map((id) => byId.get(id))
          .filter((s): s is SubsectionWithDetails => s !== undefined);
        for (const s of prev) {
          if (!orderedIds.includes(s.id)) next.push(s);
        }
        return next.map((s, i) => ({ ...s, sort_order: i }));
      });
      try {
        await reorderEntities("subsections", orderedIds);
      } catch (err) {
        setSnapshot(previous);
        throw err;
      }
    },
    [snapshot, updateSnapshot]
  );

  const addNote = useCallback(
    async (subsectionId: string, title: string): Promise<NotePreview> => {
      const created = await invoke<NotePreview>("create_note", {
        subsectionId,
        title,
      });
      updateSnapshot((prev) =>
        prev.map((s) =>
          s.id === subsectionId ? { ...s, notes: [...s.notes, created] } : s
        )
      );
      return created;
    },
    [updateSnapshot]
  );

  const filteredSubsections = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return subsections;
    return subsections.filter((s) => s.name.toLowerCase().includes(q));
  }, [subsections, searchQuery]);

  return {
    subsections,
    filteredSubsections,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    reload,
    addSubsection,
    renameSubsection,
    removeSubsection,
    reorderSubsections,
    addNote,
  };
}
