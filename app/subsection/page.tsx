"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppSidebar } from "../../components/layout/AppSidebar";
import { AppHeader } from "../../components/layout/AppHeader";
import { NoteHeader } from "../../components/notes/NoteHeader";
import { NoteToolbar } from "../../components/notes/NoteToolbar";
import { NoteList } from "../../components/notes/NoteList";
import { CreateNoteModal } from "../../components/notes/CreateNoteModal";
import { EditNoteTitleModal } from "../../components/notes/EditNoteTitleModal";
import { DeleteNoteDialog } from "../../components/notes/DeleteNoteDialog";
import { useMainSections } from "../../lib/hooks/useMainSections";
import { useNotes } from "../../lib/hooks/useNotes";
import { Note } from "../../lib/api/types";
import { Button } from "../../components/common/Button";
import { ChevronLeftIcon } from "../../components/common/Icons";

function SubsectionNotesContent() {
  const searchParams = useSearchParams();
  const subsectionId = searchParams.get("id");

  const {
    sections,
    isLoading: isLoadingSections,
  } = useMainSections();
  const {
    notes,
    filteredNotes,
    isLoading: isLoadingNotes,
    error,
    searchQuery,
    setSearchQuery,
    reload,
    addNote,
    renameNote,
    removeNote,
  } = useNotes(subsectionId);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [renamingNote, setRenamingNote] = useState<Note | null>(null);
  const [deletingNote, setDeletingNote] = useState<Note | null>(null);

  const parentSection = sections.find((s) =>
    s.subsections?.some((sub) => sub.id === subsectionId)
  );
  const currentSubsection = parentSection?.subsections?.find(
    (sub) => sub.id === subsectionId
  );

  const isNotFound = !isLoadingSections && !currentSubsection;

  useEffect(() => {
    if (currentSubsection) {
      document.title = `${currentSubsection.name} — DevNotes`;
    }
  }, [currentSubsection]);

  const breadcrumbs = [
    { label: "Main Sections", href: "/" },
    parentSection
      ? { label: parentSection.name, href: `/section?id=${parentSection.id}` }
      : { label: "Sections", href: "/" },
    { label: currentSubsection ? currentSubsection.name : "Notes" },
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

        <main className="flex-1 pt-14 p-6 sm:p-8 lg:p-10 max-w-5xl mx-auto w-full space-y-6">
          {/* Back Button */}
          <div>
            <Link
              href={parentSection ? `/section?id=${parentSection.id}` : "/"}
              className="inline-flex items-center gap-1.5 font-mono text-xs text-outline hover:text-on-surface transition-colors py-1"
            >
              <ChevronLeftIcon size={14} />
              <span>Back to Subsections</span>
            </Link>
          </div>

          {isLoadingSections ? (
            <div className="h-36 rounded-xl bg-surface-container-low border border-outline-variant/30 animate-pulse" />
          ) : isNotFound ? (
            <div className="p-10 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-surface-container-high text-error flex items-center justify-center mx-auto border border-outline-variant/40">
                <span className="font-mono text-lg font-bold">?</span>
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h1 className="font-sans font-semibold text-xl text-on-surface">
                  Subsection not found
                </h1>
                <p className="font-sans text-xs text-outline leading-relaxed">
                  The requested subsection ID ({subsectionId || "none"}) does
                  not exist or was deleted.
                </p>
              </div>
              <Link href="/">
                <Button variant="primary">Back to Main Sections</Button>
              </Link>
            </div>
          ) : currentSubsection ? (
            <>
              {/* Context Header with Breadcrumbs */}
              <NoteHeader
                subsection={currentSubsection}
                mainSection={parentSection ?? null}
                noteCount={notes.length}
                onCreateNote={() => setIsCreateOpen(true)}
              />

              {/* Search Toolbar */}
              <NoteToolbar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                totalCount={notes.length}
                filteredCount={filteredNotes.length}
              />

              {/* Error Banner */}
              {error && (
                <div className="p-3 rounded-lg bg-red-950/30 border border-red-800/50 text-error text-xs font-mono flex items-center justify-between gap-3">
                  <span>Error loading notes: {error}</span>
                  <Button variant="secondary" size="sm" onClick={reload}>
                    Retry
                  </Button>
                </div>
              )}

              {/* Notes Stream */}
              <NoteList
                notes={filteredNotes}
                totalNotes={notes.length}
                searchQuery={searchQuery}
                isLoading={isLoadingNotes}
                onClearSearch={() => setSearchQuery("")}
                onCreateNote={() => setIsCreateOpen(true)}
                onRename={setRenamingNote}
                onDelete={setDeletingNote}
              />
            </>
          ) : null}
        </main>
      </div>

      {/* Modals & Confirmation Dialogs */}
      {currentSubsection && (
        <CreateNoteModal
          isOpen={isCreateOpen}
          subsectionName={currentSubsection.name}
          subsectionColor={parentSection?.color ?? "#8b919f"}
          onClose={() => setIsCreateOpen(false)}
          onSubmit={addNote}
        />
      )}

      <EditNoteTitleModal
        isOpen={!!renamingNote}
        note={renamingNote}
        onClose={() => setRenamingNote(null)}
        onSubmit={renameNote}
      />

      <DeleteNoteDialog
        isOpen={!!deletingNote}
        note={deletingNote}
        onClose={() => setDeletingNote(null)}
        onConfirm={removeNote}
      />
    </div>
  );
}

export default function SubsectionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center font-mono text-xs text-outline">
          Loading notes stream...
        </div>
      }
    >
      <SubsectionNotesContent />
    </Suspense>
  );
}
