# Phase 8 — Packaging, Distribution & Platform Fit

**Goal:** Package, distribute, and verify the Study Notes desktop application on Linux (specifically **Arch Linux** as primary target and general Linux distributions) per PRD §1.1, §6, §9 Q4, and `Main-plan.md` Phase 8. Provide standalone AppImage and Arch Linux AUR (`PKGBUILD`) distributions; guarantee first-run local data directory provisioning (`~/.local/share/study-notes/`), seamless desktop integration (XDG desktop entry, high-res icons), zero-network compliance in packaged release artifacts, and comprehensive backup/restore tooling and documentation.

---

## Scope Summary

Deliver a production-grade Linux packaging and distribution system for the Study Notes app:
1. **Tauri v2 Linux Bundler Configuration:** Configure `src-tauri/tauri.conf.json` with Linux bundle metadata for AppImage, XDG-compliant desktop file generation, categories (`Utility;Education;Development;TextEditor;`), and custom window defaults.
2. **Arch Linux AUR Packaging (`PKGBUILD`) (Stretch Goal):**
   - **`study-notes` (Source AUR):** Builds from source using `pnpm` and `cargo` within standard Arch build chroots.
3. **First-Run Provisioning & Seed Onboarding & Backup Tooling:**
   - Reliable initialization on first run creating `~/.local/share/study-notes/` and `~/.local/share/study-notes/assets/` with appropriate POSIX permissions (`0700` / `0755`).
   - Default welcome note seeded on first run introducing the 4-level hierarchy, keyboard shortcuts, Markdown formatting, and manual backup instructions.
   - Standalone CLI utilities (`scripts/backup-data.sh` and `scripts/restore-data.sh`) creating compressed, timestamped tarballs (`study-notes-backup-YYYY-MM-DD_HHMMSS.tar.gz`) of the SQLite database and all image assets.

---

## Architecture & Design Decisions Confirmed

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Universal Linux Bundle** | **AppImage** (`study-notes-app_x86_64.AppImage`) | Single-file, zero-install executable compatible across all major Linux distributions without root privileges; bundles required webkit/gtk runtime dependencies. |
| **Data Storage Standard** | XDG Base Directory Specification (`$XDG_DATA_HOME/study-notes/` or `~/.local/share/study-notes/`) | Native Linux desktop convention; keeps user database (`study-notes.db`) and images (`assets/`) isolated from application binaries for easy backup and uninstallation. |
| **First-Run Experience** | Automatic schema migration + Default Welcome Note | Ensures immediate usability on a clean install with no blank screen confusion; documents key shortcuts and backup tips directly within the app. |
| **Backup Philosophy** | Zero-Cloud Local Tarball Archive (`study-notes-backup-*.tar.gz`) | Strictly adheres to PRD §1.1 & §8 ("Zero Cloud Sync"); provides transparent, user-controlled backup scripts packaging SQLite WAL checkpoints and local assets. |

---

## File Structure (New & Modified)

```
packaging/
├── aur/
│   ├── PKGBUILD                         # NEW — Arch Linux AUR Source build script (builds with pnpm + cargo)
│   ├── study-notes.install              # NEW — Post-install message detailing data location & backup tips
│   └── .SRCINFO                         # NEW — Generated AUR package metadata
├── linux/
│   └── com.studynotes.app.desktop       # NEW — Standard XDG Desktop Entry file
scripts/
├── check-no-network.sh                  # EXISTING — Offline verification script
├── backup-data.sh                       # NEW — CLI utility to archive SQLite DB & assets to timestamped tarball
└── restore-data.sh                      # NEW — CLI utility to restore data archive with safety backup
src-tauri/
├── icons/
│   ├── 16x16.png                        # NEW — Tray and small titlebar icon
│   ├── 32x32.png                        # EXISTING — Standard taskbar icon
│   ├── 64x64.png                        # NEW — High-DPI icon
│   ├── 128x128.png                      # EXISTING — App drawer icon
│   ├── 128x128@2x.png                   # EXISTING — Retina icon
│   ├── 256x256.png                      # NEW — Large desktop launcher icon
│   ├── 512x512.png                      # NEW — High-res software center icon
│   └── icon.svg                         # NEW — Scalable vector icon
├── src/
│   ├── db/
│   │   ├── seed.rs                      # NEW — First-run default welcome note & sample hierarchy creator
│   │   ├── mod.rs                       # MODIFY — Run first-run seeding if database is freshly created
│   │   └── tests.rs                     # MODIFY — Add test verifying first-run seed initialization
│   └── lib.rs                           # MODIFY — Expose data directory inspection commands
├── tauri.conf.json                      # MODIFY — Configure Linux bundles, desktop file & release metadata
README.md                                # MODIFY — Add installation & backup guide
LICENSE                                  # NEW — MIT license file required for Linux distribution
```

