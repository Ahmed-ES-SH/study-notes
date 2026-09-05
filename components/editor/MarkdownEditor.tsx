"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

export interface EditorTransformResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export type EditorTransform = (
  value: string,
  selectionStart: number,
  selectionEnd: number
) => EditorTransformResult;

export interface MarkdownEditorHandle {
  /** Applies a text transform at the current selection and restores focus. */
  applyTransform: (transform: EditorTransform) => void;
  focus: () => void;
}

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const AUTO_CLOSE_PAIRS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  '"': '"',
  "'": "'",
  "`": "`",
  "*": "*",
};

function indentLines(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  dedent: boolean
): EditorTransformResult {
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEndIndex = value.indexOf("\n", selectionEnd);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");

  const nextLines = lines.map((line) => {
    if (dedent) {
      return line.replace(/^( {1,2}|\t)/, "");
    }
    return line.trim().length > 0 || lines.length > 1 ? `  ${line}` : `  ${line}`;
  });

  const nextBlock = nextLines.join("\n");
  const nextValue = value.slice(0, lineStart) + nextBlock + value.slice(lineEnd);

  return {
    value: nextValue,
    selectionStart: lineStart,
    selectionEnd: lineStart + nextBlock.length,
  };
}

/** Continues markdown lists on Enter: `- `, `* `, `1. ` prefixes. */
function continueList(
  value: string,
  selectionStart: number,
  selectionEnd: number
): EditorTransformResult | null {
  if (selectionStart !== selectionEnd) return null;

  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const currentLine = value.slice(lineStart, selectionStart);
  const marker = currentLine.match(/^(\s*)([-*+]|\d+\.)(\s+)/);

  if (!marker) return null;

  const [, indent, bullet, space] = marker;
  const rest = currentLine.slice(marker[0].length);

  // Empty list item: pressing Enter breaks out of the list instead.
  if (rest.trim() === "") {
    const nextValue = value.slice(0, lineStart) + "\n" + value.slice(selectionStart);
    return { value: nextValue, selectionStart: lineStart + 1, selectionEnd: lineStart + 1 };
  }

  const nextBullet = /^\d+\.$/.test(bullet) ? `${parseInt(bullet, 10) + 1}.` : bullet;
  const insertion = `\n${indent}${nextBullet}${space}`;
  const nextValue = value.slice(0, selectionStart) + insertion + value.slice(selectionEnd);

  return {
    value: nextValue,
    selectionStart: selectionStart + insertion.length,
    selectionEnd: selectionStart + insertion.length,
  };
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor({ value, onChange, disabled = false }, ref) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const gutterRef = useRef<HTMLDivElement>(null);
    const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);

    const lineCount = useMemo(() => value.split("\n").length, [value]);

    const applySelection = useCallback(() => {
      const pending = pendingSelectionRef.current;
      if (pending && textareaRef.current) {
        textareaRef.current.selectionStart = pending.start;
        textareaRef.current.selectionEnd = pending.end;
        pendingSelectionRef.current = null;
      }
    }, []);

    // Restore the selection after React commits the transformed value.
    useEffect(() => {
      applySelection();
    }, [value, applySelection]);

    const applyTransform = useCallback(
      (transform: EditorTransform) => {
        const textarea = textareaRef.current;
        if (!textarea || disabled) return;

        const result = transform(
          textarea.value,
          textarea.selectionStart,
          textarea.selectionEnd
        );
        pendingSelectionRef.current = {
          start: result.selectionStart,
          end: result.selectionEnd,
        };
        onChange(result.value);
      },
      [disabled, onChange]
    );

    useImperativeHandle(
      ref,
      () => ({
        applyTransform,
        focus: () => textareaRef.current?.focus(),
      }),
      [applyTransform]
    );

    const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
      if (gutterRef.current) {
        gutterRef.current.scrollTop = e.currentTarget.scrollTop;
      }
    }, []);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const textarea = e.currentTarget;
        const mod = e.metaKey || e.ctrlKey;

        // Formatting shortcuts.
        if (mod && !e.shiftKey && !e.altKey) {
          const key = e.key.toLowerCase();
          if (key === "b") {
            e.preventDefault();
            applyTransform((v, s, t) => wrapSelection(v, s, t, "**"));
            return;
          }
          if (key === "i") {
            e.preventDefault();
            applyTransform((v, s, t) => wrapSelection(v, s, t, "*"));
            return;
          }
          if (key === "k") {
            e.preventDefault();
            applyTransform(insertLink);
            return;
          }
        }

        // Tab / Shift+Tab indent.
        if (e.key === "Tab") {
          e.preventDefault();
          applyTransform((v, s, t) => indentLines(v, s, t, e.shiftKey));
          return;
        }

        // Enter continues lists.
        if (e.key === "Enter" && !e.shiftKey && !mod) {
          const listResult = continueList(textarea.value, textarea.selectionStart, textarea.selectionEnd);
          if (listResult) {
            e.preventDefault();
            pendingSelectionRef.current = {
              start: listResult.selectionStart,
              end: listResult.selectionEnd,
            };
            onChange(listResult.value);
          }
          return;
        }

        // Auto-closing brackets / quotes; wrap when a range is selected.
        const closing = AUTO_CLOSE_PAIRS[e.key];
        if (closing && !mod && !e.altKey) {
          e.preventDefault();
          const { selectionStart: s, selectionEnd: t } = textarea;
          const selected = textarea.value.slice(s, t);
          if (selected.length > 0) {
            applyTransform((v, vs, vt) => ({
              value:
                v.slice(0, vs) + e.key + v.slice(vs, vt) + closing + v.slice(vt),
              selectionStart: vs + 1,
              selectionEnd: vt + 1,
            }));
          } else {
            applyTransform((v, vs) => ({
              value: v.slice(0, vs) + e.key + closing + v.slice(vs),
              selectionStart: vs + 1,
              selectionEnd: vs + 1,
            }));
          }
          return;
        }
      },
      [applyTransform, onChange]
    );

    return (
      <div className="flex flex-1 min-h-0 overflow-hidden font-mono text-[13px] leading-[1.65]">
        {/* Line number gutter */}
        <div
          ref={gutterRef}
          aria-hidden
          className="w-12 shrink-0 overflow-hidden text-right py-4 pr-2 pl-3 select-none text-text-muted border-r border-outline-variant/30 bg-surface-container-lowest/50"
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="h-[1.65em]">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Markdown source */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          spellCheck={false}
          placeholder="# Start writing your note in markdown..."
          className="flex-1 min-w-0 h-full resize-none bg-transparent px-4 py-4 text-on-surface placeholder:text-text-muted focus:outline-none disabled:opacity-60"
        />
      </div>
    );
  }
);

