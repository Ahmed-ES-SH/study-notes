"use client";

import { useState, useEffect, useCallback } from "react";
import { MainSection, CascadeCounts, Subsection } from "../api/types";
import {
  listMainSections,
  createMainSection,
  updateMainSection,
  deleteMainSection,
  getMainSectionCascadeInfo,
  listSubsections,
} from "../api/sections";

export interface SectionWithStats extends MainSection {
  stats?: CascadeCounts;
  subsections?: Subsection[];
}

export function useMainSections() {
  const [sections, setSections] = useState<SectionWithStats[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEnhancedSections = useCallback(async () => {
    const data = await listMainSections();
    return await Promise.all(
      data.map(async (section) => {
        try {
          const [stats, subsections] = await Promise.all([
            getMainSectionCascadeInfo(section.id).catch(() => ({
              subsection_count: 0,
              note_count: 0,
              asset_count: 0,
            })),
            listSubsections(section.id).catch(() => []),
          ]);
          return {
            ...section,
            stats,
            subsections,
          };
        } catch {
          return {
            ...section,
            stats: { subsection_count: 0, note_count: 0, asset_count: 0 },
            subsections: [],
          };
        }
      })
    );
  }, []);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const enhanced = await fetchEnhancedSections();
      setSections(enhanced);
    } catch (err) {
      console.error("Failed to load main sections:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [fetchEnhancedSections]);

  useEffect(() => {
    let isMounted = true;
    fetchEnhancedSections()
      .then((enhanced) => {
        if (isMounted) {
          setSections(enhanced);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Failed to load main sections:", err);
          setError(err instanceof Error ? err.message : String(err));
          setIsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [fetchEnhancedSections]);

  const addSection = async (name: string, color: string): Promise<MainSection> => {
    const created = await createMainSection(name, color);
    const newSection: SectionWithStats = {
      ...created,
      stats: { subsection_count: 0, note_count: 0, asset_count: 0 },
      subsections: [],
    };
    setSections((prev) => [...prev, newSection]);
    return created;
  };

  const editSection = async (
    id: string,
    name?: string,
    color?: string
  ): Promise<MainSection> => {
    const updated = await updateMainSection(id, name, color);
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updated } : s))
    );
    return updated;
  };

  const removeSection = async (id: string): Promise<void> => {
    await deleteMainSection(id);
    setSections((prev) => prev.filter((s) => s.id !== id));
  };

  return {
    sections,
    isLoading,
    error,
    reload,
    addSection,
    editSection,
    removeSection,
  };
}
