"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Note } from "../api/types";
import { fetchNotes, createNote, updateNote, deleteNote } from "../api/notes";

interface NotesSnapshot {
  subsectionId: string;
  notes: Note[];
}

export function useNotes(subsectionId: string | null) {
  const [snapshot, setSnapshot] = useState<NotesSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const isLoading =
    subsectionId !== null &&
    (snapshot === null || snapshot.subsectionId !== subsectionId);

  const notes = useMemo(
    () =>
      snapshot && snapshot.subsectionId === subsectionId
        ? snapshot.notes
        : [],
    [snapshot, subsectionId]
  );

  useEffect(() => {
    if (!subsectionId) return;
    let isMounted = true;

    fetchNotes(subsectionId)
      .then((data) => {
        if (isMounted) {
          setSnapshot({ subsectionId, notes: data });
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Failed to load notes:", err);
          setError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      isMounted = false;
    };
  }, [subsectionId, reloadToken]);

  const addNote = useCallback(
    async (title: string): Promise<Note> => {
      if (!subsectionId) throw new Error("No subsection selected");
      const created = await createNote(subsectionId, title);
      setSnapshot((prev) =>
        prev ? { ...prev, notes: [...prev.notes, created] } : prev
      );
      return created;
    },
    [subsectionId]
  );

  const renameNote = useCallback(
    async (id: string, title: string): Promise<void> => {
      const updated = await updateNote(id, title);
      setSnapshot((prev) =>
        prev
          ? {
              ...prev,
              notes: prev.notes.map((n) => (n.id === id ? updated : n)),
            }
          : prev
      );
    },
    []
  );

  const removeNote = useCallback(async (id: string): Promise<void> => {
    await deleteNote(id);
    setSnapshot((prev) =>
      prev ? { ...prev, notes: prev.notes.filter((n) => n.id !== id) } : prev
    );
  }, []);

  const reload = useCallback(() => {
    setSnapshot(null);
    setReloadToken((t) => t + 1);
  }, []);

  const filteredNotes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return notes;
    return notes.filter((n) => n.title.toLowerCase().includes(q));
  }, [notes, searchQuery]);

  return {
    notes,
    filteredNotes,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    reload,
    addNote,
    renameNote,
    removeNote,
  };
}
