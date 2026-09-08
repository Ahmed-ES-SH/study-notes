# Phase 9 — Export Note as PDF

**Goal:** Let the user export any note to PDF from the note editor, reusing the app's existing zero-dependency markdown rendering pipeline. The chosen mechanism is the **print-dialog approach**: render the note into a print-optimized container and trigger the WebKit print dialog, where the user picks **"Print to File (PDF)"**. Zero new dependencies, full rendering fidelity (headings, code highlighting, tables, embedded images), 100% offline.

> **Status: COMPLETED (2026-09-08).** Implemented on `feat/pdf-export`, merged to `main`, deployed as 0.2.0. Verified: `cargo test` 34/34, `pnpm lint`, `pnpm build`, `pnpm check:offline` all green; release binary smoke-tested. This document is kept as the implementation record.

---

## Scope Summary

1. **Print stylesheet** (`app/globals.css`): an `@media print` block that hides the app shell, shows only a dedicated print container, forces a light/paper theme regardless of the user's runtime theme, and adds page-break hygiene for code blocks, tables, and images.
2. **Print container** (`app/editor/page.tsx`): a hidden-on-screen `#print-root` element that renders the current note through the existing `MarkdownPreview` component (which already resolves local asset images to inline data URLs — the printed output is fully self-contained).
3. **UI entry points**: an "Export PDF" button in the editor header, an "Export as PDF" action in the command palette, and (optional) a Ctrl+P shortcut inside the editor.
4. **Deployment to the installed app**: rebuild the release binary and replace `/usr/bin/study-notes` on this machine (the app is manually installed, not pacman-owned).
5. **Commit & push**: baseline-commit the pending phase-8 packaging work first, then the PDF feature on `feat/pdf-export`, merged into `main` and pushed.

**Out of scope:** Rust-side PDF generation (genpdf/printpdf crates rejected — cannot render HTML/markdown, poor fidelity, high effort), tauri-plugin-dialog/fs (not needed), silent/background PDF export, batch export of multiple notes.

---

## Architecture Digest (verified 2026-09-08 — do not re-explore)

### Stack & constraints
- Tauri **2.11.3** (`src-tauri/Cargo.toml:24`) + Next.js **16.3.4** (App Router, **static export**: `output: "export"` in `next.config.ts:6`, served by Tauri from `frontendDist: "../out"` — `src-tauri/tauri.conf.json`). React 19, Tailwind v4, pnpm.
- **Hard rule: 100% offline** — CSP `connect-src 'none'` in production (`tauri.conf.json:26`), guarded by `pnpm check:offline`. No new network-touching deps.
- **Zero-dependency philosophy**: no markdown library anywhere; rendering is a custom pipeline.
- Capabilities: `src-tauri/capabilities/default.json` grants only `core:default` on window `main`. Only plugin installed: `tauri-plugin-log`. **No fs/dialog/pdf plugins, no PDF crates — do not add any.**

### What gets reused (the whole reason this phase is small)
| Asset | Location | Why it matters |
|---|---|---|
| `renderMarkdown(md, assetSrcMap)` | `lib/utils/markdownRenderer.ts:249` | Already produces the sanitized HTML (escaped user text, fenced code with offline syntax highlighting for JS/TS/Rust/Python/SQL, headings w/ anchors, tables, lists, blockquotes, images, links) |
| `MarkdownPreview` + `useAssetSrcMap` | `components/editor/MarkdownPreview.tsx:18-60` (hook), `:125` (renders via `dangerouslySetInnerHTML` into `.md-prose`) | Already resolves local asset images to **inline data URLs** via Tauri command `read_asset_data_url` — printed output is self-contained |
| `.md-prose` styles | `app/globals.css:245-433` | The class family the print stylesheet restyles; print CSS should target the same classes |
| Editor page & preview pane | `app/editor/page.tsx` (preview at `:306-319`, workspace at `:29`) | Where `#print-root` gets added; note content/title come from `useNoteEditor(noteId)` (`lib/hooks/useNoteEditor.ts`) — provides `title`, `content`, `assetsVersion` |
| Command-palette actions | `lib/hooks/useCommandPalette.ts:138-156` | Add `{ kind: "action", id: "action-export-pdf", title: "Export Note as PDF", hint: "Export", run }` — but note the palette is mounted globally in `app/layout.tsx`; it must only run the export when an editor note is open (see Implementation notes) |
| Tauri dynamic-import pattern | `lib/hooks/useTheme.ts:78-80` | Pattern for conditionally importing `@tauri-apps/api/webviewWindow` with try/catch fallback for browser dev |
| Existing editor state/commands | `src-tauri/src/lib.rs:25-51` (24 registered commands), `lib/api/notes.ts` | **No backend changes needed at all** — this phase is frontend-only |

