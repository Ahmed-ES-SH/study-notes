"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppSidebar } from "../../components/layout/AppSidebar";
import { AppHeader } from "../../components/layout/AppHeader";
import { useMainSections } from "../../lib/hooks/useMainSections";
import { Button } from "../../components/common/Button";
import { ChevronLeftIcon, CodeIcon, BookIcon } from "../../components/common/Icons";

function SectionDetailContent() {
  const searchParams = useSearchParams();
  const sectionId = searchParams.get("id");
  const { sections, isLoading } = useMainSections();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const currentSection = sections.find((s) => s.id === sectionId);

  useEffect(() => {
    if (currentSection) {
      document.title = `${currentSection.name} — DevNotes`;
    }
  }, [currentSection]);

  const breadcrumbs = [
    { label: "DevNotes Core", href: "/" },
    { label: "Sections", href: "/" },
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

        <main className="flex-1 pt-14 p-6 sm:p-8 lg:p-10 max-w-5xl mx-auto w-full space-y-6">
          {/* Back button */}
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 font-mono text-xs text-outline hover:text-on-surface transition-colors py-1"
            >
              <ChevronLeftIcon size={14} />
              <span>Back to Sections Directory</span>
            </Link>
          </div>

          {/* Section Heading Banner */}
          {isLoading ? (
            <div className="h-32 rounded-xl bg-surface-container-low border border-outline-variant/30 animate-pulse p-6" />
          ) : currentSection ? (
            <div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant/50 space-y-4">
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center border border-outline-variant/40 shadow-xs shrink-0"
                  style={{
                    backgroundColor: `${currentSection.color}20`,
                    color: currentSection.color,
                  }}
                >
                  <CodeIcon size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: currentSection.color }}
                    />
                    <span
                      className="font-mono text-xs uppercase tracking-wider font-semibold"
                      style={{ color: currentSection.color }}
                    >
                      Active Domain
                    </span>
                  </div>
                  <h1 className="font-sans text-2xl sm:text-3xl font-bold text-on-surface">
                    {currentSection.name}
                  </h1>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="flex flex-wrap gap-4 pt-2 border-t border-outline-variant/40 font-mono text-xs text-outline">
                <div>
                  <span className="text-on-surface font-semibold">
                    {currentSection.stats?.subsection_count ?? 0}
                  </span>{" "}
                  Subsections
                </div>
                <div>•</div>
                <div>
                  <span className="text-on-surface font-semibold">
                    {currentSection.stats?.note_count ?? 0}
                  </span>{" "}
                  Notes
                </div>
                <div>•</div>
                <div>
                  <span className="text-on-surface font-semibold">
                    {currentSection.stats?.asset_count ?? 0}
                  </span>{" "}
                  Assets
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant/50">
              <h2 className="font-sans text-xl font-semibold text-on-surface">
                Section Not Found
              </h2>
              <p className="font-sans text-xs text-outline mt-1">
                The requested section ID ({sectionId || "none"}) does not exist.
              </p>
            </div>
          )}

          {/* Phase 3 Placeholder Info Box */}
          <div className="p-8 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-surface-container-high text-primary flex items-center justify-center mx-auto border border-outline-variant/40">
              <BookIcon size={24} />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="font-sans font-semibold text-lg text-on-surface">
                Phase 3: Subsections & Topics View
              </h3>
              <p className="font-sans text-xs text-outline leading-relaxed">
                This route will render the full Subsections stream (Page 2),
                including topic cards, note outlines, search filters, and breadcrumb navigation.
              </p>
            </div>
            <Link href="/">
              <Button variant="secondary" size="sm">
                Return to Directory
              </Button>
            </Link>
          </div>
        </main>
      </div>
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
