# Study Notes

A **Linux-first, 100% offline** desktop app for hierarchical programming study
notes — built with **Tauri v2 + Next.js + SQLite**. Zero cloud, zero telemetry,
zero outbound network connections (enforced by CSP and verified by
`pnpm check:offline`).

## Features

- **4-level hierarchy** — Main Sections → Subsections → Notes → Assets
- **Markdown editor** with autosave, syntax-aware formatting shortcuts, and
  keyboard-driven reordering
- **Full-text search** (SQLite FTS5) with BM25 ranking, snippets, and scope
  narrowing, via the global command palette (`Ctrl+K`)
- **Local image assets** stored on disk next to the database
- **PDF export** — print any note to PDF from the editor (`Ctrl+P`), fully offline
- **Integrity tooling** — `PRAGMA integrity_check` / foreign-key report from
  inside the app
- **First-run onboarding** — a clean install provisions the data directory and
  seeds a "Getting Started" welcome note

## Installation

### Arch Linux (AUR, source build)

```bash
yay -S study-notes
# or with paru / makepkg directly:
git clone https://github.com/Ahmed-ES-SH/study-notes.git
cd study-notes/packaging/aur
makepkg -si
```

The package installs the `study-notes` binary, an XDG desktop entry, and the
full hicolor icon set, so it appears in GNOME, KDE, XFCE, and launchers like
rofi/dmenu automatically.

### AppImage (any distribution)

Download `study-notes_0.2.0_amd64.AppImage` from the releases page, then:

```bash
chmod +x study-notes_0.2.0_amd64.AppImage
./study-notes_0.2.0_amd64.AppImage
```

> **No FUSE?** On minimal installs without `libfuse2` (e.g. Ubuntu 24.04+),
> run: `./study-notes_0.2.0_amd64.AppImage --appimage-extract-and-run`

The app runs natively on both X11 and Wayland.

### Windows (NSIS)

Download `study-notes_0.2.0_x64-setup.exe` from the releases page (or from
the `windows-nsis-installer` artifact of any PR CI run) and launch it.

- The installer runs in **currentUser** mode: it installs for your user
  account only, so no administrator/UAC prompt appears.
- **WebView2** is required to render the app. It ships preinstalled on
  Windows 11 and on Windows 10 version 1809 and newer; on older Windows 10
  builds install the Evergreen WebView2 Runtime from Microsoft first.
- The installer is currently **unsigned**, so Windows SmartScreen shows an
  "Unknown publisher" warning. Click **More info → Run anyway** to proceed.
  (Code signing is planned as future work.)
- Your notes live at `%LOCALAPPDATA%\study-notes`
  (typically `C:\Users\<you>\AppData\Local\study-notes`), with the same
  `study-notes.db` + `assets/` layout described below.
- The `--appimage-extract-and-run` flag documented above is Linux-only and
  has no Windows equivalent.

### From source

Requirements: Node.js ≥ 20, pnpm, Rust (stable), and the Tauri Linux
prerequisites (`webkit2gtk-4.1`, `gtk3`).

```bash
pnpm install
pnpm tauri build          # produces target/release/study-notes + AppImage
./src-tauri/target/release/study-notes
```

## Where your data lives

Everything is stored locally under the XDG data directory:

```
~/.local/share/study-notes/
├── study-notes.db     # SQLite database (WAL mode) — all notes & hierarchy
└── assets/            # attached images & media
```

Uninstalling the app never deletes your data. To move your notes to another
machine, copy this directory (or use the backup scripts below).

On Windows the same layout lives at `%LOCALAPPDATA%\study-notes`
(typically `C:\Users\<you>\AppData\Local\study-notes`). Uninstalling the
NSIS package likewise preserves this directory, so reinstalling picks up
your existing notes automatically.

## Backup & restore

The repository ships two CLI utilities:

```bash
# Create ~/study-notes-backups/study-notes-backup-YYYY-MM-DD_HHMMSS.tar.gz
scripts/backup-data.sh [destination-dir]

# Restore an archive (takes a safety snapshot of current data first)
scripts/restore-data.sh path/to/study-notes-backup-YYYY-MM-DD_HHMMSS.tar.gz
```

`backup-data.sh` runs `PRAGMA wal_checkpoint(TRUNCATE)` before archiving, so
the tarball is consistent even if the app is open. Schedule it with cron or
systemd timers for automatic backups.

### Windows backup & restore (PowerShell)

```powershell
# Create ~/study-notes-backups/study-notes-backup-YYYY-MM-DD_HHMMSS.zip
scripts/backup-data.ps1 [-Destination <dir>]

# Restore an archive (takes a safety snapshot of current data first)
scripts/restore-data.ps1 $HOME\study-notes-backups\study-notes-backup-YYYY-MM-DD_HHMMSS.zip
```

Both scripts accept `-WhatIf` to preview without changing anything. Like
their Linux counterparts, restore refuses to run while the `study-notes`
process is open — close the app first.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + K` | Global command palette & full-text search |
| `Ctrl/Cmd + S` | Flush pending autosave immediately |
| `Ctrl/Cmd + P` | Export the open note as PDF (print dialog) |
| `Ctrl/Cmd + B` / `Ctrl/Cmd + I` | Bold / italic selection |
| `Alt + ↑` / `Alt + ↓` | Reorder the focused list item |
| `Esc` | Close dialog / exit Zen mode |

## Development

```bash
pnpm install
pnpm dev                # Next.js dev server
pnpm tauri dev          # full desktop dev shell
pnpm lint               # eslint
cargo test              # Rust unit tests (src-tauri)
pnpm check:offline      # verify zero outbound network usage (FR-11)
```

## License

[MIT](./LICENSE)