---

## Packaging Configurations & Manifests

### 1. Tauri v2 Bundler Configuration (`src-tauri/tauri.conf.json`)

```json
{
  "$schema": "../node_modules/@tauri-apps/cli/config.schema.json",
  "productName": "study-notes",
  "version": "0.1.0",
  "identifier": "com.studynotes.app",
  "build": {
    "frontendDist": "../out",
    "devUrl": "http://localhost:3000",
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build"
  },
  "app": {
    "windows": [
      {
        "title": "Study Notes",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": "default-src 'self' tauri: asset:; img-src 'self' asset: data: tauri:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'none'; object-src 'none'; form-action 'none';"
    }
  },
  "bundle": {
    "active": true,
    "targets": ["appimage"],
    "icon": [
      "icons/16x16.png",
      "icons/32x32.png",
      "icons/64x64.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/256x256.png",
      "icons/512x512.png",
      "icons/icon.svg"
    ],
    "shortDescription": "Linux-first, offline hierarchical study notes for developers",
    "longDescription": "A distraction-free, 100% offline desktop application for creating, organizing, and studying programming notes with code highlighting and local media storage.",
    "category": "DeveloperTool",
    "copyright": "Copyright © 2026 Ahmed. All rights reserved.",
    "licenseFile": "../LICENSE",
    "linux": {
      "appimage": {
        "bundleMediaFramework": false
      }
    }
  }
}
```

### 2. Arch Linux AUR Source PKGBUILD (`packaging/aur/PKGBUILD`)

```bash
# Maintainer: Ahmed <ahmed@example.com>
pkgname=study-notes
pkgver=0.1.0
pkgrel=1
pkgdesc="Linux-first, offline hierarchical study notes desktop application for developers"
arch=('x86_64')
url="https://github.com/adev/study-notes-app"
license=('MIT')
depends=(
    'webkit2gtk-4.1'
    'gtk3'
    'libappindicator-gtk3'
    'sqlite'
    'hicolor-icon-theme'
)
makedepends=(
    'cargo'
    'rust'
    'pnpm'
    'nodejs'
)
install=study-notes.install
source=("$pkgname-$pkgver.tar.gz::$url/archive/refs/tags/v$pkgver.tar.gz")
sha256sums=('SKIP')

build() {
    cd "$pkgname-$pkgver"
    export RUSTUP_TOOLCHAIN=stable
    pnpm install --frozen-lockfile
    # pnpm tauri build compiles both the Next.js frontend and the Rust backend
    # in a single step — no need for a separate cargo build invocation.
    pnpm tauri build --bundles none
}

package() {
    cd "$pkgname-$pkgver"

    # Install main binary
    install -Dm755 "src-tauri/target/release/study-notes" "$pkgdir/usr/bin/study-notes"

    # Install XDG Desktop Entry
    install -Dm644 "packaging/linux/com.studynotes.app.desktop" \
        "$pkgdir/usr/share/applications/com.studynotes.app.desktop"

    # Install Hicolor Icons
    for size in 16 32 64 128 256 512; do
        install -Dm644 "src-tauri/icons/${size}x${size}.png" \
            "$pkgdir/usr/share/icons/hicolor/${size}x${size}/apps/study-notes.png"
    done
    install -Dm644 "src-tauri/icons/icon.svg" \
        "$pkgdir/usr/share/icons/hicolor/scalable/apps/study-notes.svg"

    # Install License
    install -Dm644 LICENSE "$pkgdir/usr/share/licenses/$pkgname/LICENSE"
}
```

