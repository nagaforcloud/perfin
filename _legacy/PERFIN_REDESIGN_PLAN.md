# PerFin UI Redesign — Implementation Plan

**Direction:** Warm Light Minimalism (Notion/Stripe-inspired)
**Migration strategy:** Full rewrite of the design system and frontend styling
**Theme support:** Light + dark mode with user toggle (persisted to localStorage)
**Target stack:** React 19, Vite 8, TypeScript, Tailwind CSS v4 (already in use)
**Scope of changes:** `ai_accountant_react/` only. No backend or schema changes.

---

## Design philosophy

The current UI is a dark glassmorphism dashboard. The new UI is the opposite: **warm, paper-toned, calm, typographically confident, with one accent color used sparingly**. The goal is for the app to feel like a thoughtful financial journal rather than a flashy fintech product. It should reduce anxiety, not amplify it.

**Cut entirely:**
- `backdrop-filter: blur(...)` and all glass effects
- Radial gradients in the background
- Pill-radius (`9999px`) on buttons (keep only for chips/tags)
- The slate-blue dark canvas (`#0F172A`)
- Ambient brand-blue glow effects
- Plus Jakarta Sans

**Replace with:**
- Warm paper backgrounds (light) / warm charcoal (dark)
- Hairline 1px borders on every surface
- A modular type scale anchored on Inter Variable
- One accent color (terracotta) used only on primary actions and key data points
- Generous whitespace and 8pt spacing grid

---

## Phase 0 — Token system & theme infrastructure

### 0.1 Replace `src/index.css`

Define all design tokens as CSS variables under `:root` (light) and `[data-theme="dark"]`. Tailwind v4's `@theme` directive should pull from these.

```css
@import "tailwindcss";

@theme {
  --font-sans: "Inter Variable", "Inter", system-ui, sans-serif;
  --font-display: "Inter Variable", "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace;
}

:root {
  /* Surfaces */
  --bg: #FBF9F4;
  --surface: #FFFFFF;
  --surface-2: #F5F1E8;
  --surface-hover: #F0EBDD;

  /* Borders */
  --border: #E8E2D5;
  --border-strong: #D4CCB8;
  --border-focus: #C97B5C;

  /* Text */
  --text: #1F1D1A;
  --text-muted: #6B6760;
  --text-subtle: #9A958A;
  --text-inverse: #FBF9F4;

  /* Accent (terracotta) — primary actions, key data */
  --accent: #C97B5C;
  --accent-hover: #B86A4D;
  --accent-active: #A55A3F;
  --accent-soft: #F5E6DD;

  /* Semantic */
  --success: #6B8E5A;       /* income, positive */
  --success-soft: #E5EDDC;
  --danger: #B85450;        /* expense, negative */
  --danger-soft: #F4DEDD;
  --warning: #C7913D;
  --warning-soft: #F4E8D0;
  --info: #6B7C8E;
  --info-soft: #DEE3E9;

  /* Elevation */
  --shadow-1: 0 1px 2px rgba(31,29,26,0.04), 0 1px 1px rgba(31,29,26,0.02);
  --shadow-2: 0 4px 12px rgba(31,29,26,0.04), 0 1px 2px rgba(31,29,26,0.02);
  --shadow-3: 0 8px 24px rgba(31,29,26,0.06), 0 2px 4px rgba(31,29,26,0.03);
  --ring-focus: 0 0 0 3px rgba(201,123,92,0.25);

  /* Radii */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --radius-full: 9999px;

  /* Spacing reference (Tailwind handles this; documented for reference) */
  /* 4 8 12 16 20 24 32 40 48 64 80 96 */
}

[data-theme="dark"] {
  --bg: #1A1814;
  --surface: #242019;
  --surface-2: #2D2820;
  --surface-hover: #332D24;

  --border: #3A3428;
  --border-strong: #4A4332;
  --border-focus: #D89478;

  --text: #F5F1E8;
  --text-muted: #B0AB9F;
  --text-subtle: #7A746A;
  --text-inverse: #1F1D1A;

  --accent: #D89478;
  --accent-hover: #E2A287;
  --accent-active: #C98368;
  --accent-soft: #3A2A22;

  --success: #88A66E;
  --success-soft: #2A331F;
  --danger: #D17570;
  --danger-soft: #3A2120;
  --warning: #DBA85F;
  --warning-soft: #3A2D1A;
  --info: #8FA0B5;
  --info-soft: #25303A;

  --shadow-1: 0 1px 2px rgba(0,0,0,0.4), 0 1px 1px rgba(0,0,0,0.2);
  --shadow-2: 0 4px 12px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2);
  --shadow-3: 0 8px 24px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3);
  --ring-focus: 0 0 0 3px rgba(216,148,120,0.3);
}

html, body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  font-feature-settings: "ss01", "cv11";
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

/* Tabular numbers utility — apply to all financial values */
.tabular { font-variant-numeric: tabular-nums; }
```

