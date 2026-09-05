"use client";

import { useEffect, useRef, useState } from "react";

/** Lists below this size render in full — windowing only kicks in at scale. */
export const DEFERRED_RENDER_THRESHOLD = 50;
/** How many items each render chunk adds once windowing is active. */
export const DEFERRED_RENDER_CHUNK = 100;

/**
 * Progressive (windowed) list rendering: returns the items to render and a
 * sentinel element to place after them. Items are rendered in chunks as the
 * user scrolls, keeping the DOM small for 1,000–10,000+ note lists without
 * external virtualization dependencies.
 */
export function useDeferredRender<T>(items: T[], enabled: boolean) {
  const [window_, setWindow] = useState({
    enabled,
    listLength: items.length,
    visibleCount: enabled ? Math.min(DEFERRED_RENDER_CHUNK, items.length) : items.length,
  });

  // Render-time state adjustment (React's documented alternative to
  // setState-in-effect): reset the window whenever the list changes.
  if (window_.enabled !== enabled || window_.listLength !== items.length) {
    setWindow({
      enabled,
      listLength: items.length,
      visibleCount: enabled ? Math.min(DEFERRED_RENDER_CHUNK, items.length) : items.length,
    });
  }

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const hasMore = enabled && window_.visibleCount < items.length;

  useEffect(() => {
    if (!hasMore || !sentinelRef.current) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setWindow((w) => ({
            ...w,
            visibleCount: Math.min(w.visibleCount + DEFERRED_RENDER_CHUNK, w.listLength),
          }));
        }
      },
      { rootMargin: "600px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore]);

  return {
    visibleItems: enabled ? items.slice(0, window_.visibleCount) : items,
    visibleCount: window_.visibleCount,
    sentinelRef,
    hasMore,
  };
}