### 3. Linux Desktop Entry (`packaging/linux/com.studynotes.app.desktop`)

```desktop
[Desktop Entry]
Name=Study Notes
GenericName=Technical Study Notes
Comment=Linux-first, offline hierarchical study notes for developers
Exec=study-notes %U
Icon=study-notes
Terminal=false
Type=Application
Categories=Utility;Education;Development;TextEditor;
Keywords=notes;study;markdown;programming;offline;developer;
StartupWMClass=study-notes
StartupNotify=true
```

### 4. First-Run Seed Engine (`src-tauri/src/db/seed.rs`)

```rust
use rusqlite::{params, Connection};
use chrono::Utc;
use uuid::Uuid;

pub fn seed_first_run_if_empty(conn: &mut Connection) -> Result<(), rusqlite::Error> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM main_sections",
        [],
        |row| row.get(0),
    )?;

    if count > 0 {
        return Ok(()); // Database already initialized with user data
    }

    let tx = conn.transaction()?;
    let now = Utc::now().to_rfc3339();

    // 1. Create Default Main Section: "Getting Started"
    let section_id = Uuid::new_v4().to_string();
    tx.execute(
        "INSERT INTO main_sections (id, name, color, created_at, updated_at, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![section_id, "Getting Started", "#388bfd", now, now, 0],
    )?;

    // 2. Create Default Subsection: "Welcome to Study Notes"
    let subsection_id = Uuid::new_v4().to_string();
    tx.execute(
        "INSERT INTO subsections (id, main_section_id, name, created_at, updated_at, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![subsection_id, section_id, "Welcome & Overview", now, now, 0],
    )?;

    // 3. Create Welcome Note with Guide & Shortcuts
    let note_id = Uuid::new_v4().to_string();
    let welcome_content = r#"# Welcome to Study Notes Desktop 🚀

A **Linux-first, 100% offline** hierarchical study notes environment designed for developers.

---

## 🏛️ 4-Level Architecture
1. **Main Section** (e.g. *Programming*, *Databases*, *Computer Science*)
2. **Subsection** (e.g. *JavaScript Closures*, *B-Tree Indexes*)
3. **Note** (Detailed study document with markdown & code)
4. **Assets** (Locally managed images & media)

---

## ⌨️ Essential Keyboard Shortcuts
- `Cmd+K` / `Ctrl+K` — Open Global Command Palette & Search
- `Cmd+S` / `Ctrl+S` — Save note changes immediately
- `Cmd+B` / `Cmd+I` — Toggle Bold / Italic formatting
- `Alt+Up` / `Alt+Down` — Reorder items in lists
- `Esc` — Close dialogs / Exit Fullscreen Zen Mode

---

## 🔒 100% Offline & Zero Network
All notes and images are stored locally under:
`~/.local/share/study-notes/`

To create a backup, run:
```bash
bash scripts/backup-data.sh
```
"#;

    tx.execute(
        "INSERT INTO notes (id, subsection_id, title, content, created_at, updated_at, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![note_id, subsection_id, "Welcome to Study Notes", welcome_content, now, now, 0],
    )?;

    tx.commit()?;
    Ok(())
}
```

### 5. Backup & Restore Scripts (`scripts/backup-data.sh` & `scripts/restore-data.sh`)

**`scripts/backup-data.sh`:**
```bash
#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/study-notes"
BACKUP_DEST="${1:-$HOME/study-notes-backups}"
TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
ARCHIVE_NAME="study-notes-backup-${TIMESTAMP}.tar.gz"

if [ ! -d "$DATA_DIR" ]; then
    echo "❌ Error: Data directory not found at $DATA_DIR"
    exit 1
fi

mkdir -p "$BACKUP_DEST"

# Force SQLite WAL checkpoint to ensure all data is flushed into the main .db file
if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$DATA_DIR/study-notes.db" "PRAGMA wal_checkpoint(TRUNCATE);" || true
fi

tar -czf "$BACKUP_DEST/$ARCHIVE_NAME" -C "$(dirname "$DATA_DIR")" "study-notes"

echo "✅ Backup successfully created at: $BACKUP_DEST/$ARCHIVE_NAME"
echo "📦 Archive size: $(du -h "$BACKUP_DEST/$ARCHIVE_NAME" | cut -f1)"
```