### 0.2 Add fonts

Self-host Inter Variable and JetBrains Mono Variable from `fontsource` (more reliable than Google Fonts). Install:

```bash
npm install @fontsource-variable/inter @fontsource-variable/jetbrains-mono
```

In `src/main.tsx`:
```ts
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
```

Remove the existing Plus Jakarta Sans `<link>` from `index.html`.

### 0.3 Theme store

Create `src/store/useThemeStore.ts`:

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (t: Theme) => void;
  initialize: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "system",
      resolved: "light",
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme, set);
      },
      initialize: () => applyTheme(get().theme, set),
    }),
    { name: "perfin-theme" }
  )
);

function applyTheme(
  theme: Theme,
  set: (s: Partial<ThemeState>) => void
) {
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const resolved =
    theme === "system" ? (mql.matches ? "dark" : "light") : theme;
  document.documentElement.dataset.theme = resolved;
  set({ resolved });
}

// Listen for system changes
if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const { theme } = useThemeStore.getState();
    if (theme === "system") useThemeStore.getState().setTheme("system");
  });
}
```

Call `useThemeStore.getState().initialize()` once in `src/main.tsx` before React renders, to avoid a flash of the wrong theme.

**Acceptance for Phase 0:**
- [ ] Body renders on `--bg` paper tone in light mode
- [ ] Toggling `data-theme="dark"` on `<html>` switches every variable
- [ ] Inter Variable loads with no FOUT (Flash of Unstyled Text)
- [ ] No `backdrop-filter` rule remains anywhere in `index.css`
- [ ] Theme persists across reloads

---

## Phase 1 — Core UI primitives

Rewrite each component in `src/components/ui/` from scratch. All components must:
- Accept a `className` prop and merge via `clsx`
- Use only token-based classes/styles, never hardcoded hex
- Support both themes via CSS variables
- Render numbers with `tabular-nums` where applicable

### 1.1 Button (`src/components/ui/Button.tsx`)

Variants: `primary`, `secondary`, `ghost`, `danger`. Sizes: `sm`, `md`, `lg`. **Border radius is `--radius-md` (10px), never pill.**

```tsx
// Conceptual styling (use Tailwind arbitrary values bound to variables)
primary:   bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]
secondary: bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]
           hover:bg-[var(--surface-hover)]
ghost:     text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]
danger:    bg-[var(--danger)] text-white hover:opacity-90

sizes:
sm: h-8  px-3 text-sm
md: h-10 px-4 text-sm
lg: h-12 px-5 text-base

focus: focus-visible:shadow-[var(--ring-focus)] outline-none
```

Remove the `scale(1.05)` hover transform. Replace with subtle background shift only.

### 1.2 Card (`src/components/ui/Card.tsx`)

```tsx
className="bg-[var(--surface)] border border-[var(--border)]
           rounded-[var(--radius-lg)] shadow-[var(--shadow-1)]"
