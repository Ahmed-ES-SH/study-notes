import { TableOfContentsItem } from "../api/types";
import { isManagedAssetPath } from "./assetPath";

// ── Primitives ──────────────────────────────────────────────────────

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Deterministic anchor id for a heading located on `lineNumber` (0-based).
 * Shared between the preview renderer and the TOC extractor so jumps always
 * line up with rendered headings.
 */
export function headingAnchorId(lineNumber: number): string {
  return `heading-${lineNumber}`;
}

// ── Syntax highlighting (offline, regex-tokenized) ─────────────────

interface TokenRule {
  /** Sticky regex evaluated at the current scan position. */
  re: RegExp;
  cls: string;
}

const CLS = {
  comment: "text-text-muted italic",
  string: "text-accent-green",
  keyword: "text-accent-rose",
  number: "text-accent-amber",
  fn: "text-accent-cobalt",
  type: "text-accent-violet",
  punct: "text-text-secondary",
};

const JS_KEYWORDS =
  "as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|false|finally|for|from|function|if|implements|import|in|instanceof|interface|let|new|null|of|private|protected|public|return|static|super|switch|this|throw|true|try|type|typeof|undefined|var|void|while|yield";
const RUST_KEYWORDS =
  "as|async|await|break|const|continue|crate|dyn|else|enum|extern|false|fn|for|if|impl|in|let|loop|match|mod|move|mut|pub|ref|return|self|Self|static|struct|super|trait|true|type|unsafe|use|where|while";
const PY_KEYWORDS =
  "and|as|assert|async|await|break|class|continue|def|del|elif|else|except|False|finally|for|from|global|if|import|in|is|lambda|None|nonlocal|not|or|pass|raise|return|True|try|while|with|yield";
const SQL_KEYWORDS =
  "ADD|ALTER|AND|AS|ASC|BEGIN|BETWEEN|BY|CASE|CHECK|COMMIT|CREATE|CROSS|DEFAULT|DELETE|DESC|DISTINCT|DROP|ELSE|END|EXISTS|FOREIGN|FROM|FULL|GROUP|HAVING|IF|IN|INDEX|INNER|INSERT|INTO|IS|JOIN|KEY|LEFT|LIKE|LIMIT|NOT|NULL|ON|OR|ORDER|OUTER|PRIMARY|REFERENCES|RIGHT|ROLLBACK|SELECT|SET|TABLE|THEN|TRANSACTION|UNION|UPDATE|VALUES|VIEW|WHEN|WHERE|WITH";