**`scripts/restore-data.sh`:**
```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${1:-}"
DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/study-notes"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    echo "Usage: $0 <path-to-study-notes-backup.tar.gz>"
    exit 1
fi

# Create a pre-restore safety snapshot of current data if it exists
if [ -d "$DATA_DIR" ]; then
    SAFETY_BACKUP="${DATA_DIR}-pre-restore-$(date +%s).bak"
    echo "⚠️ Existing data found. Creating safety snapshot at $SAFETY_BACKUP..."
    cp -r "$DATA_DIR" "$SAFETY_BACKUP"
fi

mkdir -p "$(dirname "$DATA_DIR")"
tar -xzf "$BACKUP_FILE" -C "$(dirname "$DATA_DIR")"

echo "✅ Restore complete! Data directory restored to: $DATA_DIR"
```

---

## Detailed Technical Breakdown & Procedures

### 1. Arch Linux Dependency & Integration Matrix

| Component | Arch Linux Package | Purpose |
|-----------|--------------------|---------|
| **Webview Engine** | `webkit2gtk-4.1` | WebKit rendering engine used by Tauri on Linux |
| **GUI Framework** | `gtk3` | Window management and system event integration |
| **Tray / Indicators** | `libappindicator-gtk3` | System tray and notification support |
| **Local Database** | `sqlite` | Local relational database driver and integrity verification |
| **Crypto / Security** | `openssl` | Cryptographic primitives for UUID and hashing |
| **Icon Theme** | `hicolor-icon-theme` | Standard XDG icon path resolution |
| **Build Tooling** | `cargo`, `rust`, `pnpm`, `nodejs` | Build requirements for source AUR package |

### 2. Standalone AppImage Build & Validation
- Executing `pnpm tauri build --bundles appimage` packages the Next.js static export (`./out`) and the Rust backend into a portable `study-notes_0.1.0_amd64.AppImage`.
- Embeds execution permissions (`chmod +x`) and registers AppImage desktop integration hooks.
- Bundles all necessary SVG and PNG application icons for dynamic scaling in GNOME, KDE Plasma, XFCE, and tiling window managers (i3, Sway, Hyprland) automatically via Tauri bundler.

### 3. First-Run Directory Provisioning & Data Isolation
- During app startup in `src-tauri/src/db/mod.rs`:
  1. Resolves `$XDG_DATA_HOME/study-notes` (fallback `~/.local/share/study-notes`).
  2. Ensures directory permissions are restricted to user (`0700`).
  3. Creates `assets/` subfolder.
  4. Opens SQLite database with WAL journal mode (`PRAGMA journal_mode = WAL;`) and synchronous normal mode (`PRAGMA synchronous = NORMAL;`).
  5. Executes pending database migrations.
  6. Executes `seed_first_run_if_empty()` to populate onboarding note if database is freshly initialized.

### 4. Zero-Cloud Data Ownership & Portability Guide
- The user retains 100% ownership of all created content:
  - **Relational Data & Markdown:** `~/.local/share/study-notes/study-notes.db`
  - **Images & Attachments:** `~/.local/share/study-notes/assets/`
- Manual migration between Linux computers requires only copying the `study-notes` directory or using the `backup-data.sh` / `restore-data.sh` scripts.
- No network synchronization, external telemetry, or proprietary lock-in.

---

## Implementation Steps