```

Add a `<CardHeader>`, `<CardBody>`, `<CardFooter>` subcomponent set. Header uses `--text` at `text-base font-medium`, with optional muted description on a second line.

No glass. No backdrop-filter. No gradient borders.

### 1.3 Input / Textarea / Select (new file: `src/components/ui/Input.tsx`)

```tsx
h-10 px-3 rounded-[var(--radius-md)]
bg-[var(--surface)] border border-[var(--border)]
text-[var(--text)] placeholder:text-[var(--text-subtle)]
focus:border-[var(--border-focus)] focus:shadow-[var(--ring-focus)]
```

Add a label component above and a hint/error component below. All form fields must follow this pattern.

### 1.4 Badge (`src/components/ui/Badge.tsx`)

Variants tied to semantic tokens. Use the `*-soft` background with the matching foreground:

```tsx
income:  bg-[var(--success-soft)] text-[var(--success)]
expense: bg-[var(--danger-soft)] text-[var(--danger)]
neutral: bg-[var(--surface-2)] text-[var(--text-muted)]
warning: bg-[var(--warning-soft)] text-[var(--warning)]
```

Use `--radius-full` (this is the only place pill-radius is allowed). Size: `h-6 px-2.5 text-xs font-medium`.

### 1.5 Modal (`src/components/ui/Modal.tsx`)

- Overlay: `bg-[rgba(31,29,26,0.4)] backdrop-blur-sm` (the only place a small blur is acceptable, on the overlay only — not on the modal itself)
- Modal surface: `bg-[var(--surface)] rounded-[var(--radius-xl)] shadow-[var(--shadow-3)] border border-[var(--border)]`
- Max width 560px default, with `size` prop (`sm`, `md`, `lg`)
- Close button as a ghost icon button in top-right

### 1.6 Skeleton (`src/components/ui/Skeleton.tsx`)

Replace shimmer. Use a subtle pulse:

```css
@keyframes pulse-soft {
  0%, 100% { background-color: var(--surface-2); }
  50%      { background-color: var(--surface-hover); }
}
.skeleton { animation: pulse-soft 1.6s ease-in-out infinite; }
```

Variants: `Skeleton.Card`, `Skeleton.Row`, `Skeleton.KPI`, `Skeleton.Chart`.

### 1.7 Toast (`src/components/ui/Toast.tsx`)

Bottom-right stack. Surface uses `--surface`, left border 4px in semantic color (`--success`, `--danger`, `--info`). No glass. Auto-dismiss after 4s.

### 1.8 New: `ThemeToggle.tsx`

Cycles through `light → dark → system → light`. Icon-only button (sun / moon / monitor) using `lucide-react`. Place in the topbar.

### 1.9 New: `Stat.tsx`

Reusable component for displaying a financial metric:
```tsx
<Stat label="Net Worth" value={120432.50} change={+2.3} format="currency" />
```
Renders label in `text-muted text-sm`, value in `text-3xl font-semibold tabular-nums`, change as a small badge below. This will be used in Dashboard and Analytics.

### 1.10 Chart theme (`src/components/charts/theme.ts`)

Update Recharts config to use new tokens:
- Grid: `var(--border)`
- Axis text: `var(--text-muted)` at 12px
- Tooltip: `bg-[var(--surface)] border-[var(--border)] rounded-[var(--radius-md)] shadow-[var(--shadow-2)]`
- Income series: `var(--success)`
- Expense series: `var(--danger)`
- Single-series default: `var(--accent)`
- Line stroke width: 2px (was probably thicker)
- Bar radius: 4px (subtle, not pronounced)

**Acceptance for Phase 1:**
- [ ] Every primitive renders identically in both themes (visual check)
- [ ] No component uses `backdrop-filter`
- [ ] Storybook-style review: render all variants on a single test page
- [ ] All inputs reach focus state correctly with keyboard
- [ ] Charts read clearly in both themes

---

## Phase 2 — Layout

### 2.1 Sidebar redesign (`src/components/Layout.tsx`)

**Before:** glass sidebar floating on gradient
**After:** opaque sidebar with hairline right border, fixed 240px wide

```tsx
<aside className="w-60 h-screen bg-[var(--surface)]
                  border-r border-[var(--border)]
                  flex flex-col">
  <header className="h-16 px-5 flex items-center
                     border-b border-[var(--border)]">
    <Logo />
  </header>
  <nav className="flex-1 px-3 py-4 space-y-0.5">
    {navItems.map(item => <NavLink ... />)}
  </nav>
  <footer className="p-3 border-t border-[var(--border)]">
    <UserMenu />
  </footer>
