"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { renderMarkdown } from "../../lib/utils/markdownRenderer";
import { isManagedAssetPath, resolveAssetSrc } from "../../lib/utils/assetPath";

export interface MarkdownPreviewProps {
  content: string;
  /** Bump to re-resolve asset data URLs after attachments change. */
  assetsVersion?: number;
  className?: string;
}

/**
 * Resolves every managed asset referenced in the markdown to an inline data
 * URL so the renderer can embed local images without any network access.
 */
function useAssetSrcMap(content: string, assetsVersion: number): Record<string, string> {
  const [assetSrcMap, setAssetSrcMap] = useState<Record<string, string>>({});

  const referencedPaths = useMemo(() => {
    const paths = new Set<string>();
    const imgRe = /!\[[^\]]*\]\(([^)\s]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = imgRe.exec(content)) !== null) {
      const path = match[1].trim();
      if (isManagedAssetPath(path)) {
        paths.add(path);
      }
    }
    return Array.from(paths);
  }, [content]);

  useEffect(() => {
    if (referencedPaths.length === 0) return;

    let isMounted = true;
    Promise.all(
      referencedPaths.map(async (path) => ({
        path,
        src: await resolveAssetSrc(path),
      }))
    ).then((results) => {
      if (!isMounted) return;
      const next: Record<string, string> = {};
      for (const { path, src } of results) {
        if (src) next[path] = src;
      }
      setAssetSrcMap(next);
    });

    return () => {
      isMounted = false;
    };
  }, [referencedPaths, assetsVersion]);

  // Stale entries for paths no longer referenced are harmless — the
  // renderer only looks up paths present in the current content.
  return referencedPaths.length === 0 ? EMPTY_ASSET_MAP : assetSrcMap;
}

const EMPTY_ASSET_MAP: Record<string, string> = {};

export function MarkdownPreview({
  content,
  assetsVersion = 0,
  className = "",
}: MarkdownPreviewProps) {
  const assetSrcMap = useAssetSrcMap(content, assetsVersion);

  const html = useMemo(
    () => renderMarkdown(content, assetSrcMap),
    [content, assetSrcMap]
  );

  // Event delegation for the code-block copy buttons (the HTML string can't
  // carry React handlers).
  const handleCopyClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const button = target.closest(".md-copy-btn");
    if (!button) return;

    const codeblock = button.closest(".md-codeblock");
    const code = codeblock?.querySelector("pre code");
    if (!code) return;

    const text = code.textContent ?? "";
    const fallbackCopy = () => {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy");
      } finally {
        document.body.removeChild(area);
      }
    };

    const done = () => {
      const original = button.textContent;
      button.textContent = "Copied!";
      window.setTimeout(() => {
        button.textContent = original;
      }, 1500);
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done, () => {
        fallbackCopy();
        done();
      });
    } else {
      fallbackCopy();
      done();
    }
  }, []);

  return (
    <div
      className={`md-prose ${className}`}
      onClick={handleCopyClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
