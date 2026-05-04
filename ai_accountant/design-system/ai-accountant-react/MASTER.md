# Design System Master File — Wise Edition

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.

**Project:** PerFin (Wise redesign)
**Category:** Financial Dashboard
**Reference:** Wise.com — bold fintech, lime-green accent, Inter typography, pill buttons

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#0e0f0c` | `--color-primary` |
| Accent | `#9fe870` | `--color-accent` |
| Accent Text | `#163300` | `--color-accent-text` |
| Accent Hover | `#cdffad` | `--color-accent-hover` |
| Canvas | `#ffffff` | `--color-canvas` |
| Ink | `#0e0f0c` | `--color-ink` |
| Ink Muted | `#454745` | `--color-ink-muted` |
| Surface | `#e8ebe6` | `--color-surface` |
| Surface Soft | `#f5f7f3` | `--color-surface-soft` |
| Positive | `#054d28` | `--color-positive` |
| Negative | `#d03238` | `--color-negative` |
| Border | `rgba(14,15,12,0.12)` | `--color-border` |
| Ring | `#9fe870` | `--color-ring` |

**Color Notes:** Wise Lime Green (#9fe870) — fresh, optimistic, anti-bank. Dark green text (#163300) on green buttons for 9.5:1 contrast. Near-black (#0e0f0c) ink with warm green undertone.

### Typography

- **Font:** Inter (all text — no separate heading font)
- **Google Fonts:** [Inter](https://fonts.google.com/specimen/Inter) — weights 400, 600, 900
- **Mood:** bold, confident, fresh, fintech, international, optimistic

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;900&display=swap');
```

### Typography Scale

| Role | Weight | Size | Line Height | Notes |
|------|--------|------|-------------|-------|
| Display Mega | 900 | 96px | 0.85 | `"calt"` enabled, ultra-tight |
| Display | 900 | 56px | 0.85 | Hero headlines |
| H1 | 900 | 40px | 0.85 | Section headings |
| H2 / Card Title | 600 | 22px | 1.25 | -0.396px tracking |
| Body Large | 600 | 18px | 1.44 | Default body — confident weight |
| Body | 400 | 16px | 1.44 | Secondary body |
| Body Small | 400 | 14px | 1.50 | Captions, metadata |
| Label | 600 | 12px | 1.00 | -0.084px tracking, all-caps |
| Financial | 600 | 18px | 1.44 | `"tnum"` for tabular numbers |

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` | Tight gaps |
| `--space-sm` | `8px` | Icon gaps, inline spacing |
| `--space-md` | `16px` | Standard padding |
| `--space-lg` | `24px` | Section padding |
| `--space-xl` | `32px` | Large gaps |
| `--space-2xl` | `48px` | Section margins |

### Shadow Depths — Ring Shadows Only

| Level | Value | Usage |
|-------|-------|-------|
| Ring | `0px 0px 0px 1px rgba(14,15,12,0.12)` | Card borders, input borders |
| Ring Strong | `0px 0px 0px 1px rgba(14,15,12,0.20)` | Focus emphasis |

**No floating shadows. No multi-layer elevation. Depth = green accent on neutral canvas.**

---

## Component Specs

### Buttons — Pill Shape (9999px radius)

```css
/* Primary Green Pill */
.btn-primary {
  background: #9fe870;
  color: #163300;
  padding: 5px 16px;
  border-radius: 9999px;
  font-family: Inter;
  font-weight: 600;
  font-size: 16px;
  transition: transform 150ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  transform: scale(1.05);
}

.btn-primary:active {
  transform: scale(0.95);
}

/* Secondary Subtle Pill */
.btn-secondary {
  background: rgba(22, 51, 0, 0.08);
  color: #0e0f0c;
  padding: 8px 16px;
  border-radius: 9999px;
  font-family: Inter;
  font-weight: 600;
  font-size: 14px;
  transition: transform 150ms ease;
  cursor: pointer;
}
```

### Cards — Ring Shadow, 30px Radius

```css
.card {
  background: #ffffff;
  border-radius: 30px;
  padding: 24px;
  box-shadow: rgba(14,15,12,0.12) 0px 0px 0px 1px;
  transition: transform 150ms ease;
}

.card:hover {
  transform: scale(1.02);
}
```

### Inputs — 10px Radius, Ring Shadow

```css
.input {
  padding: 12px 16px;
  border-radius: 10px;
  box-shadow: rgba(14,15,12,0.12) 0px 0px 0px 1px;
  font-size: 16px;
  font-family: Inter;
  transition: box-shadow 150ms ease;
}

.input:focus {
  outline: none;
  box-shadow: rgb(134,134,133) 0px 0px 0px 1px inset,
              #9fe870 0px 0px 0px 2px;
}
```

### Sidebar — Green-Tinted Surface

```css
.sidebar {
  background: #f5f7f3;
  border-right: 1px solid rgba(14,15,12,0.12);
  width: 260px;
}
```

---

## Style Guidelines

**Style:** Wise Bold Fintech

**Keywords:** Lime green, near-black, confident, fresh, international, money without borders, bold typography, pill buttons, scale hover

**Key Effects:**
- `transform: scale(1.05)` on hover — buttons physically grow
- `transform: scale(0.95)` on active — buttons compress
- Ring shadows only (`0px 0px 0px 1px`)
- `font-feature-settings: "calt" 1` on ALL text
- `font-feature-settings: "tnum" 1` on financial numbers

---

## Anti-Patterns (Do NOT Use)

- ❌ Floating shadows / box-shadow with blur
- ❌ Border-radius below 10px (except for ring shadows)
- ❌ Light font weights for display text
- ❌ Line-height above 1.0 on display headings
- ❌ Green as background color (only for CTAs and indicators)
- ❌ Emojis as icons — use SVG (Lucide, Heroicons)
- ❌ Missing cursor:pointer on clickable elements
- ❌ Instant state changes — always use transitions (150ms)
- ❌ Invisible focus states — must be visible for a11y

---

## Pre-Delivery Checklist

- [ ] No emojis used as icons (use SVG)
- [ ] All buttons use pill shape (9999px border-radius)
- [ ] `scale(1.05)` on button hover
- [ ] `"calt"` on all text elements
- [ ] Ring shadows only — no floating shadows
- [ ] Green accent on CTAs only — never as background
- [ ] `cursor-pointer` on all clickable elements
- [ ] Focus states visible with green ring
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 576px, 992px, 1440px
- [ ] No horizontal scroll on mobile