</aside>
```

Each nav item:
```tsx
h-9 px-3 rounded-[var(--radius-md)] text-sm font-medium
text-[var(--text-muted)]
hover:bg-[var(--surface-2)] hover:text-[var(--text)]
[active]: bg-[var(--accent-soft)] text-[var(--accent)]
icon-left, 16px lucide icon
```

### 2.2 Topbar (new — currently doesn't exist)

Add a 56px topbar above the page content area:
- Left: page title (`text-xl font-semibold`) + breadcrumb if applicable
- Right: `<DateRangeBar />`, `<ThemeToggle />`, `<UserAvatar />`
- Bottom border: 1px `--border`

### 2.3 Main content

```tsx
<main className="flex-1 overflow-y-auto">
  <Topbar />
  <div className="px-8 py-6 max-w-[1280px] mx-auto">
    <Outlet />
  </div>
</main>
```

Note the generous horizontal padding (`px-8`) and `max-w-[1280px]` for readability. Remove the previous full-bleed treatment.

### 2.4 Remove `QuickActions` FAB

The FAB with `rotate(45deg)` doesn't fit this design language. Replace with:
- An "Upload" button in the topbar
- An "Add transaction" button on the Transactions page

**Acceptance for Phase 2:**
- [ ] No floating action button anywhere
- [ ] Sidebar uses solid surface, not glass
- [ ] Active nav item is clearly identifiable in both themes
- [ ] Theme toggle is reachable and works from every page

---

## Phase 3 — Pages

For each page below, the agent should rewrite the JSX from scratch to match the brief. Keep all data-fetching hooks (`useAccounts`, `useTransactions`, etc.) intact.

### 3.1 DashboardPage

**Layout (top to bottom):**

1. **Hero net-worth block** (full width, ~200px tall)
   - Tiny label: `NET WORTH` in `text-xs uppercase tracking-wider text-muted`
   - Value: `text-6xl font-semibold tabular-nums` — currency formatted
   - Beneath: change pill (`+$2,431 this month` in success-soft badge)
   - Right side: a 60px-tall sparkline (last 90 days), stroke `--accent`, no axes, no fill

2. **KPI strip** — 4 cards in a CSS grid `grid-cols-4 gap-4`
   - Income (this month) | Expenses (this month) | Savings rate | Top category
   - Each card: white surface, 1px border, `text-sm` label + `text-2xl font-semibold` value
   - Remove `AnimatedCounter` — values render statically. (The animation was era-appropriate for glass; it doesn't fit warm minimalism.)

3. **Two-column section**
   - Left (2/3 width): Cash flow line chart (last 6 months income vs expense)
   - Right (1/3 width): Top categories list (5 rows, category name + horizontal bar + amount)

4. **Recent activity** — full width
   - 8 most recent transactions in a clean table (no card wrapper, just hairline rows)
   - Header row in `text-xs uppercase tracking-wider text-muted`

5. **Anomalies + Recurring** — two cards side by side, each lists 3-5 items.

**Spacing between sections:** `mt-12` (48px). Generous.

### 3.2 TransactionsPage

- Header: title left, `Add transaction` and `Export CSV` buttons right
- Filter bar below: search input, account select, category select, type select, date range — all on one line, `gap-3`
- Table:
  - No card wrapper
  - Hairline row separators (`border-b border-[var(--border)]`)
  - Month group headers as `text-sm font-medium text-muted` with a horizontal rule, top-margin
  - Columns: Date | Description | Category badge | Account | Amount (right-aligned, tabular)
  - Row hover: `bg-[var(--surface-2)]`
  - Row click: opens edit modal
- Bulk actions: when rows selected, a sticky footer appears at the bottom (not a floating bar) with `Delete selected` and `Categorize` actions
- Pagination: simple `Prev / Next + page indicator`, no infinite scroll

### 3.3 AnalyticsPage

- Three-section layout, each with a `text-xs uppercase tracking-wider text-muted` section label and a horizontal rule:
  1. **CATEGORY BREAKDOWN** — horizontal bars with category name on left, bar in `--accent` (or category color), value right. No donut chart on this page.
  2. **TOP MERCHANTS** — vertical list, top 10
  3. **HEALTH SCORE** — large number (e.g., `82/100`) at left, breakdown of contributing factors as a small list at right

### 3.4 AccountsPage

- Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`
- Each card: 200px tall, white surface
  - Bank logo / monogram in a 40px circle, top-left (color from `account.color`)
  - Account name in `text-lg font-semibold`
  - Account type subtitle in `text-sm text-muted`
  - Bottom: balance in `text-2xl tabular-nums`
  - Delete (ghost icon) in top-right
