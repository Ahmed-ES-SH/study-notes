"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppSidebar } from "../../components/layout/AppSidebar";
import { AppHeader } from "../../components/layout/AppHeader";
import { EditorBreadcrumb, EditorHeader } from "../../components/editor/EditorHeader";
import { EditorToolbar } from "../../components/editor/EditorToolbar";
import {
  insertAtCursor,
  MarkdownEditor,
  MarkdownEditorHandle,
} from "../../components/editor/MarkdownEditor";
import { MarkdownPreview } from "../../components/editor/MarkdownPreview";
import { NoteInspector } from "../../components/editor/NoteInspector";
import { AssetManagerModal } from "../../components/editor/AssetManagerModal";
import { FocusModeView } from "../../components/editor/FocusModeView";
import { DeleteNoteDialog } from "../../components/notes/DeleteNoteDialog";
import { useMainSections } from "../../lib/hooks/useMainSections";
import { useNoteEditor } from "../../lib/hooks/useNoteEditor";
import { useTableOfContents } from "../../lib/hooks/useTableOfContents";
import { Asset } from "../../lib/api/types";
import { deleteNote } from "../../lib/api/notes";
import { clearAssetCache } from "../../lib/utils/assetPath";
import { Button } from "../../components/common/Button";
import { AlertTriangleIcon, ChevronLeftIcon, EditIcon } from "../../components/common/Icons";

