"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { listMainSections, listSubsections } from "../api/sections";
import { searchNotes } from "../api/search";
import { MainSection, SearchResult, Subsection } from "../api/types";
import { useDebounce } from "./useDebounce";
import { THEME_CHANGED_EVENT, THEME_STORAGE_KEY } from "./useTheme";

export type PaletteScope = "all" | "domain" | "topic";

export type PaletteItem =
  | { kind: "action"; id: string; title: string; hint: string; run: () => void }
  | {
      kind: "section";
      id: string;
      title: string;
      color: string;
    }
  | {
      kind: "subsection";
      id: string;
      title: string;
      color: string;
      sectionId: string;
      sectionName: string;
    }
  | {
      kind: "note";
      id: string;
      title: string;
      snippet: string;
      rank: number;
      sectionId: string;
      sectionName: string;
      sectionColor: string;
      subsectionId: string;
      subsectionName: string;
    };

/** Event fired on `window` by the header/sidebar triggers to open the palette. */
export const OPEN_COMMAND_PALETTE_EVENT = "study-notes:open-command-palette";

export function openCommandPalette(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
  }
}

interface HierarchyData {
  sections: MainSection[];
  subsectionsBySection: Record<string, Subsection[]>;
}

const SEARCH_LIMIT = 30;

/**
 * Global ⌘K / Ctrl+K command palette engine: activation shortcuts, scoped
 * full-text note search, structural navigation, and quick actions.
 */
