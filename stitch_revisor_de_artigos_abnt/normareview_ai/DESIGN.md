---
name: NormaReview AI
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#0058be'
  on-secondary: '#ffffff'
  secondary-container: '#2170e4'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#002113'
  on-tertiary-container: '#009668'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 18px
  academic-preview:
    fontFamily: Merriweather
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 24px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  space-2xs: 0.25rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
  gutter-sidebar: 18rem
  gutter-panel: 24rem
  canvas-max-width: 54rem
---

## Brand & Style

The design system establishes an atmosphere of peerless academic rigor, technological precision, and quiet confidence. Tailored for researchers, graduate scholars, academic institutions, and peer reviewers, the aesthetic fuses the sobriety of institutional scholarship with the speed and elegance of modern generative AI tooling.

The visual style follows an **Academic Modernist** approach:
- **Structural Integrity:** Heavy reliance on clear visual hierarchy, typographic discipline, and subtle line dividers reminiscent of architectural blueprints and scientific journals.
- **Cognitive Calm:** Low visual noise, crisp off-white workspaces (`#F8FAFC`), and deep ink-slate anchors that foster deep-focus editing sessions during long hours of dissertation formatting.
- **Diagnostic Clarity:** Every alert, suggestion, and conformity status delivers immediate semantic clarity through high-contrast badges, non-intrusive micro-interactions, and side-by-side diffing layouts.

## Colors

The color palette reflects trustworthiness, institutional authority, and unambiguous normative feedback.

- **Primary Canvas & Slate Spine (`#0F172A`, `#1E293B`):** Deep oceanic ink reserved for high-impact typography, sidebars, primary actions, and formal headers. Conveys depth and institutional credibility.
- **Interactive Cobalt (`#3B82F6`):** Precision accent for AI-assisted operations, focused input states, active tabs, and primary progressive disclosure triggers.
- **ABNT Conformance Emerald (`#10B981`, `#059669`):** Indicates 100% standard compliance (e.g., citation matched, NBR 10520 validated, margins aligned, bibliographic reference verified).
- **Advisory Amber (`#F59E0B`, `#D97706`):** Highlights semantic warnings, ambiguous citations, or secondary recommendations requiring author confirmation.
- **Violation Crimson (`#EF4444`, `#DC2626`):** Flags critical formatting failures (e.g., missing bibliographic entries, invalid author-date casing, or broken page indexing).
- **Backgrounds & Surfaces (`#FFFFFF`, `#F8FAFC`, `#F1F5F9`):** Pure white for paper/manuscript simulation cards and high-elevation modals; soft slate-gray for workbench work surfaces.

## Typography

The typographic hierarchy separates UI telemetry from scholarly document representation:

- **System UI Shell:** Handled primarily by `Plus Jakarta Sans` for headers and contextual controls, imparting modern clarity without feeling overly informal.
- **Dense Operational Copy:** Delivered via `Inter` at high readability ratios, ensuring long diagnostic lists and complex rule criteria remain effortless to parse.
- **Academic Simulation Canvas:** Uses `Merriweather` exclusively inside the manuscript preview panes. This enables accurate simulation of serifed formal papers (Times New Roman / Georgia substitutes) compliant with traditional university submission guidelines.
- **Technical Telemetry & ABNT Rule Keys:** Uses `JetBrains Mono` for standard markers (e.g., `NBR 6023:2018`, `§ 4.2.1`), citation tags, and metadata checksums.

## Layout & Spacing

The layout is designed for desktop productivity, utilizing a structured 3-pane workbench:

- **Primary Global Navigation (Left):** Compact vertical rail or expandable drawer (`18rem` default) housing document trees, compliance dashboards, and rule configurations.
- **Academic Canvas (Center):** Fluid viewport hosting the document preview page. Constrained to a standard academic readability width (`canvas-max-width: 54rem`), mimicking A4 dimensional ratios (210mm × 297mm) with visual page-break delimiters.
- **Diagnostic Inspector (Right):** Contextual sidecar (`24rem`) featuring real-time AI suggestions, ABNT discrepancy lists, one-click fixes, and citation cross-match results.
- **Grid & Alignment:** Spacing adheres strictly to an 8pt base grid (`0.5rem`, `1rem`, `1.5rem`, `2rem`), scaling to 4pt micro-increments for badge padding, rule chips, and icon-to-text baselines.