- "Add account" tile: same dimensions, dashed border `border-dashed border-[var(--border-strong)]`, centered `+` icon with label

### 3.5 BudgetsPage

- Each budget as a row in a single white card:
  - Top line: category name (left), spent/total (right, tabular)
  - Progress bar: 8px tall, rounded full, track `--surface-2`, fill `--accent` when under, `--danger` when over
  - Below: small `text-xs text-muted` line e.g., `12 days left in May`
- "Create budget" button at top-right of page

### 3.6 UploadPage

- Two-column on desktop:
  - Left (60%): drag-and-drop zone, 320px tall, `bg-[var(--surface)] border-2 border-dashed border-[var(--border-strong)] rounded-[var(--radius-xl)]`. On drag-over: border becomes `--accent`, background `--accent-soft`.
  - Right (40%): supported formats list and recent uploads
- Camera capture: a smaller secondary button "Capture receipt", opens existing `ReceiptCapture` modal (modal styling updated per Phase 1)

### 3.7 LoginPage / RegisterPage

- Centered single-column, max width 400px
- Logo at top
- Title in `text-2xl font-semibold`
- Inputs use the new `Input` primitive
- Primary button full-width
- Footer link in `text-sm text-muted`
- No glass card, no gradients. Plain `--surface` panel with hairline border.

**Acceptance for Phase 3:**
- [ ] No page contains a `backdrop-filter` rule
- [ ] All currency renders with `tabular-nums`
- [ ] Both themes are checked on every route
- [ ] No regression in functionality (data still loads, mutations still work, filters still apply)
- [ ] Mobile layouts collapse correctly (sidebar becomes a slide-over below `md`)

---

## Phase 4 — Polish

### 4.1 Loading states
Every page that fetches data shows the matching `Skeleton.*` variant during `isLoading`. No spinners on full pages — spinners only inline (e.g., button while submitting).

### 4.2 Empty states
For each list (transactions, anomalies, recurring, budgets, accounts, recent activity):
- Centered illustration or simple icon (lucide `Inbox` is fine)
- `text-base font-medium` headline
- `text-sm text-muted` description
- Primary action button if applicable

### 4.3 Error states
API errors render a small inline banner at the top of the affected component:
```tsx
<div className="bg-[var(--danger-soft)] text-[var(--danger)]
                border border-[var(--danger)] rounded-[var(--radius-md)]
                p-3 text-sm">
  Couldn't load data. <button className="underline">Try again</button>
</div>
```

### 4.4 Animations
- Modal: fade + 4px translate-y, 200ms ease-out
- Toast: slide in from right, 240ms
- Page transitions: none (kept instant for perceived speed)
- Hover transitions: 120ms on background-color only
- **Remove** all `scale(1.05)` and `rotate(...)` transforms

### 4.5 Accessibility checklist
- [ ] All interactive elements reachable by keyboard
- [ ] Focus rings visible in both themes (use `--ring-focus`)
- [ ] Color contrast ≥ 4.5:1 for body text in both themes (verify with axe DevTools)
- [ ] All buttons have accessible names (text or `aria-label`)
- [ ] Modal traps focus and restores it on close
- [ ] Form fields have associated labels

