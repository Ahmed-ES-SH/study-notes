"use client";

import React, { useState, useMemo, useEffect } from "react";
import { reportColdStart } from "../lib/utils/performance";
import { AppSidebar } from "../components/layout/AppSidebar";
import { AppHeader } from "../components/layout/AppHeader";
import { SectionFilterBar, SortOption } from "../components/sections/SectionFilterBar";
import { SectionGrid } from "../components/sections/SectionGrid";
import { CreateSectionModal } from "../components/sections/CreateSectionModal";
import { EditSectionModal } from "../components/sections/EditSectionModal";
import { DeleteSectionDialog } from "../components/sections/DeleteSectionDialog";
import { useMainSections, SectionWithStats } from "../lib/hooks/useMainSections";
import { Button } from "../components/common/Button";
import { PlusIcon } from "../components/common/Icons";

export default function Home() {
  const {
    sections,
    isLoading,
    error,
    addSection,
    editSection,
    removeSection,
    reorderSections,
  } = useMainSections();

  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<SortOption>("manual");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<SectionWithStats | null>(null);
  const [deletingSection, setDeletingSection] = useState<SectionWithStats | null>(null);

  // Cold-start metric (Phase 6): first JS execution → home view mounted.
  useEffect(() => {
    reportColdStart();
  }, []);

  // Filtered & Sorted sections
  const filteredAndSortedSections = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const filtered = sections.filter((s) => {
      if (!q) return true;
      if (s.name.toLowerCase().includes(q)) return true;
      if (s.subsections?.some((sub) => sub.name.toLowerCase().includes(q))) return true;
      return false;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "manual") {
        return a.sort_order - b.sort_order;
      }
      if (sortBy === "name") {
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }
      if (sortBy === "created") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      // default: updated
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [sections, searchQuery, sortBy]);

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      {/* Sidebar Navigation */}
      <AppSidebar
        sections={sections}
        onCreateSection={() => setIsCreateOpen(true)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* Main Canvas Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          isSidebarCollapsed ? "pl-16" : "pl-64 lg:pl-72"
        }`}
      >
        <AppHeader
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        <main className="flex-1 pt-14 p-6 sm:p-8 lg:p-10 max-w-7xl mx-auto w-full space-y-8">
          {/* Top Heading Strip */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-outline uppercase tracking-wider">
                  <span>DevNotes Core</span>
                  <span className="text-outline-variant">/</span>
                  <span className="text-primary font-semibold">Sections Directory</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary ml-1" />
                </div>
                <h1 className="font-sans text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
                  Knowledge Domains & Sections
                </h1>
                <p className="font-sans text-xs sm:text-sm text-on-surface-variant max-w-[42rem] leading-relaxed">
                  Explore your structured developer study streams, inspect nested technical
                  subsections, and monitor mastery retention across engineering verticals.
                </p>
              </div>

              {/* Top Action Button */}
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  icon={<PlusIcon size={14} />}
                  onClick={() => setIsCreateOpen(true)}
                >
                  New Section
                </Button>
              </div>
            </div>

            {/* Error Banner if any */}
            {error && (
              <div className="p-3 rounded-lg bg-red-950/30 border border-red-800/50 text-error text-xs font-mono">
                Error loading sections: {error}
              </div>
            )}
            {reorderError && (
              <div className="p-3 rounded-lg bg-red-950/30 border border-red-800/50 text-error text-xs font-mono flex items-center justify-between gap-3">
                <span>Reorder failed, original order restored: {reorderError}</span>
                <Button variant="secondary" size="sm" onClick={() => setReorderError(null)}>
                  Dismiss
                </Button>
              </div>
            )}

            {/* Search & Layout Filter Bar */}
            <SectionFilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              sortBy={sortBy}
              onSortChange={setSortBy}
              totalCount={sections.length}
              filteredCount={filteredAndSortedSections.length}
            />
          </div>

          {/* Main Domains Section Grid / List */}
          <SectionGrid
            sections={filteredAndSortedSections}
            totalSectionsCount={sections.length}
            searchQuery={searchQuery}
            viewMode={viewMode}
            isLoading={isLoading}
            onClearSearch={() => setSearchQuery("")}
            onCreateSection={() => setIsCreateOpen(true)}
            onEditSection={(s) => setEditingSection(s)}
            onDeleteSection={(s) => setDeletingSection(s)}
            onReorder={reorderSections}
            onReorderError={(message) => setReorderError(message)}
            reorderEnabled={sortBy === "manual" && !searchQuery.trim()}
          />
        </main>
      </div>

      {/* Modals & Confirmation Dialogs */}
      <CreateSectionModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={async (name, color) => {
          await addSection(name, color);
        }}
      />

      <EditSectionModal
        isOpen={!!editingSection}
        section={editingSection}
        onClose={() => setEditingSection(null)}
        onSubmit={async (id, name, color) => {
          await editSection(id, name, color);
        }}
      />

      <DeleteSectionDialog
        isOpen={!!deletingSection}
        section={deletingSection}
        onClose={() => setDeletingSection(null)}
        onConfirm={async (id) => {
          await removeSection(id);
        }}
      />
    </div>
  );
}
