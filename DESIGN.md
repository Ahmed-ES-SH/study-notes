---
name: Terminal Noir
colors:
  surface: '#0b141c'
  surface-dim: '#0b141c'
  surface-bright: '#313a43'
  surface-container-lowest: '#060f16'
  surface-container-low: '#141c24'
  surface-container: '#182028'
  surface-container-high: '#222b33'
  surface-container-highest: '#2d363e'
  on-surface: '#dae3ee'
  on-surface-variant: '#c1c6d6'
  inverse-surface: '#dae3ee'
  inverse-on-surface: '#29313a'
  outline: '#8b919f'
  outline-variant: '#414753'
  surface-tint: '#aac7ff'
  primary: '#aac7ff'
  on-primary: '#002f65'
  primary-container: '#418fff'
  on-primary-container: '#002959'
  inverse-primary: '#005cba'
  secondary: '#67df70'
  on-secondary: '#00390d'
  secondary-container: '#27a640'
  on-secondary-container: '#00320a'
  tertiary: '#d5bbff'
  on-tertiary: '#41008b'
  tertiary-container: '#a875fc'
  on-tertiary-container: '#39007a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d7e3ff'
  primary-fixed-dim: '#aac7ff'
  on-primary-fixed: '#001b3e'
  on-primary-fixed-variant: '#00458e'
  secondary-fixed: '#83fc89'
  secondary-fixed-dim: '#67df70'
  on-secondary-fixed: '#002105'
  on-secondary-fixed-variant: '#005317'
  tertiary-fixed: '#ecdcff'
  tertiary-fixed-dim: '#d5bbff'
  on-tertiary-fixed: '#270058'
  on-tertiary-fixed-variant: '#5a21ab'
  background: '#0b141c'
  on-background: '#dae3ee'
  surface-variant: '#2d363e'
typography:
  display:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  code-block:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  code-inline:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: -0.01em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
    letterSpacing: 0.03em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  space-2xs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-base: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
  sidebar-expanded: 16rem
  sidebar-collapsed: 3.5rem
  reading-column-max: 52rem
  modal-standard: 40rem
---

## Brand & Style

The design system targets software engineers, technical researchers, and computer science students engaged in prolonged, deep-focus technical reading, code deconstruction, and structured note-taking. The emotional response is centered on quiet cognitive flow, precision, and authority—evoking the focus of a finely tuned terminal environment paired with the clarity of a high-end typography-first editorial reader.

The aesthetic philosophy draws upon **Minimalist Technical Noir**: an obsidian dark canvas, structured hair-thin dividers, zero decorative gradients or frivolous animations, and an intentional hierarchy derived from classic IDE syntax palettes. Visual weight is communicated strictly through surface brightness steps, crisp 1px borders, and syntax-derived semantic accents rather than heavy drop shadows or ornamental layers.

## Colors

The palette establishes a distraction-free technical workspace using GitHub/Neovim-inspired obsidian slate tones, offset by syntax-highlighter accents that provide cognitive markers for states and content categories without visual fatigue.

### Surface Tiers
- **Canvas Base (`#0d1117`)**: Primary window backdrop, reading mode canvas, and deep foundation.
- **Surface Layer 1 (`#161b22`)**: Collapsible navigation sidebars, table of contents panels, and status toolbars.
- **Surface Layer 2 (`#21262d`)**: Active card containers, nested code blocks, interactive hover states, and input field backgrounds.
- **Surface Layer 3 (`#30363d`)**: Elevated dialogs, popovers, floating command palettes, and active tooltips.

### Outlines & Dividers
- **Subtle Border (`#30363d`)**: Universal 1px structural separator for cards, panels, and table cells.
- **Muted Border (`#21262d`)**: Low-contrast internal dividers within dense lists.
- **Focus Ring (`#388bfd`)**: High-contrast, 2px unblurred focus indicators for accessibility and keyboard navigation.

### Semantic Syntax Accents
- **Electric Cobalt (`#388bfd`)**: Primary interactions, active tab indicators, hyperlinked technical entities, and informational callouts.
- **Emerald Green (`#3fb950` / `#2ea043`)**: Success confirmation, verification badges, diff additions, and completed review items.
- **Amber Gold (`#d29922`)**: Warnings, pending review states, code warnings, and highlight annotations.
- **Purple Violet (`#a371f7`)**: Metadata tags, technical categories, types/interfaces, and algorithmic taxonomies.
- **Coral Rose (`#f85149`)**: Errors, destructive actions, critical notices, and diff deletions.

### Text & Iconography Hierarchy
- **Text Primary (`#f0f6fc`)**: Pure clarity for technical prose, markdown bodies, and high-priority code.
- **Text Secondary (`#8b949e`)**: Captions, timestamps, secondary navigation metadata, and inactive icons.
- **Text Muted (`#484f58`)**: Line numbers, disabled states, placeholder strings, and non-actionable syntax delimiters.

## Typography

The type system pairs **Inter** for clean readability across UI controls and long-form prose with **JetBrains Mono** for code blocks, badges, metadata tokens, and navigation shortcuts.

### Editorial Prose Guidelines
- Long-form markdown content uses `body-lg` (16px / 26px line height) constrained to a maximum reading width of 68ch to prevent eye fatigue across expansive desktop monitors.
- Technical headings employ subtle negative tracking to preserve structural tightness.
- Inline code snippets are styled with `code-inline`, rendered with a 2px horizontal padding and a subtle background fill (`#21262d`) to cleanly separate identifiers from standard technical prose.