### Print mechanism on Linux
- Tauri on Linux uses webkit2gtk; `window.print()` maps to `WebKitPrintOperation`, which opens the **GTK print dialog** (includes "Print to File" → PDF). If plain `window.print()` misbehaves inside the Tauri webview, fall back to `getCurrentWebviewWindow().print()` from `@tauri-apps/api/webviewWindow` (dynamic import per the `useTheme.ts` pattern) — verify which works first with a quick manual test in `pnpm tauri dev`.
- GTK print dialog does not let us pre-fill the filename from JS; the user types it (suggest using the note title in the button tooltip/hint). Acceptable UX for this phase.

### Environment / install layout (this machine)
- App binary: **`/usr/bin/study-notes`** (root-owned, 14 MB, not owned by any pacman package — manual install mirroring the PKGBUILD).
- Desktop entry: `/usr/share/applications/com.studynotes.app.desktop` (`Exec=study-notes %U`), icons under `/usr/share/icons/hicolor/` — already installed; **unchanged by this phase**.
- Data: `~/.local/share/study-notes/` (`study-notes.db` + `assets/`).
- Build: `pnpm tauri build --bundles none` (same command as `packaging/aur/PKGBUILD:36`) → binary at `src-tauri/target/release/study-notes`.

---

## Confirmed Decisions

| Decision | Choice | Rationale |
|---|---|---|
| PDF generation | **Print-dialog approach** (`window.print()` on print-formatted DOM) | Zero new deps; perfect fidelity (reuses renderer + highlighting + data-URL images); fits offline rule; GTK dialog offers Print-to-File PDF |
| PDF engine alternative | Rejected: Rust PDF crates | Cannot render HTML/markdown; would require re-implementing headings/code/images by hand |
| Print theme | **Always light ("paper")**, independent of runtime theme | `data-theme` variables resolve at runtime; print output must be legible on white paper — force light values inside the print scope |
| Backend changes | **None** | Everything the print DOM needs already exists; no new Tauri commands, no capability changes |
| Baseline commit | Phase-8 packaging work committed to `main` **before** PDF work starts | Working tree currently has uncommitted packaging changes (PKGBUILD, scripts/, LICENSE, icons, db/editor changes); keeps history clean |
| Branch/push | `feat/pdf-export` → merge to `main` locally → `git push origin main` | User-requested end state: changes on `main`; skips GitHub PR |

---

## File Structure (New & Modified)

```
app/
└── globals.css                  # MODIFY — add @media print block (paper theme, shell hiding, page-break rules)
└── editor/page.tsx              # MODIFY — add #print-root container + export handler + (optional) Ctrl+P intercept
components/
└── editor/EditorHeader.tsx      # MODIFY — "Export PDF" button next to view-mode toggles
lib/
└── hooks/useCommandPalette.ts   # MODIFY — add "Export Note as PDF" action (editor-scoped, see notes)
└── hooks/usePrintExport.ts      # NEW (optional) — small hook: triggerPrint() with webviewWindow fallback + Ctrl+P binding; keeps page/hook code DRY
plans/
└── phase-9-pdf-export.md        # EXISTS — this file (commit with the feature)
docs/
└── AGENT_HANDOVER.md            # MODIFY — Phase 9 row in the matrix (done at the end)
```

**No changes:** `src-tauri/**`, `package.json` dependencies, `next.config.ts`, capabilities, packaging files (unless the optional version bump is taken — then `package.json`, `src-tauri/tauri.conf.json:5`, `src-tauri/Cargo.toml`, `packaging/aur/PKGBUILD`).

---

## Implementation Plan (Phases 9.0 – 9.4)

