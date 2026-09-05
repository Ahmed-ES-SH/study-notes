"use client";

/**
 * Cold-start and render metric helpers (Phase 6 performance pass).
 * All values stay in `performance` memory — nothing is transmitted,
 * consistent with FR-11 (100% offline).
 */

const COLD_START_MARK = "study-notes:cold-start";

/** Starts the cold-start clock at module import time (first JS execution). */
if (typeof performance !== "undefined" && !performance.getEntriesByName(COLD_START_MARK).length) {
  performance.mark(COLD_START_MARK);
}

/**
 * Reports milliseconds from first JS execution until the initial view is
 * mounted and interactive. Logs once to the console; useful for verifying
 * the <2s cold-start target with `tauri dev`.
 */
export function reportColdStart(label = "initial view mounted") {
  if (typeof performance === "undefined") return;
  try {
    performance.measure("study-notes:cold-start-duration", COLD_START_MARK);
    const entries = performance.getEntriesByName("study-notes:cold-start-duration");
    const duration = entries[entries.length - 1]?.duration;
    if (duration != null) {
      console.info(
        `[perf] Cold start → ${label}: ${duration.toFixed(0)}ms (target < 2000ms)`
      );
    }
  } catch {
    // Performance API unavailable or mark missing — metrics are best-effort.
  }
}
