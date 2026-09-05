"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppSidebar } from "../../components/layout/AppSidebar";
import { AppHeader } from "../../components/layout/AppHeader";
import { SubsectionHero } from "../../components/subsections/SubsectionHero";
import {
  SubsectionToolbar,
  SubsectionViewMode,
} from "../../components/subsections/SubsectionToolbar";
import { SubsectionList } from "../../components/subsections/SubsectionList";
import { CreateSubsectionModal } from "../../components/subsections/CreateSubsectionModal";
import { EditSubsectionModal } from "../../components/subsections/EditSubsectionModal";
import { DeleteSubsectionDialog } from "../../components/subsections/DeleteSubsectionDialog";
import { EditSectionModal } from "../../components/sections/EditSectionModal";
import { useMainSections } from "../../lib/hooks/useMainSections";
import { useSubsections } from "../../lib/hooks/useSubsections";
import { SubsectionWithDetails } from "../../lib/api/types";
import { Button } from "../../components/common/Button";
import { ChevronLeftIcon, PlusIcon } from "../../components/common/Icons";

function SectionDetailContent() {
  const searchParams = useSearchParams();
  const sectionId = searchParams.get("id");

  const { sections, isLoading: isLoadingSections, editSection } = useMainSections();  const {
    subsections,
    filteredSubsections,
    isLoading: isLoadingSubsections,
    error,
    searchQuery,
    setSearchQuery,
    addSubsection,
    renameSubsection,
    removeSubsection,
    reorderSubsections,
    addNote,
  } = useSubsections(sectionId);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<SubsectionViewMode>("detailed");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [renamingSubsection, setRenamingSubsection] = useState<SubsectionWithDetails | null>(null);
  const [deletingSubsection, setDeletingSubsection] = useState<SubsectionWithDetails | null>(null);
  const [isEditMetaOpen, setIsEditMetaOpen] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);

  const currentSection = sections.find((s) => s.id === sectionId);
  const isNotFound = !isLoadingSections && !currentSection;

  const totalNotes = subsections.reduce((acc, s) => acc + s.notes.length, 0);

  useEffect(() => {
    if (currentSection) {
      document.title = `${currentSection.name} — DevNotes`;
    }
  }, [currentSection]);

  const breadcrumbs = [
    { label: "Main Sections", href: "/" },
    { label: currentSection ? currentSection.name : "Knowledge Domain" },
  ];

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      {/* Sidebar Navigation */}
      <AppSidebar
        sections={sections}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          isSidebarCollapsed ? "pl-16" : "pl-64 lg:pl-72"
        }`}
      >
        <AppHeader
          breadcrumbs={breadcrumbs}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        <main className="flex-1 pt-14 p-6 sm:p-8 lg:p-10 max-w-6xl mx-auto w-full space-y-6">
          {/* Back Button */}
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 font-mono text-xs text-outline hover:text-on-surface transition-colors py-1"
            >
              <ChevronLeftIcon size={14} />
              <span>Back to Sections Directory</span>
            </Link>
          </div>

          {/* Parent Section Hero */}
          {isLoadingSections ? (
            <div className="h-36 rounded-xl bg-surface-container-low border border-outline-variant/30 animate-pulse p-6" />
          ) : currentSection ? (
            <SubsectionHero
              section={currentSection}
              subsectionCount={subsections.length}
              noteCount={totalNotes}
              onEditMeta={() => setIsEditMetaOpen(true)}
            />
          ) : isNotFound ? (
            <div className="p-10 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-surface-container-high text-error flex items-center justify-center mx-auto border border-outline-variant/40">
                <span className="font-mono text-lg font-bold">?</span>
              </div>
              <div className="space-y-1.5 max-w-[28rem] mx-auto">
                <h2 className="font-sans font-semibold text-xl text-on-surface">
                  Main Section not found
                </h2>
                <p className="font-sans text-xs text-outline leading-relaxed">
                  The requested section ID ({sectionId || "none"}) does not exist or was deleted.
                </p>
              </div>
              <Link href="/">
                <Button variant="primary">Back to Sections Directory</Button>
              </Link>
            </div>
          ) : null}

          {/* Toolbar */}
          {currentSection && (
            <SubsectionToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              totalCount={subsections.length}
              filteredCount={filteredSubsections.length}
              onCreateSubsection={() => setIsCreateOpen(true)}
            />
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-lg bg-red-950/30 border border-red-800/50 text-error text-xs font-mono">
              Error loading subsections: {error}
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

          {/* Subsection Stream */}
          {currentSection && (
            <SubsectionList
              subsections={filteredSubsections}
              totalSubsections={subsections.length}
              searchQuery={searchQuery}
              viewMode={viewMode}
              isLoading={isLoadingSubsections}
              sectionColor={currentSection.color}
              onClearSearch={() => setSearchQuery("")}
              onCreateSubsection={() => setIsCreateOpen(true)}
              onRename={setRenamingSubsection}
              onDelete={setDeletingSubsection}
              onAddNote={addNote}
              onReorder={reorderSubsections}
              onReorderError={(message) => setReorderError(message)}
              reorderEnabled={!searchQuery.trim()}
            />
          )}

          {/* Bottom Quick Creation Banner */}
          {currentSection && !isLoadingSubsections && subsections.length > 0 && (
            <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/40 border-dashed">
              <p className="font-sans text-xs text-outline">
                Need another topic inside{" "}
                <span className="text-on-surface font-semibold">{currentSection.name}</span>?
              </p>
              <Button
                variant="secondary"
                size="sm"
                icon={<PlusIcon size={13} />}
                onClick={() => setIsCreateOpen(true)}
                className="shrink-0"
              >
                New Subsection
              </Button>
            </div>
          )}
        </main>
      </div>

      {/* Modals & Confirmation Dialogs */}
      {currentSection && (
        <CreateSubsectionModal
          isOpen={isCreateOpen}
          parentSectionName={currentSection.name}
          parentSectionColor={currentSection.color}
          onClose={() => setIsCreateOpen(false)}
          onSubmit={addSubsection}
        />
      )}

      <EditSubsectionModal
        isOpen={!!renamingSubsection}
        subsection={renamingSubsection}
        onClose={() => setRenamingSubsection(null)}
        onSubmit={renameSubsection}
      />

      <DeleteSubsectionDialog
        isOpen={!!deletingSubsection}
        subsection={deletingSubsection}
        onClose={() => setDeletingSubsection(null)}
        onConfirm={removeSubsection}
      />

      {currentSection && (
        <EditSectionModal
          isOpen={isEditMetaOpen}
          section={currentSection}
          onClose={() => setIsEditMetaOpen(false)}
          onSubmit={async (id, name, color) => {
            await editSection(id, name, color);
          }}
        />
      )}
    </div>
  );
}

export default function SectionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center font-mono text-xs text-outline">
          Loading section stream...
        </div>
      }
    >
      <SectionDetailContent />
    </Suspense>
  );
}
