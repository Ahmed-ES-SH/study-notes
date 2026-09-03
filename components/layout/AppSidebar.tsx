"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SectionWithStats } from "../../lib/hooks/useMainSections";
import {
  DevNotesLogo,
  SearchIcon,
  PlusIcon,
  SidebarToggleIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CodeIcon,
  DatabaseIcon,
} from "../common/Icons";

export interface AppSidebarProps {
  sections: SectionWithStats[];
  onCreateSection?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function AppSidebar({
  sections,
  onCreateSection,
  isCollapsed = false,
  onToggleCollapse,
}: AppSidebarProps) {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSectionExpand = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isHome = pathname === "/" || pathname === "";

  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 bg-surface-container-low border-r border-outline-variant/50 z-40 flex flex-col justify-between select-none transition-all duration-200 ${
        isCollapsed ? "w-16" : "w-64 lg:w-72"
      }`}
    >
      {/* Top Header & Branding */}
      <div className="flex flex-col h-full overflow-hidden">
        <div className="h-14 px-4 flex items-center justify-between border-b border-outline-variant/30 bg-surface-container-low/80">
          <Link
            href="/"
            className="flex items-center gap-2.5 min-w-0"
            title="DevNotes Home"
          >
            <DevNotesLogo size={28} />
            {!isCollapsed && (
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-sans font-semibold text-base text-on-surface tracking-tight truncate">
                  DevNotes
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-container text-outline border border-outline-variant/30">
                  v1.0
                </span>
              </div>
            )}
          </Link>

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="text-outline hover:text-on-surface p-1 rounded-md hover:bg-surface-container-high transition-colors"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              <SidebarToggleIcon size={16} />
            </button>
          )}
        </div>

        {/* Quick Search trigger */}
        {!isCollapsed && (
          <div className="px-3 pt-3 pb-1">
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-surface-container border border-outline-variant/30 text-outline hover:text-on-surface hover:bg-surface-container-high transition-all text-xs"
              onClick={() => {
                const searchInput = document.getElementById("domain-search");
                if (searchInput) {
                  searchInput.focus();
                }
              }}
            >
              <div className="flex items-center gap-2">
                <SearchIcon size={14} />
                <span>Search notes...</span>
              </div>
              <div className="flex items-center font-mono text-[10px] bg-surface-container-highest px-1.5 py-0.5 rounded text-outline border border-outline-variant/40">
                ⌘K
              </div>
            </button>
          </div>
        )}

        {/* Main Navigation */}
        <nav className="px-2 py-2 flex flex-col gap-0.5">
          <Link
            href="/"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              isHome
                ? "bg-surface-container-high text-primary font-semibold border border-outline-variant/40"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
            title="Sections Directory"
          >
            <CodeIcon size={16} className="shrink-0" />
            {!isCollapsed && <span>Sections Directory</span>}
          </Link>
        </nav>

        {/* Dynamic Sections Explorer */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
          {!isCollapsed && (
            <div className="flex items-center justify-between px-3 py-1.5 mt-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-outline font-semibold">
                Domains ({sections.length})
              </span>
              {onCreateSection && (
                <button
                  type="button"
                  onClick={onCreateSection}
                  className="text-outline hover:text-primary p-0.5 rounded hover:bg-surface-container transition-colors"
                  title="Create New Section"
                >
                  <PlusIcon size={14} />
                </button>
              )}
            </div>
          )}

          <div className="space-y-0.5">
            {sections.map((section) => {
              const isExpanded = !!expandedSections[section.id];
              const hasSubs = (section.subsections?.length ?? 0) > 0;

              if (isCollapsed) {
                return (
                  <Link
                    key={section.id}
                    href={`/section?id=${section.id}`}
                    className="flex items-center justify-center p-2 rounded-lg hover:bg-surface-container transition-colors"
                    title={section.name}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: section.color }}
                    />
                  </Link>
                );
              }

              return (
                <div key={section.id} className="group">
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors">
                    <Link
                      href={`/section?id=${section.id}`}
                      className="flex items-center gap-2 min-w-0 flex-1"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: section.color }}
                      />
                      <span className="truncate font-medium">{section.name}</span>
                    </Link>

                    {hasSubs && (
                      <button
                        type="button"
                        onClick={(e) => toggleSectionExpand(section.id, e)}
                        className="p-0.5 rounded text-outline hover:text-on-surface transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDownIcon size={14} />
                        ) : (
                          <ChevronRightIcon size={14} />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Subsections list */}
                  {isExpanded && hasSubs && (
                    <div className="pl-6 pr-1 py-0.5 space-y-0.5 border-l border-outline-variant/30 ml-3.5 my-0.5">
                      {section.subsections?.map((sub) => (
                        <Link
                          key={sub.id}
                          href={`/section?id=${section.id}#sub-${sub.id}`}
                          className="block px-2 py-1 rounded text-[11px] font-mono text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors truncate"
                        >
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom SQLite Status Card */}
        {!isCollapsed && (
          <div className="p-3 bg-surface-container-lowest/90 m-2 rounded-xl border border-outline-variant/30">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-surface-container-high text-secondary flex items-center justify-center shrink-0 border border-outline-variant/40">
                <DatabaseIcon size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-on-surface font-semibold truncate">
                    Local SQLite
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                </div>
                <div className="text-[10px] font-mono text-outline truncate">
                  WAL Mode • 100% Offline
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