### Phase 9.0 — Baseline commit (do this FIRST, on `main`)
The working tree contains completed-but-uncommitted **Phase 8 packaging work**. Before touching anything:
1. Review `git status` / `git diff` briefly; confirm the changes match phase-8 scope (packaging/, scripts/backup-data.sh, scripts/restore-data.sh, LICENSE, icons, db/editor/README tweaks) and nothing looks accidental.
2. On `main`: single commit, e.g. `feat(packaging): AUR PKGBUILD, XDG desktop entry, icons, backup/restore scripts, license`.
3. `git push origin main` if remote is reachable; if not, proceed locally and note it for Phase 9.4.

### Phase 9.1 — Implementation (frontend only)
1. **Print stylesheet** — append an `@media print` block at the end of `app/globals.css`:
   - Hide the app shell: the editor page's normal UI lives inside the layout tree; mark the shell container (the `<div>` tree in `app/layout.tsx` wrapping `{children}`) with `data-app-shell`, and in print: `[data-app-shell] { display: none !important; }`.
   - Show only the print root: `#print-root { display: block !important; }` (it is rendered **inside** the editor page but outside `[data-app-shell]` styling — simplest robust structure: render `#print-root` as a sibling of the shell wrapper in the editor page tree, since `data-app-shell` hides only the marked container).
   - Force paper theme inside print scope: redefine the CSS custom properties the prose styles consume (the same set overridden by `[data-theme="light"]` at `globals.css:137/146`) with light values under `@media print { #print-root { --color-surface-…: white; … } }`; set `background: white; color: near-black;` on `#print-root`.
   - Page hygiene: `@page { margin: ~15mm; }` (webkit2gtk honors `@page` margins), `.md-codeblock, table, .md-img { break-inside: avoid; }`, allow long code lines to wrap (`white-space: pre-wrap; overflow-wrap: anywhere;`), hide scrollbars, drop the editor's max-width/padding constraints so text uses the full page width, and make link colors dark enough to print.
2. **Print container** — in `app/editor/page.tsx`:
   - Render `<div id="print-root" aria-hidden className="print:hidden-on-screen">` containing the note title (as `<h1>`) and `<MarkdownPreview content={content} assetsVersion={assetsVersion} />`. Reuse `useAssetSrcMap` indirectly through `MarkdownPreview` — do **not** duplicate asset resolution.
   - Screen CSS: `#print-root { display: none; }` normally; `display: block` only inside `@media print`.
   - It must render regardless of the current editor `mode` (works from edit, split, preview, and zen).
3. **Trigger** — implement export as: ensure pending autosave is flushed (call `flushSave` from `useNoteEditor` — Ctrl+S path, `lib/hooks/useAutoSave.ts`) → small `requestAnimationFrame`/timeout to let React commit → `window.print()`. Wrap in try/catch with the `getCurrentWebviewWindow().print()` fallback (dynamic import per `useTheme.ts:78-80`) for browser-dev compatibility.
4. **Entry points**:
   - `components/editor/EditorHeader.tsx`: add an "Export PDF" button (SVG icon from `components/common/Icons.tsx` — follow existing header button pattern) with tooltip `Export as PDF (via print dialog)`.
   - `lib/hooks/useCommandPalette.ts`: add action entry. **Editor-scoping problem:** the palette is global (`app/layout.tsx`) while the export needs editor state. Simplest fix consistent with the codebase: dispatch a window event (the palette already uses `window.dispatchEvent(new Event(...))` patterns, e.g. `THEME_CHANGED_EVENT` at `:135`) — palette action fires `export-note-pdf` event; the editor page listens and runs the export. If the editor isn't open, the action can be omitted/hidden — check how the palette composes actions per-page before deciding.
   - Optional: Ctrl+P interception in the editor page (`preventDefault` + export) so the browser-native print doesn't double-trigger.
5. **(Optional) version bump** 0.1.0 → 0.2.0 in `package.json`, `src-tauri/tauri.conf.json:5`, `src-tauri/Cargo.toml`, `packaging/aur/PKGBUILD` — makes the deployed build verifiable.

