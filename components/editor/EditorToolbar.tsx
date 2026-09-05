"use client";

import React, { useState } from "react";
import {
  BlockquoteIcon,
  BoldIcon,
  BulletListIcon,
  CodeBlockIcon,
  ImageIcon,
  InlineCodeIcon,
  ItalicIcon,
  LinkIcon,
  NumberedListIcon,
  StrikethroughIcon,
} from "../common/Icons";
import {
  EditorTransform,
  insertCodeBlock,
  insertLink,
  MarkdownEditorHandle,
  toggleLinePrefix,
  wrapSelection,
} from "./MarkdownEditor";

export interface EditorToolbarProps {
  editorRef: React.RefObject<MarkdownEditorHandle | null>;
  onAttachImage: () => void;
  disabled?: boolean;
}

const CODE_LANGUAGES = ["ts", "js", "rust", "python", "sql"] as const;

export function EditorToolbar({ editorRef, onAttachImage, disabled = false }: EditorToolbarProps) {
  const [codeLang, setCodeLang] = useState<(typeof CODE_LANGUAGES)[number]>("ts");

  const apply = (transform: EditorTransform) => {
    editorRef.current?.applyTransform(transform);
  };

  const buttons: { icon: React.ReactNode; title: string; transform: EditorTransform }[] = [
    { icon: <BoldIcon size={14} />, title: "Bold (Ctrl+B)", transform: (v, s, t) => wrapSelection(v, s, t, "**") },
    { icon: <ItalicIcon size={14} />, title: "Italic (Ctrl+I)", transform: (v, s, t) => wrapSelection(v, s, t, "*") },
    { icon: <StrikethroughIcon size={14} />, title: "Strikethrough", transform: (v, s, t) => wrapSelection(v, s, t, "~~") },
  ];

  return (
    <div className="sticky top-[6.5rem] z-20 w-full bg-surface-container-low/95 backdrop-blur-md border-b border-outline-variant/40 px-4 py-1.5 flex items-center gap-1 overflow-x-auto select-none">
      {/* Headings */}
      <div className="flex items-center bg-surface-container rounded p-0.5 border border-outline-variant/30">
        {(["# ", "## ", "### "] as const).map((prefix, i) => (
          <button
            key={prefix}
            type="button"
            disabled={disabled}
            onClick={() => apply((v, s, t) => toggleLinePrefix(v, s, t, prefix))}
            className="px-2 py-0.5 rounded text-outline hover:text-on-surface hover:bg-surface-container-high font-mono text-[11px] transition-colors disabled:opacity-40 cursor-pointer"
            title={`Heading ${i + 1}`}
          >
            H{i + 1}
          </button>
        ))}
      </div>

      <Divider />

      {/* Inline styles */}
      <div className="flex items-center bg-surface-container rounded p-0.5 border border-outline-variant/30">
        {buttons.map((btn) => (
          <button
            key={btn.title}
            type="button"
            disabled={disabled}
            onClick={() => apply(btn.transform)}
            className="p-1.5 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-40 cursor-pointer"
            title={btn.title}
          >
            {btn.icon}
          </button>
        ))}
      </div>

      <Divider />

      {/* Code */}
      <div className="flex items-center bg-surface-container rounded p-0.5 border border-outline-variant/30">
        <button
          type="button"
          disabled={disabled}
          onClick={() => apply(insertCodeBlock(codeLang))}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-primary hover:bg-surface-container-high font-mono text-[11px] transition-colors disabled:opacity-40 cursor-pointer"
          title={`Insert code block (${codeLang})`}
        >
          <CodeBlockIcon size={13} />
          <span>Block</span>
        </button>
        <select
          value={codeLang}
          onChange={(e) => setCodeLang(e.target.value as (typeof CODE_LANGUAGES)[number])}
          className="bg-surface-container-highest text-outline font-mono text-[10px] uppercase rounded px-1 py-0.5 border border-outline-variant/40 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          title="Code block language"
        >
          {CODE_LANGUAGES.map((lang) => (
            <option key={lang} value={lang} className="bg-surface-container text-on-surface">
              {lang}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={disabled}
          onClick={() => apply((v, s, t) => wrapSelection(v, s, t, "`"))}
          className="p-1.5 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-40 cursor-pointer"
          title="Inline code"
        >
          <InlineCodeIcon size={13} />
        </button>
      </div>

      <Divider />

      {/* Lists & structure */}
      <div className="flex items-center bg-surface-container rounded p-0.5 border border-outline-variant/30">
        <button
          type="button"
          disabled={disabled}
          onClick={() => apply((v, s, t) => toggleLinePrefix(v, s, t, "- "))}
          className="p-1.5 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-40 cursor-pointer"
          title="Bullet list"
        >
          <BulletListIcon size={13} />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => apply((v, s, t) => toggleLinePrefix(v, s, t, "1. "))}
          className="p-1.5 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-40 cursor-pointer"
          title="Numbered list"
        >
          <NumberedListIcon size={13} />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => apply((v, s, t) => toggleLinePrefix(v, s, t, "> "))}
          className="p-1.5 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-40 cursor-pointer"
          title="Blockquote"
        >
          <BlockquoteIcon size={13} />
        </button>
      </div>

      <Divider />

      {/* Inserts */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={disabled}
          onClick={() => apply(insertLink)}
          className="flex items-center gap-1 px-2 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-mono text-[11px] border border-outline-variant/30 transition-colors disabled:opacity-40 cursor-pointer"
          title="Insert link (Ctrl+K)"
        >
          <LinkIcon size={13} />
          <span>Link</span>
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onAttachImage}
          className="flex items-center gap-1 px-2 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-mono text-[11px] border border-outline-variant/30 transition-colors disabled:opacity-40 cursor-pointer"
          title="Attach local image"
        >
          <ImageIcon size={13} />
          <span>Image</span>
        </button>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="h-4 w-px bg-outline-variant/40 mx-1 shrink-0" />;
}