function EditorWorkspace({ noteId }: { noteId: string }) {
  const router = useRouter();
  const { sections } = useMainSections();
  const {
    note,
    context,
    isLoading,
    isNotFound,
    loadError,
    reload,
    title,
    content,
    editTitle,
    editContent,
    mode,
    setMode,
    isZen,
    enterZen,
    exitZen,
    saveStatus,
    flushSave,
    assets,
    attachNewAsset,
    removeAssetById,
  } = useNoteEditor(noteId);

  const toc = useTableOfContents(content);

  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [assetsVersion, setAssetsVersion] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const subsectionId = context?.subsection_id ?? null;
  const subsectionHref = subsectionId ? `/subsection?id=${subsectionId}` : "/";

  useEffect(() => {
    if (note) {
      document.title = `${note.title || "Untitled note"} — DevNotes`;
    }
  }, [note]);

  const breadcrumbs: EditorBreadcrumb[] = context
    ? [
        { label: context.main_section_name, href: `/section?id=${context.main_section_id}`, color: context.main_section_color },
        { label: context.subsection_name, href: subsectionHref },
        { label: title || "Untitled note" },
      ]
    : [{ label: "Note Editor" }];

  const appBreadcrumbs = [
    { label: "Main Sections", href: "/" },
    ...(context
      ? [
          { label: context.main_section_name, href: `/section?id=${context.main_section_id}` },
          { label: context.subsection_name, href: subsectionHref },
        ]
      : [{ label: "Note Editor" }]),
  ];

  // ── Actions ───────────────────────────────────────────────────────

  const handleSaveAndClose = useCallback(async () => {
    setIsClosing(true);
    setActionError(null);
    try {
      await flushSave();
      if (subsectionId) {
        router.push(subsectionHref);
      } else {
        router.push("/");
      }
    } catch (err) {
      console.error("Failed to save before closing:", err);
      setActionError(err instanceof Error ? err.message : String(err));
      setIsClosing(false);
    }
  }, [flushSave, router, subsectionId, subsectionHref]);

  const handleDeleteNote = useCallback(async () => {
    setActionError(null);
    try {
      // Pending edits must not resurrect the note after deletion.
      await flushSave();
      await deleteNote(noteId);
      router.push(subsectionHref);
    } catch (err) {
      console.error("Failed to delete note:", err);
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }, [flushSave, noteId, router, subsectionHref]);

  const handleAttachAsset = useCallback(
    async (fileName: string, fileBytes: number[], altText: string) => {
      const created = await attachNewAsset(fileName, fileBytes, altText);
      clearAssetCache();
      setAssetsVersion((v) => v + 1);
      return created;
    },
    [attachNewAsset]
  );

  const handleRemoveAsset = useCallback(
    async (asset: Asset) => {
      await removeAssetById(asset.id);
      clearAssetCache(asset.file_path);
      setAssetsVersion((v) => v + 1);
    },
    [removeAssetById]
  );

  const handleInsertAsset = useCallback((asset: Asset) => {
    const alt = asset.alt_text || "image";
    editorRef.current?.applyTransform(
      insertAtCursor(`![${alt}](${asset.file_path})\n`)
    );
    editorRef.current?.focus();
  }, []);

  const handleJumpToHeading = useCallback(
    (headingId: string) => {
      const scrollToHeading = () => {
        const pane = document.getElementById("editor-preview-scroll");
        const heading = pane?.querySelector(`[id="${headingId}"]`);
        heading?.scrollIntoView({ behavior: "smooth", block: "start" });
      };
      if (mode === "edit") {
        setMode("split");
        window.setTimeout(scrollToHeading, 80);
      } else {
        scrollToHeading();
      }
    },
    [mode, setMode]
  );

  // ── Not found / error state ───────────────────────────────────────

  if (isNotFound || loadError) {
    return (
      <div className="min-h-screen bg-background text-on-surface flex">
        <AppSidebar sections={sections} />
        <div className="flex-1 flex flex-col min-w-0 pl-64 lg:pl-72">
          <AppHeader breadcrumbs={[{ label: "Main Sections", href: "/" }, { label: "Note Editor" }]} />
          <main className="flex-1 pt-14 p-6 sm:p-8 max-w-3xl mx-auto w-full flex items-center justify-center">
            <div className="w-full p-10 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-surface-container-high text-error flex items-center justify-center mx-auto border border-outline-variant/40">
                <AlertTriangleIcon size={22} />
              </div>
              <div className="space-y-1.5 max-w-[28rem] mx-auto">
                <h1 className="font-sans font-semibold text-xl text-on-surface">
                  Note not found
                </h1>
                <p className="font-sans text-xs text-outline leading-relaxed">
                  {loadError
                    ? `Failed to load this note: ${loadError}`
                    : `The requested note ID (${noteId}) does not exist or was deleted.`}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2.5 pt-2">
                <Button variant="secondary" size="sm" onClick={reload}>
                  Retry
                </Button>
                <Link href={subsectionHref}>
                  <Button variant="primary" size="sm" icon={<ChevronLeftIcon size={13} />}>
                    Back to Notes
                  </Button>
                </Link>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Zen mode renders the full-screen overlay; the underlying header only
  // ever needs the non-zen view mode.
  const viewMode = mode === "zen" ? "split" : mode;
  const showEditorPanes = !isLoading;

  return (
    <div className="h-screen overflow-hidden bg-background text-on-surface flex">
      {/* Sidebar Navigation */}
      <AppSidebar
        sections={sections}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 h-screen transition-all duration-200 ${
          isSidebarCollapsed ? "pl-16" : "pl-64 lg:pl-72"
        }`}
      >
        <AppHeader
          breadcrumbs={appBreadcrumbs}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        <div className="flex-1 min-h-0 flex flex-col pt-14">
          {showEditorPanes && (
            <EditorHeader
              breadcrumbs={breadcrumbs}
              saveStatus={saveStatus}
              mode={viewMode}
              onModeChange={(m) => setMode(m)}
              onEnterZen={enterZen}
              isInspectorOpen={isInspectorOpen}
              onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
              onSaveAndClose={() => void handleSaveAndClose()}
              onDelete={() => setDeleting(true)}
              isBusy={isClosing}
            />
          )}

          {/* Formatting toolbar (hidden in preview mode) */}
          {showEditorPanes && viewMode !== "preview" && (
            <EditorToolbar
              editorRef={editorRef}
              onAttachImage={() => setIsAssetModalOpen(true)}
            />
          )}

          <main className="flex-1 min-h-0 flex overflow-hidden">
          {/* Editor canvas */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {isLoading ? (
              <div className="flex-1 p-6 space-y-4">
                <div className="h-10 w-2/3 rounded bg-surface-container-low border border-outline-variant/30 animate-pulse" />
                <div className="h-4 w-full rounded bg-surface-container-low border border-outline-variant/30 animate-pulse" />
                <div className="h-4 w-5/6 rounded bg-surface-container-low border border-outline-variant/30 animate-pulse" />
                <div className="h-4 w-4/6 rounded bg-surface-container-low border border-outline-variant/30 animate-pulse" />
              </div>
            ) : (
              <>
                {/* Title input */}
                <div className="px-6 pt-5 pb-2 shrink-0">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => editTitle(e.target.value)}
                    placeholder="Untitled note"
                    maxLength={200}
                    className="w-full bg-transparent font-sans font-bold text-3xl leading-snug text-on-surface placeholder:text-text-muted focus:outline-none"
                  />
                  {actionError && (
                    <div className="mt-2 p-2.5 rounded-lg bg-red-950/30 border border-red-800/50 text-error text-xs font-mono flex items-center gap-2">
                      <AlertTriangleIcon size={13} className="shrink-0" />
                      <span>Save failed: {actionError}</span>
                    </div>
                  )}
                </div>

                {/* Panes */}
                <div className="flex-1 min-h-0 flex overflow-hidden border-t border-outline-variant/30">
                  {(mode === "edit" || mode === "split") && (
                    <div
                      className={`flex-1 min-w-0 flex flex-col overflow-hidden ${
                        mode === "split" ? "border-r border-outline-variant/30" : ""
                      }`}
                    >
                      <MarkdownEditor
                        ref={editorRef}
                        value={content}
                        onChange={editContent}
                      />
                    </div>
                  )}

                  {(mode === "split" || mode === "preview") && (
                    <div
                      id="editor-preview-scroll"
                      className={`min-w-0 overflow-y-auto px-6 pb-16 ${
                        mode === "split" ? "flex-1 basis-1/2" : "flex-1"
                      }`}
                    >
                      <MarkdownPreview
                        content={content}
                        assetsVersion={assetsVersion}
                        className="py-2 max-w-3xl"
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Inspector drawer */}
          {showEditorPanes && isInspectorOpen && (
            <NoteInspector
              toc={toc}
              assets={assets}
              note={note}
              onJumpToHeading={handleJumpToHeading}
              onInsertAsset={handleInsertAsset}
              onRemoveAsset={(asset) => void handleRemoveAsset(asset)}
              onManageAssets={() => setIsAssetModalOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Full-screen focus mode */}
      {isZen && note && (
        <FocusModeView
          title={title}
          content={content}
          subsectionId={subsectionId ?? ""}
          onExit={exitZen}
          assetsVersion={assetsVersion}
        />
      )}

      {/* Asset manager */}
      <AssetManagerModal
        isOpen={isAssetModalOpen}
        assets={assets}
        onClose={() => setIsAssetModalOpen(false)}
        onAttach={handleAttachAsset}
        onRemove={handleRemoveAsset}
      />

      {/* Cascade delete confirmation */}
      {note && (
        <DeleteNoteDialog
          isOpen={deleting}
          note={note}
          onClose={() => setDeleting(false)}
          onConfirm={handleDeleteNote}
        />
      )}
      </div>
    </div>
  );
}

function EditorRouteContent() {
  const searchParams = useSearchParams();
  const noteId = searchParams.get("id");

  if (!noteId) {
    return (
      <div className="min-h-screen bg-background text-on-surface flex items-center justify-center p-6">
        <div className="w-full max-w-[28rem] p-10 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-surface-container-high text-primary flex items-center justify-center mx-auto border border-outline-variant/40">
            <EditIcon size={22} />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-sans font-semibold text-xl text-on-surface">
              No note selected
            </h1>
            <p className="font-sans text-xs text-outline leading-relaxed">
              Open a note from a subsection to start editing it here.
            </p>
          </div>
          <EditorHomeLink />
        </div>
      </div>
    );
  }

  // Keyed remount per note: guarantees autosave flushes with the correct
  // note id when navigating between notes.
  return <EditorWorkspace key={noteId} noteId={noteId} />;
}

function EditorHomeLink() {
  return (
    <Link href="/" className="inline-block">
      <Button variant="primary" size="sm">
        Back to Main Sections
      </Button>
    </Link>
  );
}

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center font-mono text-xs text-outline">
          Loading editor...
        </div>
      }
    >
      <EditorRouteContent />
    </Suspense>
  );
}