const STRING_RE = /`(?:\\[\s\S]|[^`\\])*`|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'/y;
const NUMBER_RE = /\b0[xXbBoO][0-9a-fA-F_]+\b|\b\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?\b/y;
const FN_RE = /\b[A-Za-z_$][\w$]*(?=\s*\()/y;
const TYPE_RE = /\b[A-Z][A-Za-z0-9_]*\b/y;
const PUNCT_RE = /[{}()[\];,.:=+\-*/%!&|<>?@#^~]+/y;

function commentRule(single: RegExp, block?: RegExp): TokenRule[] {
  const rules: TokenRule[] = [{ re: single, cls: CLS.comment }];
  if (block) rules.unshift({ re: block, cls: CLS.comment });
  return rules;
}

const JS_RULES: TokenRule[] = [
  ...commentRule(/\/\/[^\n]*/y, /\/\*[\s\S]*?\*\//y),
  { re: STRING_RE, cls: CLS.string },
  { re: new RegExp(`\\b(?:${JS_KEYWORDS})\\b`, "y"), cls: CLS.keyword },
  { re: NUMBER_RE, cls: CLS.number },
  { re: FN_RE, cls: CLS.fn },
  { re: TYPE_RE, cls: CLS.type },
  { re: PUNCT_RE, cls: CLS.punct },
];

const RUST_RULES: TokenRule[] = [
  ...commentRule(/\/\/[^\n]*/y, /\/\*[\s\S]*?\*\//y),
  { re: STRING_RE, cls: CLS.string },
  { re: new RegExp(`\\b(?:${RUST_KEYWORDS})\\b`, "y"), cls: CLS.keyword },
  { re: /#!\[[^\]]*\]|#\[[^\]]*\]/y, cls: CLS.type },
  { re: /'[a-z_][\w]*(?!\s*\()/y, cls: CLS.type },
  { re: NUMBER_RE, cls: CLS.number },
  { re: /![a-z]*(?=[\s(])/y, cls: CLS.fn },
  { re: FN_RE, cls: CLS.fn },
  { re: TYPE_RE, cls: CLS.type },
  { re: PUNCT_RE, cls: CLS.punct },
];

const PY_RULES: TokenRule[] = [
  { re: /#[^\n]*/y, cls: CLS.comment },
  { re: /"""[\s\S]*?"""|'''[\s\S]*?'''/y, cls: CLS.string },
  { re: STRING_RE, cls: CLS.string },
  { re: new RegExp(`\\b(?:${PY_KEYWORDS})\\b`, "y"), cls: CLS.keyword },
  { re: NUMBER_RE, cls: CLS.number },
  { re: FN_RE, cls: CLS.fn },
  { re: TYPE_RE, cls: CLS.type },
  { re: PUNCT_RE, cls: CLS.punct },
];

const SQL_RULES: TokenRule[] = [
  { re: /--[^\n]*/y, cls: CLS.comment },
  { re: /\/\*[\s\S]*?\*\//y, cls: CLS.comment },
  { re: STRING_RE, cls: CLS.string },
  { re: new RegExp(`\\b(?:${SQL_KEYWORDS})\\b`, "iy"), cls: CLS.keyword },
  { re: NUMBER_RE, cls: CLS.number },
  { re: FN_RE, cls: CLS.fn },
  { re: PUNCT_RE, cls: CLS.punct },
];

function rulesForLanguage(lang: string): TokenRule[] {
  const family = lang.trim().toLowerCase();
  switch (family) {
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
    case "javascript":
    case "typescript":
    case "json":
      return JS_RULES;
    case "rust":
    case "rs":
      return RUST_RULES;
    case "py":
    case "python":
      return PY_RULES;
    case "sql":
    case "sqlite":
      return SQL_RULES;
    default:
      return [];
  }
}

function highlightCode(code: string, lang: string): string {
  const rules = rulesForLanguage(lang);
  if (rules.length === 0) return escapeHtml(code);

  let out = "";
  let plain = "";
  let i = 0;

  const flushPlain = () => {
    if (plain) {
      out += escapeHtml(plain);
      plain = "";
    }
  };

  while (i < code.length) {
    let matched = false;
    for (const rule of rules) {
      rule.re.lastIndex = i;
      const m = rule.re.exec(code);
      if (m && m.index === i && m[0].length > 0) {
        flushPlain();
        out += `<span class="${rule.cls}">${escapeHtml(m[0])}</span>`;
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      plain += code[i];
      i += 1;
    }
  }
  flushPlain();
  return out;
}

// ── Inline markdown ─────────────────────────────────────────────────

const SAFE_URL = /^(https?:\/\/|mailto:|\/|#|\.\/)/i;

function renderSafeUrl(url: string): string | null {
  const trimmed = url.trim();
  return SAFE_URL.test(trimmed) ? trimmed : null;
}

function renderInline(text: string, assetSrcMap: Record<string, string>): string {
  // 0. Escape the entire source up front so no user text can ever emit
  //    markup; the rules below only ever *wrap* already-escaped spans.
  let working = escapeHtml(text);

  // 1. Extract inline code first so it is never touched by later rules.
  const codeSpans: string[] = [];
  working = working.replace(/`([^`\n]+)`/g, (_m, code: string) => {
    codeSpans.push(`<code class="md-code-inline">${code}</code>`);
    return `\u0000${codeSpans.length - 1}\u0000`;
  });

  // 2. Images.
  working = working.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string, src: string) => {
    const safeAlt = alt;
    const trimmed = src.trim();
    if (isManagedAssetPath(trimmed)) {
      const resolved = assetSrcMap[trimmed];
      if (resolved) {
        return `<img src="${escapeHtml(resolved)}" alt="${safeAlt}" class="md-img" loading="lazy" />`;
      }
      return `<span class="md-img-missing" role="img" aria-label="${safeAlt}"><span class="md-img-missing-icon">▢</span><span class="md-img-missing-text">${safeAlt || "Image unavailable"}</span><span class="md-img-missing-hint">asset not found on disk</span></span>`;
    }
    // The app is 100% offline — never reference remote image sources.
    return `<span class="md-img-missing" role="img" aria-label="${safeAlt}"><span class="md-img-missing-icon">▢</span><span class="md-img-missing-text">${safeAlt || "External image"}</span><span class="md-img-missing-hint">${trimmed}</span></span>`;
  });

  // 3. Links.
  working = working.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
    const safeHref = renderSafeUrl(href);
    if (safeHref === null) return label;
    return `<a href="${safeHref}" class="md-link" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  // 4. Emphasis.
  working = working
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, "$1<em>$2</em>")
    .replace(/~~([^~\n]+)~~/g, "<del>$1</del>");

  // 5. Restore code spans (escaped content already wrapped).
  return working.replace(/\u0000(\d+)\u0000/g, (_m, idx: string) => {
    return codeSpans[Number(idx)] ?? "";
  });
}

// ── Block rendering ─────────────────────────────────────────────────

function renderCodeBlock(lang: string, code: string): string {
  const safeLang = escapeHtml(lang.trim() || "text");
  return (
    `<div class="md-codeblock">` +
    `<div class="md-codeblock-header">` +
    `<span class="md-codeblock-lang">${safeLang}</span>` +
    `<button type="button" class="md-copy-btn" aria-label="Copy code">Copy</button>` +
    `</div>` +
    `<pre><code>${highlightCode(code, lang)}</code></pre>` +
    `</div>`
  );
}

/**
 * Renders an (offline) markdown subset to a sanitized HTML string. All user
 * text is HTML-escaped before being wrapped in generated markup, so the
 * result is safe to inject via `dangerouslySetInnerHTML`.
 *
 * `assetSrcMap` maps managed asset paths (`assets/<uuid>.<ext>`) to resolved
 * inline data URLs for embedded images.
 */
export function renderMarkdown(
  markdown: string,
  assetSrcMap: Record<string, string> = {}
): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block.
    const fence = line.match(/^```([\w+#-]*)\s*$/);
    if (fence) {
      const lang = fence[1] || "";
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence (or EOF)
      out.push(renderCodeBlock(lang, codeLines.join("\n")));
      continue;
    }

    // Heading.
    const heading = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      const inner = renderInline(heading[2], assetSrcMap);
      out.push(
        `<h${level} id="${headingAnchorId(i)}" class="md-h md-h${level}">${inner}</h${level}>`
      );
      i += 1;
      continue;
    }

    // Horizontal rule.
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push(`<hr class="md-hr" />`);
      i += 1;
      continue;
    }

    // Blockquote.
    if (/^\s*>/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      out.push(
        `<blockquote class="md-blockquote">${renderInline(
          quoteLines.join("\n").replace(/\n/g, "<br>"),
          assetSrcMap
        )}</blockquote>`
      );
      continue;
    }

    // Unordered list.
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(
          `<li class="md-li">${renderInline(
            lines[i].replace(/^\s*[-*+]\s+/, ""),
            assetSrcMap
          )}</li>`
        );
        i += 1;
      }
      out.push(`<ul class="md-ul">${items.join("")}</ul>`);
      continue;
    }

    // Ordered list.
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(
          `<li class="md-li">${renderInline(
            lines[i].replace(/^\s*\d+\.\s+/, ""),
            assetSrcMap
          )}</li>`
        );
        i += 1;
      }
      out.push(`<ol class="md-ol">${items.join("")}</ol>`);
      continue;
    }

    // Blank line.
    if (line.trim() === "") {
      i += 1;
      continue;
    }

    // Paragraph: consume consecutive plain lines.
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^\s*>/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i += 1;
    }
    out.push(
      `<p class="md-p">${renderInline(paraLines.join("\n"), assetSrcMap).replace(
        /\n/g,
        "<br>"
      )}</p>`
    );
  }

  return out.join("\n");
}

// ── Table of contents extraction ───────────────────────────────────

/**
 * Extracts the heading outline (`#`–`###`) from raw markdown, using the same
 * anchor id convention as `renderMarkdown`.
 */
export function parseTableOfContents(markdown: string): TableOfContentsItem[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const items: TableOfContentsItem[] = [];

  let inFence = false;
  lines.forEach((line, index) => {
    if (/^```/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;

    const heading = line.match(/^(#{1,3})\s+(.*?)\s*#*\s*$/);
    if (heading) {
      const text = heading[2].replace(/[*_`~]/g, "").trim();
      if (text) {
        items.push({
          id: headingAnchorId(index),
          text,
          level: heading[1].length,
          line_number: index,
        });
      }
    }
  });

  return items;
}