### Phase 9.2 — Verification
```bash
cargo test          # in src-tauri — must stay green (no backend changes expected)
pnpm lint
pnpm build          # static export must succeed
pnpm check:offline  # 0 violations
pnpm tauri dev      # manual pass below
```
Manual pass in the dev build, with a note containing: all heading levels, a long fenced code block (JS + Rust), a table, a local image asset, and a link:
- [ ] Export button + palette action both open the GTK print dialog; "Print to File" produces a valid PDF (check with `pdftotext` or opening it).
- [ ] Dark-mode note prints as light/paper (no dark backgrounds, readable text).
- [ ] Images appear (embedded data URLs), code keeps syntax-highlight colors legibly.
- [ ] Long code blocks/tables don't get sliced mid-line across pages.
- [ ] Canceling the print dialog does nothing harmful (no navigation, no save, no crash).
- [ ] Works from all editor modes (edit / split / preview / zen).
- [ ] Exporting an empty note doesn't crash (blank page or friendly placeholder in PDF).

### Phase 9.3 — Deploy to the installed app on this system
1. `pnpm tauri build --bundles none` (compiles `next build` first via `beforeBuildCommand`; binary lands at `src-tauri/target/release/study-notes`).
2. Quick smoke-test the fresh binary directly (`src-tauri/target/release/study-notes &`) before installing.
3. Back up the old binary, then replace it:
   ```bash
   sudo cp /usr/bin/study-notes /usr/bin/study-notes.bak
   sudo install -Dm755 src-tauri/target/release/study-notes /usr/bin/study-notes
   ```
4. Desktop entry and icons are unchanged by this phase — no reinstall needed.
5. Kill any running instance (`pgrep -x study-notes`), then launch **from the desktop launcher** and verify: the Export PDF button exists and the installed build exports a note to PDF correctly. If the version bump was taken, confirm the new version.

### Phase 9.4 — Commit & push
1. Branch from `main`: `git checkout -b feat/pdf-export`.
2. Commit the feature (conventional style per repo history, e.g. `feat(editor): export note as PDF via print dialog`); include `plans/phase-9-pdf-export.md` and the `docs/AGENT_HANDOVER.md` matrix row. Keep commits focused — do not re-include phase-8 files.
3. `git checkout main && git merge --no-ff feat/pdf-export` (repo history uses merge commits).
4. `git push origin main` (push phase-8 baseline first if 9.0 step 3 was deferred).
5. Delete the feature branch after merge.

---

## Edge Cases & Error Handling

1. **Print while in zen mode (`FocusModeView`):** print-root is independent of the visible pane; verify the overlay doesn't end up in the PDF (it must be inside a hidden print scope).
2. **Unsaved edits:** flush the debounced autosave (`flushSave`) before printing, or the PDF may lag behind the textarea by up to 1200 ms.
3. **Very large images / long notes:** data-URL images inflate the DOM; acceptable for single-note export, but verify a note with several large images still prints (and doesn't time out the dialog).
4. **Browser dev mode (`pnpm dev` in plain browser):** `window.print()` uses the browser dialog — fine; the webviewWindow fallback must not throw (try/catch per `useTheme.ts` pattern).
5. **Dialog canceled:** no state change anywhere; print CSS must not leak into screen (guarded by `@media print`).
6. **Command palette action outside the editor:** must be a no-op or hidden — never navigate the user to a broken state.

---

## Exit Criteria

- [x] Phase 8 packaging work committed to `main` (two commits: editor polish + packaging — the tree held more than packaging, so it was split).
- [x] Export PDF available from the editor header, Ctrl+P, and command palette; built into the release binary (print CSS confirmed in `out/` static export).
- [x] PDF output forces the paper (light) palette via `.theme-paper` scope; images embed as data URLs; copy buttons hidden; code wraps instead of clipping.
- [x] `cargo test` (34/34), `pnpm lint`, `pnpm build`, `pnpm check:offline` all green; zero new dependencies added.
- [x] Version bumped to 0.2.0 (package.json, tauri.conf.json, Cargo.toml, PKGBUILD, .SRCINFO, README).
- [x] PKGBUILD build flag fixed (`--bundles none` → `--no-bundle`; the old v1 syntax aborts AUR builds on Tauri CLI v2).
- [ ] Final in-app dialog pass (export a real note, check page breaks / image embedding in the produced PDF) — requires the interactive GTK print dialog; run once in the installed app.

---

## Estimated Effort

- **~4-5 files** modified, ~1 small new hook (optional)
- **~120-180 lines** of print CSS
- **~40-80 lines** of TSX/TS (print root, button, event wiring)
- **0 lines** of Rust