---

## Migration order (recommended for the coding agent)

Tackle in this exact order so the app stays runnable at every step:

1. **Phase 0** — tokens + theme infra. Commit. App will look ugly but functional.
2. **Phase 1** — primitives, one at a time (Button → Input → Card → Badge → Modal → Toast → Skeleton). Replace usages as each is built. Commit after each primitive.
3. **Phase 2** — layout shell (Sidebar + Topbar). Commit.
4. **Phase 3** — pages, in this order: Login → Dashboard → Transactions → Accounts → Budgets → Analytics → Upload. Commit after each.
5. **Phase 4** — polish pass across all pages.

---

## Files the agent will touch

**Rewrite:**
- `src/index.css` (full rewrite)
- `src/components/Layout.tsx` (full rewrite)
- `src/components/ui/Button.tsx`
- `src/components/ui/Card.tsx`
- `src/components/ui/Badge.tsx`
- `src/components/ui/Modal.tsx`
- `src/components/ui/Skeleton.tsx`
- `src/components/ui/Spinner.tsx`
- `src/components/ui/Toast.tsx`
- `src/components/ui/DateRangeBar.tsx`
- `src/components/charts/theme.ts`
- `src/components/charts/DonutChart.tsx`
- `src/components/charts/GroupedBarChart.tsx`
- `src/components/charts/HorizontalBars.tsx`
- `src/components/charts/SavingsLineChart.tsx`
- All 8 files in `src/pages/`

**Create:**
- `src/components/ui/Input.tsx`
- `src/components/ui/Stat.tsx`
- `src/components/ThemeToggle.tsx`
- `src/components/Topbar.tsx`
- `src/store/useThemeStore.ts`

**Delete:**
- `src/components/ui/AnimatedCounter.tsx` (no longer fits the design)
- `src/components/QuickActions.tsx` (FAB removed)

**Untouched:**
- All hooks (`src/hooks/`)
- All API code (`src/api/client.ts`)
- All types (`src/lib/types.ts`)
- All utils (`src/lib/utils.ts`)
- The auth store (`src/store/useAuthStore.ts`)
- `App.tsx` routing
- Backend, database, and design-system documentation files

---

## Verification & QA

Before declaring done, the agent should:

1. Run `npx tsc --noEmit` — must pass with zero errors
2. Run `npx vite build` — must build successfully
3. Visit every route in both themes, logged in and logged out
4. Toggle theme on each page; verify no flash and no missing variables
5. Check responsive behavior at 1440px, 1024px, 768px, 375px widths
6. Use Lighthouse accessibility audit — target ≥ 95
7. Search the codebase for `backdrop-filter`, `rgba(16,26,52`, `Plus Jakarta Sans`, `0F172A`, `9999px` (in button context), and confirm zero matches except where explicitly allowed (overlay backdrop blur, badge pill radius)

---

## Definition of done

- [ ] All four phases complete
- [ ] Light and dark themes both ship with no visual bugs
- [ ] Theme toggle persists and respects system preference
- [ ] No glassmorphism, no Plus Jakarta Sans, no FAB, no scale-1.05 hovers
- [ ] All TypeScript and build commands pass clean
- [ ] Lighthouse accessibility ≥ 95 on Dashboard, Transactions, and Login
- [ ] A side-by-side before/after screenshot is captured for each page

---

## Notes for the coding agent

- Tailwind v4 supports CSS variables natively via `@theme`. Prefer `bg-[var(--surface)]` arbitrary values over creating Tailwind utility classes for every token. This keeps the system flexible.
- When you hit ambiguity (a color, spacing, or pattern not specified here), favor: more whitespace, less color, larger type, fewer borders. The spirit is restraint.
- Never add a gradient unless explicitly asked. Never add a glass effect.
- All financial values must use tabular numerals.
- Accent color (`--accent`) is precious. Use it on primary buttons, the active nav item, key data highlights, and chart strokes — and almost nowhere else.
