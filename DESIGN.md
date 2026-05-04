---
version: alpha
name: PerFin (VoltAgent)
description: Terminal-native personal finance — void-black canvas, emerald signal green, Inter-heavy typography, warm-charcoal containment, financial-data density.
colors:
  primary: "#050507"
  on-primary: "#f2f2f2"
  accent: "#00d992"
  accent-soft: "rgba(0, 217, 146, 0.12)"
  accent-hover: "#2fd6a1"
  canvas: "#050507"
  surface: "#101010"
  surface-raised: "#161618"
  border: "#3d3a39"
  border-soft: "rgba(61, 58, 57, 0.5)"
  ink: "#f2f2f2"
  ink-soft: "#b8b3b0"
  ink-muted: "#8b949e"
  ink-faint: "#5a5d72"
  positive: "#00d992"
  positive-deep: "#008b00"
  negative: "#fb565b"
  negative-soft: "rgba(251, 86, 91, 0.12)"
  warning: "#ffba00"
  warning-soft: "rgba(255, 186, 0, 0.12)"
  glow-green: "#00d992"
typography:
  display:
    fontFamily: system-ui
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  h1:
    fontFamily: system-ui
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.015em"
  h2:
    fontFamily: system-ui
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  h3:
    fontFamily: system-ui
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.005em"
  body-lg:
    fontFamily: Inter, system-ui
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.5
  body-md:
    fontFamily: Inter, system-ui
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Inter, system-ui
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: Inter, system-ui
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.06em"
  mono:
    fontFamily: SFMono-Regular, Menlo, monospace
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
  fin:
    fontFamily: SFMono-Regular, Menlo, monospace
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
    fontVariation: '"tnum" 1, "zero" 1'
  fin-lg:
    fontFamily: SFMono-Regular, Menlo, monospace
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.2
    fontVariation: '"tnum" 1, "zero" 1'
rounded:
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  section: 48px
components:
  button-primary:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
    border: "1px solid {colors.border}"
  button-primary-hover:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-hover}"
    border: "1px solid {colors.accent}"
  button-cta:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
    fontWeight: 600
  button-cta-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.primary}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.negative}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
    border: "1px solid {colors.negative}"
  button-danger-hover:
    backgroundColor: "{colors.negative-soft}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
    border: "1px solid {colors.border}"
  card-raised:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
    border: "1px solid {colors.border}"
  card-highlight:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
    border: "1px solid {colors.accent}"
  sidebar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    border-right: "1px solid {colors.border}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
    border: "1px solid {colors.border}"
  input-focus:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
    border: "1px solid {colors.accent}"
  badge-positive:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
    typography: "{typography.label}"
  badge-negative:
    backgroundColor: "{colors.negative-soft}"
    textColor: "{colors.negative}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
    typography: "{typography.label}"
  badge-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
    typography: "{typography.label}"
  table-header:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    padding: "8px 12px"
    border-bottom: "1px solid {colors.border}"
  table-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    border-bottom: "1px solid {colors.border-soft}"
  table-row-hover:
    backgroundColor: "{colors.accent-soft}"
  divider:
    backgroundColor: "{colors.border}"
    height: 1px
  progress-bar:
    backgroundColor: "{colors.accent}"
    height: 3px
    rounded: "{rounded.full}"
  progress-track:
    backgroundColor: "{colors.border-soft}"
    height: 3px
    rounded: "{rounded.full}"
  metric-value:
    textColor: "{colors.ink}"
    typography: "{typography.fin-lg}"
  metric-label:
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
---

## Overview

PerFin reimagined in VoltAgent's deep-space terminal aesthetic — a dark, developer-native personal finance dashboard where void-black canvas and emerald green signal create an atmosphere of precision and control. The interface reads like a high-powered IDE for your money: dense, data-rich, and authoritative.

The design draws from VoltAgent's engineering-platform DNA: carbon-black surfaces (`#101010`) for cards and panels, warm charcoal borders (`#3d3a39`) for containment, and emerald signal green (`#00d992`) as the sole chromatic accent — reserved for positive financial indicators, active states, and interactive moments. The warm-neutral gray palette (`#b8b3b0`, `#8b949e`) prevents the dark theme from feeling cold or sterile.

Monospace fonts carry all financial figures — tabular numerals for ledger alignment, while system-ui powers headings with native authority and Inter handles body text with geometric precision. The result is an accounting interface that feels like a terminal: every number is precise, every transaction is a command.

## Colors

- **Canvas (#050507):** Near-black void — the page background. Darker than most dark themes for maximum contrast with emerald accents.
- **Surface (#101010):** Carbon-fiber cards and panels — one shade above canvas. Creates barely perceptible elevation.
- **Surface-Raised (#161618):** Hover state and elevated cards — the brightest dark surface.
- **Accent (#00d992):** Emerald Signal Green — positive financial indicators, active nav items, interactive borders. The sole chromatic voice.
- **Accent-Soft (rgba):** 12% green tint — subtle badge backgrounds and row hover fills.
- **Border (#3d3a39):** Warm Charcoal — card boundaries, section separators, hairline details. Warm tone prevents sterility.
- **Ink (#f2f2f2):** Snow White — primary text. Softened from pure white for eye comfort.
- **Ink-Soft (#b8b3b0):** Warm Parchment — secondary body text.
- **Ink-Muted (#8b949e):** Steel Slate — tertiary text, metadata, timestamps.
- **Negative (#fb565b):** Danger Coral — debits, spending, destructive actions.

## Typography

System-ui for all headings (instant rendering, native OS personality). Inter for body and UI text (geometric precision). SFMono for all financial figures with tabular numeral features enabled. Headings use compressed line-height (1.05–1.2) with negative letter-spacing for dense, authoritative text blocks.

## Layout & Spacing

8px base grid with warm charcoal border containment. Sidebar (240px, carbon surface) on the left. Content area (max-width 1280px) fills remaining space. Cards are 8px radius with 1px warm-charcoal borders — no floating shadows. Elevation comes from border weight and color, not shadows.

## Components

### Buttons
Default buttons are ghost-style: transparent with warm charcoal border, emerald text on hover. Primary CTA button uses emerald fill with void-black text. All interactive elements show emerald accent on hover/active.

### Cards
Carbon surface (`#101010`), 8px radius, 1px warm charcoal border. Active/highlighted cards swap to emerald border. No multi-layer shadows.

### Financial Display
Monospace (`SFMono-Regular`) for all monetary values with `tnum` and `zero` features enabled. Large metric displays use 20px bold monospace. Ledger tables use alternating row transparency with emerald hover highlight.

### Inputs
Carbon surface background, warm charcoal border, 6px radius. On focus: border switches to emerald green glow. Placeholder text in warm parchment.

## Do's and Don'ts

- Do use void-black (#050507) as the default background — the darkness IS the brand
- Do reserve emerald green for positive signals and interactive elements only
- Do apply warm charcoal (#3d3a39) borders to all cards and panels
- Do use SFMono/Menlo for all financial figures with tabular numerals
- Do use system-ui for headings — native authority beats custom fonts
- Do use Inter for body text
- Don't introduce additional accent colors beyond emerald green
- Don't use heavy shadows — depth comes from border treatment
- Don't use pure white (#ffffff) as default text — softened snow white (#f2f2f2) is the standard
- Don't use bright or light backgrounds for primary surfaces
- Don't mix in serif or decorative fonts — the system is sans-serif + monospace only