// ── Shared transforms (also used by the toolbar) ────────────────────

/** Toggles `marker` around the selection (bold, italic, code, strike). */
export function wrapSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  marker: string
): EditorTransformResult {
  const selected = value.slice(selectionStart, selectionEnd);

  if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= marker.length * 2) {
    const unwrapped = selected.slice(marker.length, selected.length - marker.length);
    return {
      value:
        value.slice(0, selectionStart) + unwrapped + value.slice(selectionEnd),
      selectionStart,
      selectionEnd: selectionStart + unwrapped.length,
    };
  }

  const before = value.slice(Math.max(0, selectionStart - marker.length), selectionStart);
  const after = value.slice(selectionEnd, selectionEnd + marker.length);
  if (before === marker && after === marker) {
    return {
      value:
        value.slice(0, selectionStart - marker.length) +
        selected +
        value.slice(selectionEnd + marker.length),
      selectionStart: selectionStart - marker.length,
      selectionEnd: selectionEnd - marker.length,
    };
  }

  return {
    value:
      value.slice(0, selectionStart) +
      marker +
      selected +
      marker +
      value.slice(selectionEnd),
    selectionStart: selectionStart + marker.length,
    selectionEnd: selectionStart + marker.length + selected.length,
  };
}

/** Toggles a line prefix (`# `, `## `, `### `, `- `, `1. `, `> `) on the selection block. */
export function toggleLinePrefix(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string
): EditorTransformResult {
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEndIndex = value.indexOf("\n", selectionEnd);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");

  const allHavePrefix = lines.every((line) => line.startsWith(prefix));
  const nextLines = lines.map((line) => {
    if (allHavePrefix) {
      return line.startsWith(prefix) ? line.slice(prefix.length) : line;
    }
    const stripped = line.replace(/^(#{1,6}\s|[-*+]\s|\d+\.\s|>\s)/, "");
    return prefix + stripped;
  });

  const nextBlock = nextLines.join("\n");
  return {
    value: value.slice(0, lineStart) + nextBlock + value.slice(lineEnd),
    selectionStart: lineStart,
    selectionEnd: lineStart + nextBlock.length,
  };
}

/** Inserts a fenced code block with the given language tag. */
export function insertCodeBlock(
  lang: string
): EditorTransform {
  return (value, selectionStart, selectionEnd) => {
    const selected = value.slice(selectionStart, selectionEnd);
    const fenceOpen = "```" + lang + "\n";
    const fenceClose = "\n```";

    const nextValue =
      value.slice(0, selectionStart) + fenceOpen + selected + fenceClose + value.slice(selectionEnd);
    const codeStart = selectionStart + fenceOpen.length;
    return {
      value: nextValue,
      selectionStart: codeStart,
      selectionEnd: codeStart + selected.length,
    };
  };
}

/** Inserts a `[label](url)` link, wrapping the selection when present. */
export function insertLink(
  value: string,
  selectionStart: number,
  selectionEnd: number
): EditorTransformResult {
  const selected = value.slice(selectionStart, selectionEnd);
  const label = selected || "link text";
  const insertion = `[${label}](url)`;
  const nextValue =
    value.slice(0, selectionStart) + insertion + value.slice(selectionEnd);
  const urlStart = selectionStart + label.length + 3;
  return {
    value: nextValue,
    selectionStart: urlStart,
    selectionEnd: urlStart + 3,
  };
}

/** Inserts arbitrary text at the cursor (used for media attachments). */
export function insertAtCursor(text: string): EditorTransform {
  return (value, selectionStart, selectionEnd) => {
    const nextValue =
      value.slice(0, selectionStart) + text + value.slice(selectionEnd);
    const cursor = selectionStart + text.length;
    return { value: nextValue, selectionStart: cursor, selectionEnd: cursor };
  };
}