| # | Task | Dependencies | Output Files |
|---|------|--------------|--------------|
| **1** | **Configure Tauri Linux Bundling & App Metadata**<br>Update `src-tauri/tauri.conf.json` with Linux bundle target (`appimage`), desktop categories, window constraints, and icon list. | Phase 0 Setup | `src-tauri/tauri.conf.json` |
| **2** | **Generate Full Resolution Linux Icon Set**<br>Generate PNG icons in all standard Linux resolutions and SVG vector icon in `src-tauri/icons/`. Note: Tauri handles embedding them. | Phase 0 Assets | `src-tauri/icons/*.png`, `src-tauri/icons/icon.svg` |
| **3** | **Create XDG Desktop Entry**<br>Create `packaging/linux/com.studynotes.app.desktop` with standard categories and keywords. | Task 1 | `packaging/linux/com.studynotes.app.desktop` |
| **4** | **Implement First-Run Seed & Welcome Note Engine**<br>Create `src-tauri/src/db/seed.rs` with `seed_first_run_if_empty()`, wire it into `db/mod.rs`, and write unit tests in `db/tests.rs`. | Phase 1 Backend | `src-tauri/src/db/seed.rs`<br>`src-tauri/src/db/mod.rs`<br>`src-tauri/src/db/tests.rs` |
| **5** | **Create Arch Linux AUR PKGBUILD Package (Stretch)**<br>Create `packaging/aur/PKGBUILD` (source build with `pnpm` + `cargo`) with `.SRCINFO` and install hooks. | Tasks 1, 3 | `packaging/aur/PKGBUILD`<br>`packaging/aur/study-notes.install` |
| **6** | **Implement Backup & Restore CLI Scripts**<br>Create executable `scripts/backup-data.sh` and `scripts/restore-data.sh` with WAL checkpoints, gzip compression, and safety snapshots. | Phase 1 Backend | `scripts/backup-data.sh`<br>`scripts/restore-data.sh` |
| **7** | **Update Project Documentation & User Guide**<br>Update `README.md` and create `LICENSE` with clear instructions for AUR installation (`yay -S study-notes`), AppImage execution, manual backups, and keyboard shortcuts. | All Tasks | `README.md`<br>`LICENSE` |
| **8** | **Execute Full Release & Offline Verification Pass**<br>Run `cargo test`, `pnpm check:offline`, `pnpm build`, `pnpm tauri build`, and verify packaged artifacts in clean Linux environment. | All Tasks | — |

---

## Edge Cases & Error Handling

1. **First-Run on Read-Only or Restricted Filesystem:**
   - If `$XDG_DATA_HOME` is non-writable, app catches the error and reports a clear UI message instead of crashing silently.
2. **AppImage FUSE Requirements on Modern Linux Distros:**
   - Document `--appimage-extract-and-run` fallback for Linux distributions without `libfuse2` (e.g. Ubuntu 24.04+ default minimal installs).
3. **Wayland vs X11 Compatibility:**
   - Setting `StartupWMClass=study-notes` and configuring standard GTK3 backend enables native Wayland execution on modern Arch compositors (Hyprland, Sway, GNOME Wayland) with automatic X11 fallback.
4. **Backup While App is Open & Writing:**
   - `backup-data.sh` executes `PRAGMA wal_checkpoint(TRUNCATE)` before archiving to guarantee all in-memory WAL transactions are committed into `study-notes.db`.

---

## Exit Criteria

- [ ] `cargo test` passes for all unit tests including first-run seed initialization.
- [ ] `pnpm check:offline` passes with 0 violations across all source code and packaging manifests.
- [ ] `pnpm tauri build` produces valid, working Linux release artifacts (`.AppImage`).
- [ ] App launches seamlessly from Linux application menu / rofi / dmenu with correct icon and name.
- [ ] First run on a clean machine automatically provisions `~/.local/share/study-notes/` and displays the Welcome Note.
- [ ] `scripts/backup-data.sh` produces a valid `.tar.gz` archive containing the database and assets.
- [ ] `scripts/restore-data.sh` reliably restores a backup archive with a safety snapshot of existing data.
- [ ] `README.md` clearly documents AUR installation, AppImage usage, and backup procedures.

---

## Estimated Effort

- **~7-10 files** created or modified
- **~120-150 lines** of Rust seed and system commands
- **~100-150 lines** of Bash packaging, backup, and verification scripts
- **~100 lines** of PKGBUILD packaging manifests
- **~100 lines** of user documentation and release guidelines
