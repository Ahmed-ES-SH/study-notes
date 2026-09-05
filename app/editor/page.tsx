"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppSidebar } from "../../components/layout/AppSidebar";
import { AppHeader } from "../../components/layout/AppHeader";
import { useMainSections } from "../../lib/hooks/useMainSections";
import { Button } from "../../components/common/Button";
import { ChevronLeftIcon, EditIcon } from "../../components/common/Icons";

function EditorPlaceholderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const noteId = searchParams.get("id");
  const { sections } = useMainSections();

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      <AppSidebar sections={sections} />

      <div className="flex-1 flex flex-col min-w-0 pl-64 lg:pl-72">
        <AppHeader
          breadcrumbs={[
            { label: "Main Sections", href: "/" },
            { label: "Note Editor" },
          ]}
        />

        <main className="flex-1 pt-14 p-6 sm:p-8 lg:p-10 max-w-3xl mx-auto w-full flex items-center justify-center">
          <div className="w-full p-10 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-surface-container-high text-primary flex items-center justify-center mx-auto border border-outline-variant/40">
              <EditIcon size={24} />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h1 className="font-sans font-semibold text-xl text-on-surface">
                Note Editor
              </h1>
              <p className="font-sans text-xs text-outline leading-relaxed">
                This route will render the full Note Editor/Viewer (Page 4) —
                markdown editing, live preview, and asset management — arriving
                in Phase 5.
              </p>
            </div>
            {noteId && (
              <p className="font-mono text-[11px] text-outline pt-1">
                Note ID: {noteId}
              </p>
            )}
            <div className="flex items-center justify-center gap-2.5 pt-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<ChevronLeftIcon size={13} />}
                onClick={() => router.back()}
              >
                Go Back
              </Button>
              <Link href="/">
                <Button variant="ghost" size="sm">
                  Main Sections
                </Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
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
      <EditorPlaceholderContent />
    </Suspense>
  );
}