## Elevation & Depth

Depth is established through soft, multi-layered ambient lighting and crisp low-contrast borders rather than harsh drop shadows:

- **Subsurface / Canvas (`#F8FAFC`):** The neutral workbench plane hosting panels and secondary tools.
- **Surface Elevation (`#FFFFFF`):** High-focus cards, inspection tiles, and manuscript paper. Bordered with a subtle keyline stroke (`1px solid #E2E8F0`).
- **Overlay & Flyout Depth:** Modals and contextual correction popovers utilize a composite shadow structure:
  - `box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 10px 25px -5px rgba(15, 23, 42, 0.08)`
  - Paired with an extra-crisp boundary (`border: 1px solid rgba(226, 232, 240, 0.8)`) to maintain surgical legibility.
- **Focus Rings:** Non-disruptive, vibrant cobalt halos (`0 0 0 3px rgba(59, 130, 246, 0.15)`) designed for rapid keyboard navigation across correction candidates.

## Shapes

The interface employs a disciplined **Soft** curvature archetype (`roundedness: 1`):
- **Base Components:** Standard inputs, buttons, and context cards use `rounded-md` (`0.375rem` / `6px`) to preserve a serious, academic tone while avoiding stark, aggressive sharp corners.
- **Containers & Panes:** Document preview sheets, inspection boards, and modal sheets use `rounded-lg` (`0.5rem` / `8px`).
- **Status Pills & Chips:** Micro-badges indicating rule tags (e.g., `ABNT NBR 14724`) use fully rounded pills (`rounded-full`) to contrast against rectangular text blocks.

## Components

### Buttons & Quick Actions
- **Primary Review Action:** Slate foundation (`#0F172A`) with pure white text, transitioning to `#1E293B` on hover. High visual density with `px-4 py-2` and `text-sm font-semibold`.
- **AI Assist Action:** Gradient-tinted cobalt surface (`#3B82F6`) with micro sparkle icon, providing immediate semantic recognition for auto-correction sequences.
- **Inline Fix Affirmation:** Subtle emerald wash (`#ECFDF5`) with deep emerald text (`#065F46`), turning solid on hover for rapid single-click resolution.

### ABNT Status Badges & Chips
- **Conformant:** Background `#ECFDF5`, text `#065F46`, border `#A7F3D0`. Prepended with an emerald verification glyph.
- **Warning:** Background `#FFFBEB`, text `#92400E`, border `#FDE68A`. Used for discretionary stylistic choices (e.g., footnote spacing variations).
- **Non-Conformant:** Background `#FEF2F2`, text `#991B1B`, border `#FECACA`. Used for non-negotiable breaches (e.g., missing author surname capitalization in references).

### Academic Comparison Card (Diff Engine)
- Two-column split-view comparison showing original text alongside AI-standardized ABNT suggestions.
- Left column (Original): Background `#FFF1F2` with strike-through annotations.
- Right column (Standardized): Background `#F0FDF4` with highlighted additions.
- Footer toolbar with immediate actions: "Aplicar Correção" (Primary Cobalt), "Ignorar Regra" (Ghost Neutral), and "Ver Norma NBR" (Link).

### Inputs & Rule Selectors
- Background `#FFFFFF`, border `#CBD5E1`. On active focus, applies border `#3B82F6` and 3px cobalt glow.
- Monospace tags embedded inside rule search bars for rapid ABNT standard indexing (e.g., typing `NBR 10520` immediately filters citation-specific lint rules).

### Citation Inspection Lists
- Interactive checklist cards equipped with tri-state status indicators (Passed, Warning, Error), bibliographic reference links, and contextual jumps directly into the preview document canvas.