"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppSidebar } from "../../components/layout/AppSidebar";
import { AppHeader } from "../../components/layout/AppHeader";
import { useMainSections } from "../../lib/hooks/useMainSections";
import { Button } from "../../components/common/Button";
import { ChevronLeftIcon, BookIcon } from "../../components/common/Icons";

function SubsectionNotesContent() {
  const searchParams = useSearchParams();
  const subsectionId = searchParams.get("id");
  const { sections, isLoading } = useMainSections();

  const parentSection = sections.find((s) =>
    s.subsections?.some((sub) => sub.id === subsectionId)
  );
  const currentSubsection = parentSection?.subsections?.find(
    (sub) => sub.id === subsectionId
  );

  const breadcrumbs = [
    { label: "Main Sections", href: "/" },
    parentSection
      ? { label: parentSection.name, href: `/section?id=${parentSection.id}` }
      : { label: "Sections", href: "/" },
    { label: currentSubsection ? currentSubsection.name : "Notes" },
  ];

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      <AppSidebar sections={sections} />

      <div className="flex-1 flex flex-col min-w-0 pl-64 lg:pl-72">
        <AppHeader breadcrumbs={breadcrumbs} />

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

          <div className="p-10 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-surface-container-high text-primary flex items-center justify-center mx-auto border border-outline-variant/40">
              <BookIcon size={24} />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h1 className="font-sans font-semibold text-xl text-on-surface">
                {currentSubsection ? currentSubsection.name : "Notes List"}
              </h1>
              <p className="font-sans text-xs text-outline leading-relaxed">
                This route will render the full Notes List (Page 3) — note cards,
                search, creation, and navigation into the Note Editor.
              </p>
            </div>
            <Link href="/">
              <Button variant="secondary" size="sm">
                Return to Directory
              </Button>
            </Link>
            {!isLoading && !currentSubsection && (
              <p className="font-mono text-[11px] text-outline pt-2">
                Subsection ID: {subsectionId || "none"}
              </p>
            )}
          </div>
        </main>
      </div>
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
