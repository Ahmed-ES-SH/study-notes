"use client";

import React from "react";
import Link from "next/link";
import { ChevronRightIcon, TerminalIcon, BookIcon, SidebarToggleIcon } from "../common/Icons";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface AppHeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export function AppHeader({
  breadcrumbs = [
    { label: "DevNotes Core", href: "/" },
    { label: "Sections Directory", href: "/" },
    { label: "Overview" },
  ],
  isSidebarCollapsed = false,
  onToggleSidebar,
}: AppHeaderProps) {
  return (
    <header
      className={`fixed top-0 right-0 h-14 bg-background/85 backdrop-blur-xl border-b border-outline-variant/40 z-30 flex items-center justify-between px-4 sm:px-6 transition-all duration-200 ${
        isSidebarCollapsed ? "left-16" : "left-64 lg:left-72"
      }`}
    >
      {/* Left: Sidebar Toggle (mobile/desktop) + Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="text-outline hover:text-on-surface p-1 rounded-md hover:bg-surface-container-high transition-colors md:hidden"
            title="Toggle Navigation"
          >
            <SidebarToggleIcon size={18} />
          </button>
        )}

        <nav className="flex items-center gap-1.5 font-mono text-xs text-outline min-w-0">
          {breadcrumbs.map((item, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRightIcon size={12} className="text-outline/60 shrink-0" />}
                {item.href && !isLast ? (
                  <Link
                    href={item.href}
                    className="hover:text-on-surface transition-colors truncate max-w-[140px]"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    className={`truncate max-w-[160px] ${
                      isLast ? "text-on-surface font-semibold" : ""
                    }`}
                  >
                    {item.label}
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Right: Status & Quick Actions */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Synced Badge */}
        <div className="hidden sm:flex items-center gap-1.5 font-mono text-[11px] text-secondary bg-surface-container-high/80 border border-outline-variant/30 px-2.5 py-1 rounded-full shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
          <span>Local Sync Active</span>
        </div>

        {/* Quick Action Icons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="text-outline hover:text-on-surface p-1.5 rounded-lg hover:bg-surface-container-high transition-colors"
            title="Study Mode (Coming soon)"
          >
            <BookIcon size={16} />
          </button>
          <button
            type="button"
            className="text-outline hover:text-on-surface p-1.5 rounded-lg hover:bg-surface-container-high transition-colors"
            title="Command Palette (Cmd+K)"
          >
            <TerminalIcon size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