export function useCommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<PaletteScope>("all");
  const [rawActiveIndex, setActiveIndex] = useState(0);
  const [hierarchy, setHierarchy] = useState<HierarchyData | null>(null);
  // Page context captured on open ("Current Domain" / "Current Topic" scopes).
  const [context, setContext] = useState<{ domainId?: string; topicId?: string }>({});
  // Last completed FTS run, keyed by its query so stale runs are ignored.
  const [fts, setFts] = useState<{
    query: string;
    results: SearchResult[] | null;
    error: string | null;
  }>({ query: "", results: null, error: null });

  const debouncedQuery = useDebounce(query, 150);

  const loadHierarchy = useCallback(async () => {
    try {
      const sections = await listMainSections();
      const subsectionsBySection: Record<string, Subsection[]> = {};
      await Promise.all(
        sections.map(async (section) => {
          try {
            subsectionsBySection[section.id] = await listSubsections(section.id);
          } catch {
            subsectionsBySection[section.id] = [];
          }
        })
      );
      setHierarchy({ sections, subsectionsBySection });
    } catch (err) {
      console.error("Command palette failed to load hierarchy:", err);
      setHierarchy({ sections: [], subsectionsBySection: {} });
    }
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    setQuery("");
    setActiveIndex(0);

    // Capture the current page's domain/topic context for scoped search.
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const path = window.location.pathname;
    if (path === "/section" && id) {
      setContext({ domainId: id });
    } else if (path === "/subsection" && id) {
      setContext({ topicId: id });
    } else {
      setContext({});
    }

    void loadHierarchy();
  }, [loadHierarchy]);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
  }, []);

  const toggleTheme = useCallback(() => {
    const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const next = current === "dark" ? "light" : "dark";
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage unavailable — the visual switch below still applies.
    }
    document.documentElement.dataset.theme = next;
    window.dispatchEvent(new Event(THEME_CHANGED_EVENT));
  }, []);

  const actions = useMemo<PaletteItem[]>(
    () => [
      {
        kind: "action",
        id: "action-home",
        title: "Go to Sections Directory",
        hint: "Navigation",
        run: () => router.push("/"),
      },
      {
        kind: "action",
        id: "action-theme",
        title: "Toggle Theme (Dark / Light)",
        hint: "Appearance",
        run: toggleTheme,
      },
    ],
    [router, toggleTheme]
  );

  // Global activation shortcut (Cmd+K / Ctrl+K) + trigger events.
  const isOpenRef = useRef(false);
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const toggle = useCallback(() => {
    if (isOpenRef.current) {
      close();
    } else {
      open();
    }
  }, [open, close]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    };
    const onOpenEvent = () => open();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent);
    };
  }, [toggle, open]);

  // Resolve the topic's parent domain lazily once the hierarchy is loaded.
  const currentDomainId =
    context.domainId ??
    (context.topicId
      ? hierarchy?.sections.find((s) =>
          (hierarchy.subsectionsBySection[s.id] ?? []).some(
            (sub) => sub.id === context.topicId
          )
        )?.id
      : undefined);

  // Scoped full-text search over notes. Results are keyed by query so stale
  // runs are ignored through the derived values below.
  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (!trimmed) return;

    let cancelled = false;
    searchNotes(trimmed, {
      main_section_id: scope === "domain" ? currentDomainId : undefined,
      subsection_id: scope === "topic" ? context.topicId : undefined,
      limit: SEARCH_LIMIT,
    })
      .then((results) => {
        if (!cancelled) setFts({ query: trimmed, results, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Palette search failed:", err);
        setFts({
          query: trimmed,
          results: null,
          error: err instanceof Error ? err.message : String(err),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, scope, currentDomainId, context.topicId]);

  // Structural navigation matches (client-side over the loaded hierarchy).
  const q = debouncedQuery.trim().toLowerCase();

  const sectionItems = useMemo<PaletteItem[]>(() => {
    if (!hierarchy || scope !== "all") return [];
    return hierarchy.sections
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .map((s) => ({
        kind: "section" as const,
        id: s.id,
        title: s.name,
        color: s.color,
      }));
  }, [hierarchy, q, scope]);

  const subsectionItems = useMemo<PaletteItem[]>(() => {
    if (!hierarchy || scope !== "all") return [];
    const matches: PaletteItem[] = [];
    for (const section of hierarchy.sections) {
      for (const sub of hierarchy.subsectionsBySection[section.id] ?? []) {
        if (q && !sub.name.toLowerCase().includes(q)) continue;
        matches.push({
          kind: "subsection",
          id: sub.id,
          title: sub.name,
          color: section.color,
          sectionId: section.id,
          sectionName: section.name,
        });
      }
    }
    return matches;
  }, [hierarchy, q, scope]);

  const noteItems = useMemo<PaletteItem[]>(() => {
    const trimmed = debouncedQuery.trim();
    if (!trimmed || fts.error !== null || fts.query !== trimmed || fts.results === null) {
      return [];
    }
    return fts.results.map((r) => ({
      kind: "note" as const,
      id: r.id,
      title: r.title,
      snippet: r.snippet,
      rank: r.rank,
      sectionId: r.main_section_id,
      sectionName: r.main_section_name,
      sectionColor: r.main_section_color,
      subsectionId: r.subsection_id,
      subsectionName: r.subsection_name,
    }));
  }, [fts, debouncedQuery]);

  const actionItems = useMemo<PaletteItem[]>(
    () => (q ? [] : actions),
    [q, actions]
  );

  const items = useMemo<PaletteItem[]>(
    () => [...actionItems, ...sectionItems, ...subsectionItems, ...noteItems],
    [actionItems, sectionItems, subsectionItems, noteItems]
  );

  // A search run is "in flight" when the active query has not produced a
  // completed FTS run yet (derived — no state syncing needed).
  const trimmedQuery = debouncedQuery.trim();
  const isSearching = trimmedQuery !== "" && fts.query !== trimmedQuery;

  // Clamp instead of resetting on query/scope changes so keyboard selection
  // stays valid without sync effects.
  const activeIndex = Math.min(rawActiveIndex, Math.max(items.length - 1, 0));

  const navigateTo = useCallback(
    (item: PaletteItem) => {
      close();
      if (item.kind === "action") {
        item.run();
      } else if (item.kind === "section") {
        router.push(`/section?id=${item.id}`);
      } else if (item.kind === "subsection") {
        router.push(`/subsection?id=${item.id}`);
      } else {
        router.push(`/editor?id=${item.id}`);
      }
    },
    [router, close]
  );

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (items.length ? (prev + 1) % items.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) =>
          items.length ? (prev - 1 + items.length) % items.length : 0
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = items[activeIndex];
        if (item) navigateTo(item);
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    },
    [items, activeIndex, navigateTo, close]
  );

  return {
    isOpen,
    open,
    close,
    query,
    setQuery,
    scope,
    setScope,
    items,
    activeIndex,
    setActiveIndex,
    isSearching,
    handleKeyDown,
    navigateTo,
    hasDomainContext: currentDomainId !== undefined,
    hasTopicContext: context.topicId !== undefined,
  };
}
