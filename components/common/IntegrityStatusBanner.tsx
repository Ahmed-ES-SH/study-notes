"use client";

import React from "react";
import { IntegrityReport } from "../../lib/api/types";
import { ShieldCheckIcon, AlertTriangleIcon, CloseIcon, DatabaseIcon } from "./Icons";

export interface IntegrityStatusBannerProps {
  report: IntegrityReport;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** idx).toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

/**
 * Diagnostic toast reporting SQLite health: integrity/foreign-key status,
 * on-disk size, and row counts across all four hierarchy levels.
 */
export function IntegrityStatusBanner({ report, onClose }: IntegrityStatusBannerProps) {
  return (
    <div
      role="status"
      className={`fixed bottom-4 right-4 z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border bg-surface-container-low shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200 ${
        report.is_healthy
          ? "border-outline-variant/60"
          : "border-error/60"
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
            report.is_healthy
              ? "bg-secondary-container text-secondary border-outline-variant/40"
              : "bg-error-container text-error border-error/40"
          }`}
        >
          {report.is_healthy ? <ShieldCheckIcon size={16} /> : <AlertTriangleIcon size={16} />}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs font-semibold text-on-surface">
              Database Health
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-0.5 rounded text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors"
              aria-label="Dismiss database health report"
            >
              <CloseIcon size={14} />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`font-mono text-[11px] px-1.5 py-0.5 rounded-full border font-semibold ${
                report.is_healthy
                  ? "text-secondary border-secondary/40 bg-secondary-container/50"
                  : "text-error border-error/40 bg-error-container/50"
              }`}
            >
              {report.is_healthy ? "INTEGRITY OK" : "ISSUES FOUND"}
            </span>
            <span className="font-mono text-[10px] text-outline truncate">
              {formatBytes(report.db_size_bytes)} • WAL
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1.5 font-mono text-center">
            {[
              { label: "Sections", value: report.total_main_sections },
              { label: "Subs", value: report.total_subsections },
              { label: "Notes", value: report.total_notes },
              { label: "Assets", value: report.total_assets },
            ].map((stat) => (
              <div
                key={stat.label}
                className="p-1.5 rounded bg-surface-container-low border border-outline-variant/40"
              >
                <div className="text-sm font-bold text-on-surface">{stat.value}</div>
                <div className="text-[9px] text-outline uppercase">{stat.label}</div>
              </div>
            ))}
          </div>

          {!report.is_healthy && (
            <div className="space-y-1 text-[11px] font-mono text-error">
              <div className="flex items-center gap-1.5">
                <DatabaseIcon size={12} />
                <span>integrity_check: {report.integrity_check_output}</span>
              </div>
              {report.foreign_key_violations.map((violation, idx) => (
                <div key={idx} className="truncate" title={violation}>
                  {violation}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