## Layout & Spacing

The layout is built on a 4px/8px base spacing increment designed specifically for multi-pane desktop productivity tools.

### Multi-Pane Architecture
- **Primary Rail / Nav**: `sidebar-expanded` (256px) default width, collapsible to `sidebar-collapsed` (56px) showing icon-only access.
- **Explorer / Topic Panel**: Variable width between 240px and 320px with custom split-pane resizing handles.
- **Main Document Canvas**: Flex-grow region. When in standard editing mode, margins sit at 24px–32px. In **Distraction-Free Fullscreen Mode**, sidebars auto-hide and the main document canvas centers itself into a strict `reading-column-max` (832px) container with generous vertical breathing room (`space-2xl`).

### Breakpoints & Adaptations
- **Desktop (>= 1280px)**: 3-pane view (Navigation, File/Topic List, Active Note/Editor) fully visible simultaneously.
- **Compact Desktop / Tablet (768px - 1279px)**: Explorer collapses into an overlay drawer; primary rail persists or collapses to compact icons.
- **Mobile (< 768px)**: Single active pane architecture. Navigation transitions to a bottom sheet or off-canvas drawer; reading mode occupies 100% viewport width with 16px lateral padding.

## Elevation & Depth

This design system avoids blurry, dispersed drop shadows that create visual haze in dark-themed IDE-style interfaces. Depth is achieved strictly through **Tonal Stepping** and **Hairline Outlines**.

1. **Flat (Canvas)**: `#0d1117` with no elevation. Used for the background shell and full-screen reading backing.
2. **Structural Tiers (Layer 1 & 2)**: Sidebars (`#161b22`) and code cards (`#21262d`) rely on a 1px solid `#30363d` outline. No drop shadows are cast.
3. **Elevated Overlays (Modals & Command Palette)**: Surface `#161b22` bounded by a 1px crisp outline of `#30363d`, backed by a sharp, tight ambient drop shadow (`0 8px 24px rgba(1, 4, 9, 0.85)`). Backdrop scrims use `#0d1117` at 80% opacity with a subtle 4px blur.
4. **Tooltips & Popovers**: Surface `#21262d`, border `#30363d`, with a micro shadow (`0 4px 12px rgba(1, 4, 9, 0.6)`).

## Shapes

The design language uses a compact, disciplined **Soft (1)** shape language:
- Controls (Buttons, Inputs, Checkboxes, Dropdowns): 4px (`0.25rem`) border radius.
- Cards, Code Blocks, and Modals: 6px (`0.375rem`) to 8px (`0.5rem`) border radius.
- Status Dots & Circular Avatars: 9999px for full roundness.

This restrained radius reinforces technical precision and compact information density, preventing UI components from feeling playful or consuming unnecessary layout padding.

## Components

### Buttons
- **Primary**: Background `#388bfd`, text `#ffffff`, border 1px solid transparent. Hover: `#4c9aff`.
- **Secondary / Ghost**: Background `#21262d`, text `#f0f6fc`, border 1px solid `#30363d`. Hover: background `#30363d`.
- **Danger**: Background `#21262d`, text `#f85149`, border 1px solid `#30363d`. Hover: background `#da3633`, text `#ffffff`.
- **Size**: 28px height for compact toolbars, 32px height standard. Typography strictly JetBrains Mono (`label-md`).

### Syntax Chips & Badges
- Constructed with a subtle alpha tint of their respective syntax accent:
  - **Type / Lang Tag**: Background `rgba(163, 113, 247, 0.15)`, text `#a371f7`, border 1px solid `rgba(163, 113, 247, 0.4)`.
  - **Status Tag**: Background `rgba(63, 185, 80, 0.15)`, text `#3fb950`, border 1px solid `rgba(63, 185, 80, 0.4)`.
- Height: 20px, font: `label-sm`, padding: 0 6px, border radius: 4px.

### Inputs & Search Bars
- Background `#161b22`, border 1px solid `#30363d`, text `#f0f6fc`, placeholder `#8b949e`.
- Focus state: Border color changes to `#388bfd` with an inner or box-shadow ring of 1px solid `#388bfd`.
- Command palette input (`Cmd+K`): Sits inside an elevated dialog, 48px height, 16px font size, clean underline or frameless style.

### Checkboxes & Radios
- 16x16px square (checkbox) or circle (radio), background `#161b22`, border 1px solid `#30363d`.
- Checked state: Background `#388bfd`, border `#388bfd`, checkmark rendered in pure white (`#ffffff`).

### Technical Cards & Code Containers
- Background `#161b22`, border 1px solid `#30363d`.
- Header bar: Background `#0d1117` or `#161b22`, containing file name or topic in `label-md`, followed by copy/share actions in secondary text `#8b949e`.
- Body: Background `#0d1117`, padding 12px 16px, syntax highlighting rendered according to token rules.

### Collapsible Sidebar Rails
- Border-right: 1px solid `#30363d`.
- Items have an active indicator line (2px wide, `#388bfd`) aligned along the inner edge. Active item background: `#21262d`, text: `#f0f6fc`. Hover item background: `rgba(48, 54, 61, 0.5)`.