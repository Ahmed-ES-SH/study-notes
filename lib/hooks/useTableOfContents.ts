"use client";

import { useMemo } from "react";
import { TableOfContentsItem } from "../api/types";
import { parseTableOfContents } from "../utils/markdownRenderer";

/**
 * Live heading outline for the current markdown text. Anchor ids match the
 * ones emitted by `renderMarkdown`, so TOC clicks can scroll to
 * `document.getElementById(item.id)` inside the preview pane.
 */
export function useTableOfContents(markdown: string): TableOfContentsItem[] {
  return useMemo(() => parseTableOfContents(markdown), [markdown]);
}
