"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Note, SearchResult } from "../api/types";
import { fetchNotes, createNote, updateNote, deleteNote } from "../api/notes";
import { searchNotes } from "../api/search";
import { reorderEntities } from "../api/reorder";
import { useDebounce } from "./useDebounce";

interface NotesSnapshot {
  subsectionId: string;
  notes: Note[];
}

export function useNotes(subsectionId: string | null) {
  const [snapshot, setSnapshot] = useState<NotesSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // Last completed FTS run, keyed by its query so stale runs can be ignored.
  const [fts, setFts] = useState<{
    query: string;
    results: SearchResult[] | null;
    error: string | null;
  }>({ query: "", results: null, error: null });
  const [reloadToken, setReloadToken] = useState(0);

  const debouncedQuery = useDebounce(searchQuery, 150);

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

  // Scoped full-text search (SQLite FTS5) over this subsection's notes.
  // Results are keyed by query: derived `searchResults`/`searchError` below
  // ignore anything that no longer matches the active debounced query.
  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (!subsectionId || !trimmed) return;
    let cancelled = false;
    searchNotes(trimmed, { subsection_id: subsectionId })
      .then((results) => {
        if (!cancelled) setFts({ query: trimmed, results, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Note search failed:", err);
        setFts({
          query: trimmed,
          results: null,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, subsectionId]);

  const activeFts =
    fts.error === null && fts.results !== null && fts.query === debouncedQuery.trim();
  const searchResults = activeFts ? fts.results : null;
  const searchError =
    fts.error !== null && fts.query === debouncedQuery.trim() ? fts.error : null;

  const filteredNotes = useMemo(() => {
    // Active FTS search: results replace the plain list, in BM25 rank order.
    if (searchResults !== null) {
      const byId = new Map(
        (snapshot?.subsectionId === subsectionId ? snapshot.notes : []).map((n) => [n.id, n])
      );
      return searchResults
        .map((r) => byId.get(r.id))
        .filter((n): n is Note => n !== undefined);
    }
    const q = searchQuery.toLowerCase().trim();
    if (!q) return notes;
    return notes.filter((n) => n.title.toLowerCase().includes(q));
  }, [searchResults, snapshot, subsectionId, notes, searchQuery]);

  const reorderNotes = useCallback(
    async (orderedIds: string[]): Promise<void> => {
      const previous = snapshot;
      setSnapshot((prev) => {
        if (!prev) return prev;
        const byId = new Map(prev.notes.map((n) => [n.id, n]));
        const next = orderedIds
          .map((id) => byId.get(id))
          .filter((n): n is Note => n !== undefined);
        for (const n of prev.notes) {
          if (!orderedIds.includes(n.id)) next.push(n);
        }
        return { ...prev, notes: next.map((n, i) => ({ ...n, sort_order: i })) };
      });
      try {
        await reorderEntities("notes", orderedIds);
      } catch (err) {
        setSnapshot(previous);
        throw err;
      }
    },
    [snapshot]
  );

  return {
    notes,
    filteredNotes,
    searchResults,
    searchError,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    reload,
    addNote,
    renameNote,
    removeNote,
    reorderNotes,
  };
}
