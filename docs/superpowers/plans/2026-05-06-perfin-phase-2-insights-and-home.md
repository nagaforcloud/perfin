# Perfin — Phase 2: Insights & Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Perfin from "a bucket of categorized transactions" into "an app that *notices things* about your money." Recurring + anomaly detectors run on a nightly schedule; the Home page becomes a bento dashboard with a hero net-worth tile, KPI strip, today's AI insight, recent activity, and an inbox preview; the Insights feed surfaces every flagged anomaly, recurring series, monthly narrative, and category drift; the Inbox is the queue of items needing user attention; budgets render read-only with progress bars.

**Architecture:** Three new domain modules in `@perfin/core`: `recurring/` (cluster transactions by merchant + amount tolerance + cadence), `anomalies/` (threshold + statistical + rare-merchant detectors), `insights/` (orchestrator that turns the above + monthly narrative + category drift into `Insight` rows for the DB). The worker grows a `node-cron` scheduler that runs nightly at 02:00, plus a manual `POST /jobs/regenerate` endpoint for testing. The web app gets four new pages — bento Home (full rewrite of `/app`), Insights feed, Inbox, Budgets — and four new API routes. New shared UI primitives land in `@perfin/ui`: `Stat`, `Sparkline`, `AreaSparkline`, `AITile`. Monthly narrative uses Claude Sonnet 4.6 (one short prompt per user per month, prompt-cached).

**Tech Stack:** All Phase 1 stack plus: `node-cron` 3.0 · `recharts` 2.13 (KPI sparklines + heatmap; full chart library imported lazily on report routes in later phases) · Claude Sonnet 4.6 via existing `@anthropic-ai/sdk`.

**Phase 2 acceptance:**
1. After importing ≥30 days of data, the user lands on `/app` and sees: net-worth hero, 4 KPI tiles (income / expenses / savings rate / top category), one AI insight tile, 8 recent transactions, inbox count.
2. `/app/insights` shows tabs (All · Anomalies · Recurring · Trends) with at least one card from each detector once data is sufficient.
3. `/app/inbox` lists "Needs Review" transactions and unconfirmed anomalies; sidebar badge count matches.
4. `/app/budgets` renders any budgets created during onboarding/seed with month-to-date spend bars.
5. Manual `POST /jobs/regenerate` (HMAC-signed) regenerates insights and the page reflects updated content within 5 seconds.
6. `pnpm typecheck`, `pnpm test`, `pnpm build` clean. ≥ 30 new unit tests pass.
7. Playwright e2e: signup → upload sample CSV with 60+ days of data → run regenerate → see at least one insight on Home and one on Insights feed.
8. Tag `v0.3.0-phase2` on `main`.

---

## File Structure

```
perfin/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── recurring/
│   │   │   │   ├── types.ts                  # NEW
│   │   │   │   ├── detect.ts                 # NEW
│   │   │   │   └── cadence.ts                # NEW
│   │   │   ├── anomalies/
│   │   │   │   ├── types.ts                  # NEW
│   │   │   │   └── detect.ts                 # NEW
│   │   │   ├── insights/
│   │   │   │   ├── types.ts                  # NEW
│   │   │   │   ├── narrative.ts              # NEW (Claude)
│   │   │   │   ├── drift.ts                  # NEW
│   │   │   │   └── generate.ts               # NEW (orchestrator)
│   │   │   ├── budget/
│   │   │   │   └── status.ts                 # NEW
│   │   │   ├── home/
│   │   │   │   └── kpi.ts                    # NEW
│   │   │   └── index.ts                      # MODIFIED (re-exports)
│   │   └── tests/
│   │       ├── recurring.test.ts             # NEW
│   │       ├── anomalies.test.ts             # NEW
│   │       ├── narrative.test.ts             # NEW
│   │       ├── drift.test.ts                 # NEW
│   │       ├── budget-status.test.ts         # NEW
│   │       └── kpi.test.ts                   # NEW
│   └── ui/
│       ├── src/
│       │   └── components/
│       │       ├── Stat.tsx                  # NEW
│       │       ├── Sparkline.tsx             # NEW
│       │       ├── AreaSparkline.tsx         # NEW
│       │       └── AITile.tsx                # NEW
│       ├── tests/
│       │   └── components-phase2.test.tsx    # NEW
│       └── src/index.ts                      # MODIFIED
│
├── apps/
│   ├── worker/
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── scheduler.ts              # NEW (node-cron wrapper)
│   │   │   │   └── regenerate.ts             # NEW (orchestrates the nightly job)
│   │   │   ├── routes/
│   │   │   │   └── regenerate.ts             # NEW (HMAC POST trigger)
│   │   │   ├── server.ts                     # MODIFIED (register route + start cron)
│   │   │   └── env.ts                        # MODIFIED (CRON_DISABLED flag)
│   │   ├── tests/
│   │   │   ├── regenerate.test.ts            # NEW
│   │   │   └── scheduler.test.ts             # NEW
│   │   └── package.json                      # MODIFIED (node-cron)
│   └── web/
│       ├── app/
│       │   ├── (app)/
│       │   │   ├── page.tsx                  # REWRITE (bento Home)
│       │   │   ├── insights/page.tsx         # NEW
│       │   │   ├── inbox/page.tsx            # NEW
│       │   │   └── budgets/page.tsx          # NEW
│       │   └── api/
│       │       ├── home/route.ts             # NEW
│       │       ├── insights/
│       │       │   ├── route.ts              # NEW
│       │       │   └── [id]/route.ts         # NEW (PATCH snooze/dismiss)
│       │       ├── inbox/route.ts            # NEW
│       │       ├── budgets/
│       │       │   ├── route.ts              # NEW (GET budgets + status)
│       │       │   └── [id]/route.ts         # NEW (PATCH/DELETE — Phase 2 read-mostly; PATCH only for amount)
│       │       └── recurring/route.ts        # NEW
│       ├── components/
│       │   ├── home/
│       │   │   ├── HeroNetWorth.tsx          # NEW
│       │   │   ├── KpiStrip.tsx              # NEW
│       │   │   ├── TodayInsight.tsx          # NEW
│       │   │   ├── RecentActivity.tsx        # NEW
│       │   │   └── InboxPreview.tsx          # NEW
│       │   ├── insights/
│       │   │   ├── InsightCard.tsx           # NEW
│       │   │   ├── InsightTabs.tsx           # NEW
│       │   │   └── InsightFeed.tsx           # NEW
│       │   ├── inbox/
│       │   │   └── InboxList.tsx             # NEW
│       │   ├── budgets/
│       │   │   ├── BudgetRow.tsx             # NEW
│       │   │   └── BudgetsList.tsx           # NEW
│       │   └── Sidebar.tsx                   # MODIFIED (live inbox badge)
│       ├── hooks/
│       │   ├── useHome.ts                    # NEW
│       │   ├── useInsights.ts                # NEW
│       │   ├── useInbox.ts                   # NEW
│       │   ├── useBudgets.ts                 # NEW
│       │   └── useRecurring.ts               # NEW
│       └── tests/e2e/
│           └── insights-flow.spec.ts         # NEW
│
└── data/seeds/                               # NEW
    └── 60-day-sample.csv                     # NEW (e2e fixture)
```

Decomposition rules:
- `@perfin/core` modules are pure functions over arrays of `Transaction` (DB row shape from `@perfin/db`). They take input, return computed output. No DB writes inside core. The worker calls `core` then writes results.
- Web pages do their own data shaping in API routes; hooks just typed-fetch and cache.
- Each new component is < 100 lines and owns one rendering concern.

---

## Task 1: Recurring detection — types + cadence helpers

**Files:**
- Create: `packages/core/src/recurring/types.ts`
- Create: `packages/core/src/recurring/cadence.ts`
- Create: `packages/core/tests/recurring.test.ts` (cadence portion only)

- [ ] **Step 1: Write failing test**

Create `packages/core/tests/recurring.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { medianGap, classifyCadence } from '../src/recurring/cadence';

describe('medianGap', () => {
  it('returns median day gap between consecutive ISO dates', () => {
    expect(medianGap(['2026-01-01', '2026-02-01', '2026-03-01'])).toBe(30);
    expect(medianGap(['2026-01-01', '2026-01-08', '2026-01-15'])).toBe(7);
  });
  it('returns null when fewer than 2 dates', () => {
    expect(medianGap(['2026-01-01'])).toBeNull();
    expect(medianGap([])).toBeNull();
  });
});

describe('classifyCadence', () => {
  it('classifies weekly (5..9 days)', () => {
    expect(classifyCadence(7)).toBe('weekly');
  });
  it('classifies monthly (25..35 days)', () => {
    expect(classifyCadence(30)).toBe('monthly');
    expect(classifyCadence(31)).toBe('monthly');
  });
  it('classifies quarterly (85..95 days)', () => {
    expect(classifyCadence(90)).toBe('quarterly');
  });
  it('classifies annual (350..380 days)', () => {
    expect(classifyCadence(365)).toBe('annual');
  });
  it('returns null when noisy', () => {
    expect(classifyCadence(20)).toBeNull();
    expect(classifyCadence(60)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/core test
```
Expected: fails — module not found.

- [ ] **Step 3: Create `packages/core/src/recurring/types.ts`**

```ts
export type Cadence = 'weekly' | 'monthly' | 'quarterly' | 'annual';

export interface RecurringSeriesProposal {
  merchant: string;
  category: string;
  amountCents: number;       // median amount in series
  cadence: Cadence;
  occurrences: number;
  firstSeen: string;         // ISO date
  lastSeen: string;
  nextExpectedAt: string | null;
  confidence: number;        // 0..1
  transactionIds: number[];
}
```

- [ ] **Step 4: Create `packages/core/src/recurring/cadence.ts`**

```ts
import type { Cadence } from './types';

export function medianGap(isoDates: string[]): number | null {
  if (isoDates.length < 2) return null;
  const sorted = [...isoDates].sort();
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const a = Date.parse(sorted[i - 1]!);
    const b = Date.parse(sorted[i]!);
    gaps.push(Math.round((b - a) / (1000 * 60 * 60 * 24)));
  }
  gaps.sort((x, y) => x - y);
  const mid = Math.floor(gaps.length / 2);
  return gaps.length % 2 === 0 ? Math.round((gaps[mid - 1]! + gaps[mid]!) / 2) : gaps[mid]!;
}

export function classifyCadence(days: number): Cadence | null {
  if (days >= 5 && days <= 9)    return 'weekly';
  if (days >= 25 && days <= 35)  return 'monthly';
  if (days >= 85 && days <= 95)  return 'quarterly';
  if (days >= 350 && days <= 380) return 'annual';
  return null;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 5: Run test (expect pass)**

Run:
```bash
pnpm --filter @perfin/core test
```
Expected: 7 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core
git commit -m "feat(core): recurring cadence helpers (medianGap, classifyCadence)"
```

---

## Task 2: Recurring detection — clustering algorithm

**Files:**
- Create: `packages/core/src/recurring/detect.ts`
- Modify: `packages/core/tests/recurring.test.ts`

- [ ] **Step 1: Append failing test**

Append to `packages/core/tests/recurring.test.ts`:

```ts
import { detectRecurring, type DetectInput } from '../src/recurring/detect';

const month = (mm: string, day = '15') => `2026-${mm}-${day}`;

const txns = (overrides: Partial<DetectInput['transactions'][number]>[]) =>
  overrides.map((o, i) => ({
    id: i + 1,
    description: 'X',
    amountCents: -1000,
    date: '2026-01-01',
    category: 'Subscription',
    ...o,
  }));

describe('detectRecurring', () => {
  it('finds a 3-month Spotify series with high confidence', () => {
    const input: DetectInput = {
      transactions: txns([
        { description: 'SPOTIFY', amountCents: -1099, date: month('01') },
        { description: 'SPOTIFY', amountCents: -1099, date: month('02') },
        { description: 'SPOTIFY', amountCents: -1099, date: month('03') },
      ]),
      amountTolerance: 0.15,
    };
    const series = detectRecurring(input);
    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({
      merchant: 'spotify',
      cadence: 'monthly',
      occurrences: 3,
      amountCents: -1099,
    });
    expect(series[0]?.confidence).toBeGreaterThan(0.7);
  });

  it('tolerates ±15% amount variation', () => {
    const input: DetectInput = {
      transactions: txns([
        { description: 'JIO MOBILE', amountCents: -29900, date: month('01') },
        { description: 'JIO MOBILE', amountCents: -32000, date: month('02') },
        { description: 'JIO MOBILE', amountCents: -29500, date: month('03') },
      ]),
      amountTolerance: 0.15,
    };
    const series = detectRecurring(input);
    expect(series).toHaveLength(1);
    expect(series[0]?.merchant).toBe('jio mobile');
  });

  it('skips clusters below minOccurrences', () => {
    const input: DetectInput = {
      transactions: txns([
        { description: 'SPOTIFY', amountCents: -1099, date: month('01') },
        { description: 'SPOTIFY', amountCents: -1099, date: month('02') },
      ]),
      amountTolerance: 0.15,
      minOccurrences: 3,
    };
    expect(detectRecurring(input)).toHaveLength(0);
  });

  it('does not merge merchants that differ', () => {
    const input: DetectInput = {
      transactions: txns([
        { description: 'NETFLIX', amountCents: -1499, date: month('01') },
        { description: 'NETFLIX', amountCents: -1499, date: month('02') },
        { description: 'NETFLIX', amountCents: -1499, date: month('03') },
        { description: 'SPOTIFY', amountCents: -1099, date: month('01') },
        { description: 'SPOTIFY', amountCents: -1099, date: month('02') },
        { description: 'SPOTIFY', amountCents: -1099, date: month('03') },
      ]),
      amountTolerance: 0.15,
    };
    const series = detectRecurring(input).map((s) => s.merchant).sort();
    expect(series).toEqual(['netflix', 'spotify']);
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/core test
```
Expected: fails — `detectRecurring` does not exist.

- [ ] **Step 3: Create `packages/core/src/recurring/detect.ts`**

```ts
import { addDays, classifyCadence, medianGap } from './cadence';
import type { RecurringSeriesProposal } from './types';

export interface DetectInput {
  transactions: Array<{
    id: number;
    description: string;
    amountCents: number;
    date: string;
    category: string;
  }>;
  amountTolerance?: number;   // default 0.15
  minOccurrences?: number;    // default 3
}

function merchantKey(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 2)
    .join(' ');
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export function detectRecurring(input: DetectInput): RecurringSeriesProposal[] {
  const tolerance = input.amountTolerance ?? 0.15;
  const minOccurrences = input.minOccurrences ?? 3;

  const groups = new Map<string, DetectInput['transactions']>();
  for (const t of input.transactions) {
    if (t.amountCents >= 0) continue; // skip income
    const key = merchantKey(t.description);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }

  const series: RecurringSeriesProposal[] = [];
  for (const [key, group] of groups) {
    if (group.length < minOccurrences) continue;
    const med = median(group.map((g) => Math.abs(g.amountCents)));
    const inTolerance = group.filter((g) => Math.abs(Math.abs(g.amountCents) - med) / med <= tolerance);
    if (inTolerance.length < minOccurrences) continue;

    const dates = inTolerance.map((g) => g.date).sort();
    const gap = medianGap(dates);
    const cadence = gap == null ? null : classifyCadence(gap);
    if (!cadence) continue;

    const lastSeen = dates[dates.length - 1]!;
    const expectedDays = { weekly: 7, monthly: 30, quarterly: 90, annual: 365 }[cadence];

    const dateConsistency = inTolerance.length / group.length;
    const amountStdRatio = stdRatio(inTolerance.map((g) => Math.abs(g.amountCents)), med);
    const confidence = Math.min(1, 0.5 + 0.3 * dateConsistency + 0.2 * (1 - amountStdRatio));

    series.push({
      merchant: key,
      category: inTolerance[0]!.category,
      amountCents: -Math.round(med),
      cadence,
      occurrences: inTolerance.length,
      firstSeen: dates[0]!,
      lastSeen,
      nextExpectedAt: addDays(lastSeen, expectedDays),
      confidence,
      transactionIds: inTolerance.map((g) => g.id),
    });
  }
  return series.sort((a, b) => b.confidence - a.confidence);
}

function stdRatio(values: number[], mean: number): number {
  if (mean === 0 || values.length < 2) return 0;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}
```

- [ ] **Step 4: Run test (expect pass)**

Run:
```bash
pnpm --filter @perfin/core test
```
Expected: 4 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): recurring detection — merchant clustering + cadence + confidence"
```

---

## Task 3: Anomaly detection

**Files:**
- Create: `packages/core/src/anomalies/types.ts`
- Create: `packages/core/src/anomalies/detect.ts`
- Create: `packages/core/tests/anomalies.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/core/tests/anomalies.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { detectAnomalies } from '../src/anomalies/detect';

const txn = (id: number, amount: number, description: string, date = '2026-04-15') => ({
  id, amountCents: Math.round(amount * 100), description, date, category: 'Shopping',
});

describe('detectAnomalies', () => {
  it('flags a transaction 4× larger than category median', () => {
    const txns = [
      ...Array.from({ length: 10 }, (_, i) => txn(i, -100 - i, 'Coffee')),
      txn(99, -2000, 'Apple Store'),
    ];
    const out = detectAnomalies({ transactions: txns });
    const apple = out.find((a) => a.transactionId === 99);
    expect(apple).toBeDefined();
    expect(apple?.kind).toBe('large_amount');
    expect(apple?.score).toBeGreaterThan(0.7);
  });

  it('does not flag normal-sized transactions', () => {
    const txns = Array.from({ length: 10 }, (_, i) => txn(i, -100, 'Coffee'));
    expect(detectAnomalies({ transactions: txns })).toHaveLength(0);
  });

  it('flags a brand-new merchant when amount is large', () => {
    const txns = [
      ...Array.from({ length: 30 }, (_, i) => txn(i, -200, 'Whole Foods', '2026-03-01')),
      txn(99, -1500, 'Mystery Vendor LLC', '2026-04-15'),
    ];
    const out = detectAnomalies({ transactions: txns });
    const flagged = out.find((a) => a.transactionId === 99);
    expect(flagged?.kind).toMatch(/^(rare_merchant|large_amount)$/);
  });

  it('skips income', () => {
    const txns = [
      ...Array.from({ length: 5 }, (_, i) => txn(i, -100, 'X')),
      txn(99, 50000, 'Salary'),
    ];
    expect(detectAnomalies({ transactions: txns }).find((a) => a.transactionId === 99)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/core test
```
Expected: fails.

- [ ] **Step 3: Create `packages/core/src/anomalies/types.ts`**

```ts
export type AnomalyKind = 'large_amount' | 'rare_merchant' | 'category_outlier' | 'duplicate_suspect';

export interface AnomalyProposal {
  transactionId: number;
  kind: AnomalyKind;
  score: number;     // 0..1
  reason: string;
}
```

- [ ] **Step 4: Create `packages/core/src/anomalies/detect.ts`**

```ts
import type { AnomalyProposal } from './types';

export interface AnomalyInput {
  transactions: Array<{
    id: number;
    amountCents: number;
    description: string;
    date: string;
    category: string;
  }>;
  hardLargeThresholdCents?: number;   // default 5_00_000 (₹5,000 / $5,000)
  outlierMultiplier?: number;          // default 4×
  rareMerchantMinAmount?: number;      // cents threshold for rare-merchant flag
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function merchantKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 2).join(' ');
}

export function detectAnomalies(input: AnomalyInput): AnomalyProposal[] {
  const out: AnomalyProposal[] = [];
  const expenses = input.transactions.filter((t) => t.amountCents < 0);
  if (!expenses.length) return out;

  const hard = input.hardLargeThresholdCents ?? 5_00_000;
  const mult = input.outlierMultiplier ?? 4;
  const rareMin = input.rareMerchantMinAmount ?? 1_00_000;

  // Per-category median
  const byCategory = new Map<string, number[]>();
  for (const t of expenses) {
    const list = byCategory.get(t.category) ?? [];
    list.push(Math.abs(t.amountCents));
    byCategory.set(t.category, list);
  }
  const medianByCategory = new Map<string, number>();
  for (const [cat, vals] of byCategory) medianByCategory.set(cat, median(vals));

  // Merchant frequency
  const merchantCounts = new Map<string, number>();
  for (const t of expenses) {
    const k = merchantKey(t.description);
    merchantCounts.set(k, (merchantCounts.get(k) ?? 0) + 1);
  }

  for (const t of expenses) {
    const amt = Math.abs(t.amountCents);
    const med = medianByCategory.get(t.category) ?? 0;
    if (amt >= hard) {
      out.push({
        transactionId: t.id,
        kind: 'large_amount',
        score: Math.min(1, amt / (hard * 4)),
        reason: `Amount ${(amt / 100).toFixed(2)} crosses the large-transaction threshold.`,
      });
      continue;
    }
    if (med > 0 && amt >= med * mult) {
      out.push({
        transactionId: t.id,
        kind: 'large_amount',
        score: Math.min(1, amt / (med * mult * 2)),
        reason: `${(amt / 100).toFixed(2)} is ${(amt / med).toFixed(1)}× the typical ${t.category} amount.`,
      });
      continue;
    }
    const mk = merchantKey(t.description);
    if (mk && (merchantCounts.get(mk) ?? 0) <= 1 && amt >= rareMin) {
      out.push({
        transactionId: t.id,
        kind: 'rare_merchant',
        score: 0.6,
        reason: `First transaction with "${t.description}" and amount is unusually large.`,
      });
    }
  }
  return out;
}
```

- [ ] **Step 5: Run test (expect pass)**

Run:
```bash
pnpm --filter @perfin/core test
```
Expected: 4 new tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core
git commit -m "feat(core): anomaly detection (large amount, category outlier, rare merchant)"
```

---

## Task 4: Category drift detector

**Files:**
- Create: `packages/core/src/insights/drift.ts`
- Create: `packages/core/tests/drift.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/core/tests/drift.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { detectCategoryDrift } from '../src/insights/drift';

const t = (date: string, category: string, amount: number) => ({
  date, category, amountCents: Math.round(amount * 100), id: 0, description: 'X',
});

describe('detectCategoryDrift', () => {
  it('flags a 50% jump month-over-month', () => {
    const txns = [
      ...Array.from({ length: 10 }, () => t('2026-03-15', 'Dining', -100)),
      ...Array.from({ length: 16 }, () => t('2026-04-15', 'Dining', -100)),
    ];
    const out = detectCategoryDrift({ transactions: txns, currentMonth: '2026-04' });
    const dining = out.find((d) => d.category === 'Dining');
    expect(dining?.changePct).toBeGreaterThanOrEqual(50);
  });

  it('does not flag <20% changes', () => {
    const txns = [
      ...Array.from({ length: 10 }, () => t('2026-03-15', 'Dining', -100)),
      ...Array.from({ length: 11 }, () => t('2026-04-15', 'Dining', -100)),
    ];
    const out = detectCategoryDrift({ transactions: txns, currentMonth: '2026-04' });
    expect(out.find((d) => d.category === 'Dining')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/core test
```
Expected: fails.

- [ ] **Step 3: Create `packages/core/src/insights/drift.ts`**

```ts
export interface DriftInput {
  transactions: Array<{ id: number; date: string; category: string; amountCents: number; description: string }>;
  currentMonth: string;     // 'YYYY-MM'
  thresholdPct?: number;    // default 20
}

export interface DriftResult {
  category: string;
  currentSpendCents: number;
  previousSpendCents: number;
  changePct: number;        // +50 means +50%
}

function prevMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

export function detectCategoryDrift(input: DriftInput): DriftResult[] {
  const threshold = input.thresholdPct ?? 20;
  const prev = prevMonth(input.currentMonth);

  const cur = new Map<string, number>();
  const old = new Map<string, number>();
  for (const t of input.transactions) {
    if (t.amountCents >= 0) continue;
    const ym = t.date.slice(0, 7);
    const target = ym === input.currentMonth ? cur : ym === prev ? old : null;
    if (!target) continue;
    target.set(t.category, (target.get(t.category) ?? 0) + Math.abs(t.amountCents));
  }

  const results: DriftResult[] = [];
  for (const [cat, curAmt] of cur) {
    const prevAmt = old.get(cat) ?? 0;
    if (prevAmt === 0) continue;
    const changePct = ((curAmt - prevAmt) / prevAmt) * 100;
    if (Math.abs(changePct) >= threshold) {
      results.push({ category: cat, currentSpendCents: curAmt, previousSpendCents: prevAmt, changePct });
    }
  }
  return results.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
}
```

- [ ] **Step 4: Run test (expect pass)**

Run:
```bash
pnpm --filter @perfin/core test
```
Expected: 2 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): category drift detector (MoM with configurable threshold)"
```

---

## Task 5: Monthly narrative (Claude Sonnet 4.6)

**Files:**
- Create: `packages/core/src/insights/narrative.ts`
- Create: `packages/core/tests/narrative.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/core/tests/narrative.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { __test as nt } from '../src/insights/narrative';

describe('narrative summariser', () => {
  it('builds a deterministic stat block from txns', () => {
    const block = nt.buildStatBlock({
      currentMonth: '2026-04',
      transactions: [
        { id: 1, date: '2026-04-15', category: 'Income', amountCents: 800000, description: 'salary' },
        { id: 2, date: '2026-04-16', category: 'Food', amountCents: -50000, description: 'swiggy' },
        { id: 3, date: '2026-04-17', category: 'Rent', amountCents: -300000, description: 'rent' },
      ],
    });
    expect(block.income).toBe(800000);
    expect(block.expenses).toBe(350000);
    expect(block.savings).toBe(450000);
    expect(block.savingsRate).toBe(0.5625);
    expect(block.topCategory).toBe('Rent');
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/core test
```
Expected: fails.

- [ ] **Step 3: Create `packages/core/src/insights/narrative.ts`**

```ts
import Anthropic from '@anthropic-ai/sdk';

export interface NarrativeInput {
  currentMonth: string;
  transactions: Array<{ id: number; date: string; category: string; amountCents: number; description: string }>;
}

export interface StatBlock {
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number;
  topCategory: string;
}

function buildStatBlock(input: NarrativeInput): StatBlock {
  const ym = input.currentMonth;
  let income = 0;
  let expenses = 0;
  const byCategory = new Map<string, number>();
  for (const t of input.transactions) {
    if (!t.date.startsWith(ym)) continue;
    if (t.amountCents > 0) income += t.amountCents;
    else {
      expenses += Math.abs(t.amountCents);
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + Math.abs(t.amountCents));
    }
  }
  const savings = income - expenses;
  const savingsRate = income > 0 ? savings / income : 0;
  const topCategory = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Other';
  return { income, expenses, savings, savingsRate, topCategory };
}

const SYSTEM = [
  'You write a one-paragraph monthly summary for a personal-finance app.',
  'Tone: warm, factual, never preachy. 50-80 words.',
  'Use the provided numbers exactly. Format money as locale-aware strings the caller already provides — do not reinvent currency.',
  'No bullet points. No markdown. Plain prose.',
].join('\n');

export interface NarrativeOptions {
  apiKey: string;
  model?: string;
  currency: string;
  formatCurrency: (cents: number) => string;
}

export interface Narrative {
  headline: string;
  body: string;
  stats: StatBlock;
}

export async function generateNarrative(
  input: NarrativeInput,
  opts: NarrativeOptions,
): Promise<Narrative> {
  const stats = buildStatBlock(input);
  const client = new Anthropic({ apiKey: opts.apiKey });
  const prompt = [
    `Month: ${input.currentMonth}`,
    `Income: ${opts.formatCurrency(stats.income)}`,
    `Expenses: ${opts.formatCurrency(stats.expenses)}`,
    `Saved: ${opts.formatCurrency(stats.savings)} (${(stats.savingsRate * 100).toFixed(0)}%)`,
    `Top spending category: ${stats.topCategory}`,
    `Currency: ${opts.currency}`,
  ].join('\n');

  const resp = await client.messages.create({
    model: opts.model ?? 'claude-sonnet-4-6',
    max_tokens: 320,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: prompt }],
  });
  const body = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  return {
    headline: `Your ${input.currentMonth}`,
    body,
    stats,
  };
}

export const __test = { buildStatBlock };
```

- [ ] **Step 4: Run test (expect pass)**

Run:
```bash
pnpm --filter @perfin/core test
```
Expected: 1 new test passes (the live-API path is exercised at the worker layer with a feature flag).

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): monthly narrative generator (Claude Sonnet 4.6 + stat block)"
```

---

## Task 6: Insights orchestrator + budget status + KPI

**Files:**
- Create: `packages/core/src/insights/types.ts`
- Create: `packages/core/src/insights/generate.ts`
- Create: `packages/core/src/budget/status.ts`
- Create: `packages/core/src/home/kpi.ts`
- Create: `packages/core/tests/budget-status.test.ts`
- Create: `packages/core/tests/kpi.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Create `packages/core/src/insights/types.ts`**

```ts
export type InsightKind =
  | 'anomaly'
  | 'recurring_detected'
  | 'category_drift'
  | 'monthly_narrative';

export interface InsightProposal {
  kind: InsightKind;
  headline: string;
  body: string;
  payload: Record<string, unknown>;
  confidence: number;
  surface: 'home' | 'insights';
}
```

- [ ] **Step 2: Create `packages/core/src/insights/generate.ts`**

```ts
import { detectAnomalies } from '../anomalies/detect';
import { detectRecurring } from '../recurring/detect';
import { detectCategoryDrift } from './drift';
import type { InsightProposal } from './types';

export interface GenerateInput {
  transactions: Array<{
    id: number;
    date: string;
    description: string;
    amountCents: number;
    category: string;
  }>;
  currentMonth: string;
  formatCurrency: (cents: number) => string;
  monthlyNarrative?: { headline: string; body: string };  // optional, callers fetch from Claude
}

export function generateInsightProposals(input: GenerateInput): InsightProposal[] {
  const out: InsightProposal[] = [];

  for (const a of detectAnomalies({ transactions: input.transactions })) {
    out.push({
      kind: 'anomaly',
      headline: `Unusual transaction flagged`,
      body: a.reason,
      payload: { transactionId: a.transactionId, anomalyKind: a.kind },
      confidence: a.score,
      surface: a.score >= 0.85 ? 'home' : 'insights',
    });
  }

  for (const r of detectRecurring({ transactions: input.transactions })) {
    out.push({
      kind: 'recurring_detected',
      headline: `${r.merchant} appears ${r.cadence}`,
      body: `${r.occurrences} charges around ${input.formatCurrency(r.amountCents)} since ${r.firstSeen}.`,
      payload: { merchant: r.merchant, cadence: r.cadence, amountCents: r.amountCents, transactionIds: r.transactionIds },
      confidence: r.confidence,
      surface: 'insights',
    });
  }

  for (const d of detectCategoryDrift({ transactions: input.transactions, currentMonth: input.currentMonth })) {
    const direction = d.changePct >= 0 ? 'up' : 'down';
    out.push({
      kind: 'category_drift',
      headline: `${d.category} is ${direction} ${Math.abs(d.changePct).toFixed(0)}% this month`,
      body: `${input.formatCurrency(d.currentSpendCents)} this month vs ${input.formatCurrency(d.previousSpendCents)} last month.`,
      payload: { category: d.category, changePct: d.changePct },
      confidence: Math.min(1, Math.abs(d.changePct) / 100),
      surface: Math.abs(d.changePct) >= 50 ? 'home' : 'insights',
    });
  }

  if (input.monthlyNarrative) {
    out.push({
      kind: 'monthly_narrative',
      headline: input.monthlyNarrative.headline,
      body: input.monthlyNarrative.body,
      payload: {},
      confidence: 1,
      surface: 'insights',
    });
  }

  return out.sort((a, b) => b.confidence - a.confidence);
}
```

- [ ] **Step 3: Create `packages/core/src/budget/status.ts` + test**

Test (`packages/core/tests/budget-status.test.ts`):

```ts
import { describe, expect, it } from 'vitest';
import { computeBudgetStatus } from '../src/budget/status';

const t = (date: string, category: string, amount: number) => ({
  date, category, amountCents: Math.round(amount * 100), id: 0, description: 'X',
});

describe('computeBudgetStatus', () => {
  it('returns spent/budget/remaining/percent for the current month', () => {
    const out = computeBudgetStatus({
      budgets: [{ id: 1, category: 'Dining', amountCents: 100000 }],
      transactions: [
        t('2026-04-01', 'Dining', -300),
        t('2026-04-02', 'Dining', -400),
        t('2026-03-15', 'Dining', -1000),  // last month, ignored
      ],
      currentMonth: '2026-04',
    });
    expect(out[0]).toMatchObject({
      category: 'Dining',
      budgetCents: 100000,
      spentCents: 70000,
      remainingCents: 30000,
      percent: 70,
    });
  });
});
```

Implementation (`packages/core/src/budget/status.ts`):

```ts
export interface BudgetStatusInput {
  budgets: Array<{ id: number; category: string; amountCents: number }>;
  transactions: Array<{ date: string; category: string; amountCents: number }>;
  currentMonth: string;       // YYYY-MM
}

export interface BudgetStatus {
  budgetId: number;
  category: string;
  budgetCents: number;
  spentCents: number;
  remainingCents: number;
  percent: number;
}

export function computeBudgetStatus(input: BudgetStatusInput): BudgetStatus[] {
  const ym = input.currentMonth;
  const spent = new Map<string, number>();
  for (const t of input.transactions) {
    if (t.amountCents >= 0) continue;
    if (!t.date.startsWith(ym)) continue;
    spent.set(t.category, (spent.get(t.category) ?? 0) + Math.abs(t.amountCents));
  }
  return input.budgets.map((b) => {
    const spentCents = spent.get(b.category) ?? 0;
    return {
      budgetId: b.id,
      category: b.category,
      budgetCents: b.amountCents,
      spentCents,
      remainingCents: b.amountCents - spentCents,
      percent: b.amountCents > 0 ? Math.round((spentCents / b.amountCents) * 100) : 0,
    };
  });
}
```

- [ ] **Step 4: Create `packages/core/src/home/kpi.ts` + test**

Test (`packages/core/tests/kpi.test.ts`):

```ts
import { describe, expect, it } from 'vitest';
import { computeKpis } from '../src/home/kpi';

const t = (date: string, category: string, amount: number) => ({
  date, category, amountCents: Math.round(amount * 100), id: 0, description: 'X',
});

describe('computeKpis', () => {
  it('aggregates income, expenses, savings rate, top category', () => {
    const k = computeKpis({
      transactions: [
        t('2026-04-01', 'Income', 8000),
        t('2026-04-02', 'Food',   -500),
        t('2026-04-03', 'Rent',   -3000),
      ],
      currentMonth: '2026-04',
    });
    expect(k.incomeCents).toBe(800000);
    expect(k.expensesCents).toBe(350000);
    expect(k.savingsRate).toBeCloseTo(0.5625, 4);
    expect(k.topCategory.name).toBe('Rent');
    expect(k.topCategory.spendCents).toBe(300000);
  });

  it('returns zeros when month has no data', () => {
    const k = computeKpis({ transactions: [], currentMonth: '2026-04' });
    expect(k.incomeCents).toBe(0);
    expect(k.expensesCents).toBe(0);
    expect(k.savingsRate).toBe(0);
    expect(k.topCategory.name).toBe('—');
  });
});
```

Implementation (`packages/core/src/home/kpi.ts`):

```ts
export interface KpiInput {
  transactions: Array<{ date: string; category: string; amountCents: number }>;
  currentMonth: string;        // YYYY-MM
}

export interface Kpis {
  incomeCents: number;
  expensesCents: number;
  savingsRate: number;
  topCategory: { name: string; spendCents: number };
}

export function computeKpis(input: KpiInput): Kpis {
  let income = 0;
  let expenses = 0;
  const byCat = new Map<string, number>();
  for (const t of input.transactions) {
    if (!t.date.startsWith(input.currentMonth)) continue;
    if (t.amountCents > 0) income += t.amountCents;
    else {
      const a = Math.abs(t.amountCents);
      expenses += a;
      byCat.set(t.category, (byCat.get(t.category) ?? 0) + a);
    }
  }
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    incomeCents: income,
    expensesCents: expenses,
    savingsRate: income > 0 ? (income - expenses) / income : 0,
    topCategory: top ? { name: top[0], spendCents: top[1] } : { name: '—', spendCents: 0 },
  };
}
```

- [ ] **Step 5: Update `packages/core/src/index.ts`**

Append exports:

```ts
export * from './recurring/types';
export * from './recurring/detect';
export * from './recurring/cadence';
export * from './anomalies/types';
export * from './anomalies/detect';
export * from './insights/types';
export * from './insights/drift';
export * from './insights/narrative';
export * from './insights/generate';
export * from './budget/status';
export * from './home/kpi';
```

- [ ] **Step 6: Run tests (expect pass)**

Run:
```bash
pnpm --filter @perfin/core test
```
Expected: all tests pass; new ones from this task included.

- [ ] **Step 7: Commit**

```bash
git add packages/core
git commit -m "feat(core): insights generator + budget status + KPI helpers"
```

---

## Task 7: UI primitives — Stat, Sparkline, AreaSparkline, AITile

**Files:**
- Create: `packages/ui/src/components/Stat.tsx`
- Create: `packages/ui/src/components/Sparkline.tsx`
- Create: `packages/ui/src/components/AreaSparkline.tsx`
- Create: `packages/ui/src/components/AITile.tsx`
- Create: `packages/ui/tests/components-phase2.test.tsx`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: Write failing test**

Create `packages/ui/tests/components-phase2.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Stat, Sparkline, AreaSparkline, AITile } from '../src/index';

describe('Stat', () => {
  it('renders label and value', () => {
    render(<Stat label="INCOME" value="$8,240" />);
    expect(screen.getByText('INCOME')).toBeInTheDocument();
    expect(screen.getByText('$8,240')).toBeInTheDocument();
  });
  it('renders delta when provided', () => {
    render(<Stat label="X" value="$1" deltaText="+4.2%" deltaTone="income" />);
    expect(screen.getByText('+4.2%')).toBeInTheDocument();
  });
});

describe('Sparkline', () => {
  it('renders an SVG of the right dimensions', () => {
    render(<Sparkline data-testid="s" values={[1, 2, 3, 4]} />);
    const svg = screen.getByTestId('s');
    expect(svg.tagName).toBe('svg');
    expect(svg.getAttribute('viewBox')).toMatch(/0 0 \d+ \d+/);
  });
});

describe('AreaSparkline', () => {
  it('renders polyline + filled polygon', () => {
    render(<AreaSparkline data-testid="a" values={[1, 2, 3]} />);
    const svg = screen.getByTestId('a');
    expect(svg.querySelector('polyline')).toBeTruthy();
    expect(svg.querySelector('polygon')).toBeTruthy();
  });
});

describe('AITile', () => {
  it('renders headline + body + actions', () => {
    render(
      <AITile headline="Today's insight" body="Things look good." actions={<button>OK</button>} />,
    );
    expect(screen.getByText("Today's insight")).toBeInTheDocument();
    expect(screen.getByText('Things look good.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/ui test
```
Expected: fails — components don't exist.

- [ ] **Step 3: Create `packages/ui/src/components/Stat.tsx`**

```tsx
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface StatProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: ReactNode;
  deltaText?: string;
  deltaTone?: 'income' | 'expense' | 'neutral';
}

const toneClass = {
  income: 'bg-positive-soft text-positive',
  expense: 'bg-negative-soft text-negative',
  neutral: 'bg-surface-3 text-text-muted',
} as const;

export function Stat({ label, value, deltaText, deltaTone = 'neutral', className, ...rest }: StatProps) {
  return (
    <div className={cn('p-4 rounded-lg bg-surface border border-border', className)} {...rest}>
      <div className="text-xs uppercase tracking-wider text-text-subtle font-semibold">{label}</div>
      <div className="text-2xl font-mono font-semibold mt-1">{value}</div>
      {deltaText && (
        <div className={cn('inline-flex items-center px-2 h-5 rounded-full text-xs font-semibold mt-2', toneClass[deltaTone])}>
          {deltaText}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `packages/ui/src/components/Sparkline.tsx`**

```tsx
import type { SVGProps } from 'react';

export interface SparklineProps extends SVGProps<SVGSVGElement> {
  values: number[];
  height?: number;
  width?: number;
  stroke?: string;
}

export function Sparkline({ values, height = 30, width = 200, stroke = 'var(--accent)', ...rest }: SparklineProps) {
  if (!values.length) return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} {...rest} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / Math.max(1, values.length - 1);
  const points = values
    .map((v, i) => `${i * stepX},${height - ((v - min) / range) * height}`)
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" {...rest}>
      <polyline fill="none" stroke={stroke} strokeWidth={2} points={points} />
    </svg>
  );
}
```

- [ ] **Step 5: Create `packages/ui/src/components/AreaSparkline.tsx`**

```tsx
import type { SVGProps } from 'react';

export interface AreaSparklineProps extends SVGProps<SVGSVGElement> {
  values: number[];
  height?: number;
  width?: number;
  stroke?: string;
}

export function AreaSparkline({ values, height = 60, width = 400, stroke = 'var(--positive)', ...rest }: AreaSparklineProps) {
  if (values.length < 2) return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} {...rest} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const pts = values.map((v, i) => `${i * stepX},${height - ((v - min) / range) * height}`).join(' ');
  const polyId = `area-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" {...rest}>
      <defs>
        <linearGradient id={polyId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={stroke} strokeWidth={2} points={pts} />
      <polygon fill={`url(#${polyId})`} points={`${pts} ${width},${height} 0,${height}`} />
    </svg>
  );
}
```

- [ ] **Step 6: Create `packages/ui/src/components/AITile.tsx`**

```tsx
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface AITileProps {
  headline: string;
  body: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function AITile({ headline, body, actions, className }: AITileProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg p-4',
        'border border-[var(--accent-soft)]',
        'bg-[linear-gradient(135deg,rgba(99,102,241,0.10)_0%,rgba(99,102,241,0.02)_100%)]',
        className,
      )}
    >
      <div className="text-xs uppercase tracking-wider font-semibold text-accent">⚡ {headline}</div>
      <div className="mt-2 text-text">{body}</div>
      {actions && <div className="mt-3 flex gap-2">{actions}</div>}
    </div>
  );
}
```

- [ ] **Step 7: Update `packages/ui/src/index.ts`** — append:

```ts
export { Stat, type StatProps } from './components/Stat';
export { Sparkline, type SparklineProps } from './components/Sparkline';
export { AreaSparkline, type AreaSparklineProps } from './components/AreaSparkline';
export { AITile, type AITileProps } from './components/AITile';
```

- [ ] **Step 8: Run test (expect pass)**

Run:
```bash
pnpm --filter @perfin/ui test
```
Expected: 6 new tests pass.

- [ ] **Step 9: Commit**

```bash
git add packages/ui
git commit -m "feat(ui): Stat / Sparkline / AreaSparkline / AITile primitives"
```

---

## Task 8: Worker — node-cron scheduler + regenerate orchestrator

**Files:**
- Modify: `apps/worker/package.json` (add `node-cron`)
- Modify: `apps/worker/src/env.ts` (add `CRON_DISABLED`, `CRON_NIGHTLY`)
- Create: `apps/worker/src/lib/scheduler.ts`
- Create: `apps/worker/src/lib/regenerate.ts`
- Create: `apps/worker/tests/scheduler.test.ts`
- Create: `apps/worker/tests/regenerate.test.ts`

- [ ] **Step 1: Add `node-cron` to worker**

Edit `apps/worker/package.json` dependencies — add:

```json
"node-cron": "3.0.3",
"@types/node-cron": "3.0.11"
```

Run:
```bash
pnpm install
```

- [ ] **Step 2: Update `apps/worker/src/env.ts`**

Replace contents:

```ts
import { z } from 'zod';
import { resolve } from 'node:path';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  WORKER_PORT: z.coerce.number().int().positive().default(8001),
  WORKER_HMAC_SECRET: z.string().min(8),
  UPLOAD_DIR: z.string().default(resolve(process.cwd(), 'data/uploads')),
  ANTHROPIC_API_KEY: z.string().optional(),
  CRON_DISABLED: z.string().optional(),
  CRON_NIGHTLY: z.string().default('0 2 * * *'),
});

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  WORKER_PORT: process.env.WORKER_PORT,
  WORKER_HMAC_SECRET: process.env.WORKER_HMAC_SECRET,
  UPLOAD_DIR: process.env.UPLOAD_DIR,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  CRON_DISABLED: process.env.CRON_DISABLED,
  CRON_NIGHTLY: process.env.CRON_NIGHTLY,
});
```

- [ ] **Step 3: Write failing test for scheduler**

Create `apps/worker/tests/scheduler.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { startScheduler } from '../src/lib/scheduler';

describe('startScheduler', () => {
  it('does nothing when disabled', () => {
    const job = vi.fn();
    const stop = startScheduler({ disabled: true, schedule: '* * * * *', job });
    expect(typeof stop).toBe('function');
    stop();
    expect(job).not.toHaveBeenCalled();
  });
  it('returns a stop function when enabled', () => {
    const stop = startScheduler({ disabled: false, schedule: '0 2 * * *', job: () => undefined });
    expect(typeof stop).toBe('function');
    stop();
  });
});
```

- [ ] **Step 4: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/worker test
```
Expected: fails.

- [ ] **Step 5: Create `apps/worker/src/lib/scheduler.ts`**

```ts
import cron from 'node-cron';

export interface SchedulerOptions {
  schedule: string;
  job: () => Promise<void> | void;
  disabled?: boolean;
}

export function startScheduler({ schedule, job, disabled }: SchedulerOptions): () => void {
  if (disabled) return () => undefined;
  if (!cron.validate(schedule)) {
    throw new Error(`Invalid cron schedule: ${schedule}`);
  }
  const task = cron.schedule(schedule, () => { void job(); });
  return () => task.stop();
}
```

- [ ] **Step 6: Run test (expect pass)**

Run:
```bash
pnpm --filter @perfin/worker test
```
Expected: 2 new tests pass.

- [ ] **Step 7: Write failing test for regenerate**

Create `apps/worker/tests/regenerate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { regenerateForUser } from '../src/lib/regenerate';

describe('regenerateForUser', () => {
  it('returns a summary with counts (uses provided in-memory db)', async () => {
    // unit test: pass an in-memory shim db
    const noop = (...args: unknown[]) => args; // satisfies linter
    void noop;
    const stub = makeStubDb();
    const out = await regenerateForUser({ userId: 1, db: stub.db, currency: 'INR' });
    expect(out).toHaveProperty('insightCount');
    expect(out).toHaveProperty('anomalyCount');
    expect(out).toHaveProperty('recurringCount');
  });
});

function makeStubDb() {
  // Minimal stub: returns 0 transactions, 0 budgets. The orchestrator
  // should still complete with zero counts.
  const select = () => ({ from: () => ({ where: async () => [] }) });
  const insert = () => ({ values: () => ({ onConflictDoNothing: () => ({ returning: async () => [] }) }) });
  const del = () => ({ where: async () => undefined });
  const db = { select, insert, delete: del } as unknown as Parameters<typeof regenerateForUser>[0]['db'];
  return { db };
}
```

- [ ] **Step 8: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/worker test
```
Expected: fails.

- [ ] **Step 9: Create `apps/worker/src/lib/regenerate.ts`**

```ts
import { and, eq, sql } from 'drizzle-orm';
import { anomalies, budgets, insights, recurringSeries, transactions, type Db } from '@perfin/db';
import {
  detectAnomalies, detectRecurring,
  generateInsightProposals, generateNarrative,
  formatCurrency,
} from '@perfin/core';
import { env } from '../env.js';

export interface RegenerateInput {
  userId: number;
  db: Db;
  currency: string;
  withNarrative?: boolean;
}

export interface RegenerateOutput {
  insightCount: number;
  anomalyCount: number;
  recurringCount: number;
}

const isoMonth = (d = new Date()) => d.toISOString().slice(0, 7);

export async function regenerateForUser(input: RegenerateInput): Promise<RegenerateOutput> {
  const { userId, db, currency } = input;

  const txns = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      description: transactions.description,
      amountCents: transactions.amountCents,
      category: transactions.category,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId));

  // Recurring
  await db.delete(recurringSeries).where(eq(recurringSeries.userId, userId));
  const recurring = detectRecurring({ transactions: txns });
  for (const r of recurring) {
    await db.insert(recurringSeries).values({
      userId,
      merchant: r.merchant,
      category: r.category,
      amountCents: r.amountCents,
      cadence: r.cadence,
      nextExpectedAt: r.nextExpectedAt,
      confidence: r.confidence,
      firstSeen: r.firstSeen,
      lastSeen: r.lastSeen,
      status: 'active',
    });
  }

  // Anomalies
  await db
    .delete(anomalies)
    .where(and(eq(anomalies.userId, userId), eq(anomalies.status, 'open')));
  const anomalyProposals = detectAnomalies({ transactions: txns });
  for (const a of anomalyProposals) {
    await db.insert(anomalies).values({
      userId,
      transactionId: a.transactionId,
      kind: a.kind,
      score: a.score,
      reason: a.reason,
      status: 'open',
    }).onConflictDoNothing();
  }

  // Optional Claude narrative
  let monthlyNarrative: { headline: string; body: string } | undefined;
  if (input.withNarrative && env.ANTHROPIC_API_KEY) {
    const narrative = await generateNarrative(
      { currentMonth: isoMonth(), transactions: txns },
      {
        apiKey: env.ANTHROPIC_API_KEY,
        currency,
        formatCurrency: (cents) => formatCurrency(cents, currency),
      },
    );
    monthlyNarrative = { headline: narrative.headline, body: narrative.body };
  }

  // Insight proposals
  await db
    .delete(insights)
    .where(and(eq(insights.userId, userId), sql`${insights.actionTaken} = false`));
  const proposals = generateInsightProposals({
    transactions: txns,
    currentMonth: isoMonth(),
    formatCurrency: (cents) => formatCurrency(cents, currency),
    monthlyNarrative,
  });
  for (const p of proposals) {
    await db.insert(insights).values({
      userId,
      kind: p.kind,
      headline: p.headline,
      body: p.body,
      payload: p.payload as Record<string, unknown>,
      confidence: p.confidence,
      surface: p.surface,
    });
  }

  // Touch budgets so they update mtime (no-op writes are fine)
  void budgets;

  return {
    insightCount: proposals.length,
    anomalyCount: anomalyProposals.length,
    recurringCount: recurring.length,
  };
}
```

- [ ] **Step 10: Run test (expect pass)**

Run:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
  pnpm --filter @perfin/worker test
```
Expected: regenerate test passes (returns zero counts on empty stub).

- [ ] **Step 11: Commit**

```bash
git add apps/worker pnpm-lock.yaml
git commit -m "feat(worker): node-cron scheduler + regenerate orchestrator"
```

---

## Task 9: Worker — `POST /jobs/regenerate` route + cron registration

**Files:**
- Create: `apps/worker/src/routes/regenerate.ts`
- Modify: `apps/worker/src/server.ts`

- [ ] **Step 1: Create `apps/worker/src/routes/regenerate.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { createDb, users } from '@perfin/db';
import { env } from '../env.js';
import { verify } from '../lib/hmac.js';
import { regenerateForUser } from '../lib/regenerate.js';

const Body = z.object({
  userId: z.number().int().positive(),
  withNarrative: z.boolean().optional(),
});

const { db } = createDb(env.DATABASE_URL);

export async function regenerateRoutes(app: FastifyInstance) {
  app.post('/jobs/regenerate', async (req, reply) => {
    const sig = req.headers['x-perfin-sig'];
    if (typeof sig !== 'string') return reply.code(401).send({ error: 'missing signature' });
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!verify(env.WORKER_HMAC_SECRET, raw, sig)) return reply.code(401).send({ error: 'invalid signature' });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const [user] = await db.select().from(users).where(eq(users.id, parsed.data.userId));
    if (!user) return reply.code(404).send({ error: 'user not found' });
    const out = await regenerateForUser({
      userId: user.id,
      db,
      currency: 'INR',
      withNarrative: parsed.data.withNarrative,
    });
    return reply.send({ ok: true, ...out });
  });
}
```

- [ ] **Step 2: Update `apps/worker/src/server.ts`**

```ts
import Fastify from 'fastify';
import { eq } from 'drizzle-orm';
import { createDb, users } from '@perfin/db';
import { env } from './env';
import { healthRoutes } from './routes/health';
import { uploadRoutes } from './routes/upload';
import { streamRoutes } from './routes/stream';
import { regenerateRoutes } from './routes/regenerate';
import { startScheduler } from './lib/scheduler';
import { regenerateForUser } from './lib/regenerate';

export async function buildServer() {
  const app = Fastify({ logger: true });
  await app.register(healthRoutes);
  await app.register(uploadRoutes);
  await app.register(streamRoutes);
  await app.register(regenerateRoutes);
  return app;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  buildServer()
    .then(async (app) => {
      const { db } = createDb(env.DATABASE_URL);
      const stop = startScheduler({
        disabled: !!env.CRON_DISABLED,
        schedule: env.CRON_NIGHTLY,
        job: async () => {
          app.log.info('nightly: regenerating insights for all users');
          const all = await db.select().from(users);
          for (const u of all) {
            try {
              await regenerateForUser({ userId: u.id, db, currency: 'INR', withNarrative: true });
            } catch (err) {
              app.log.error({ err, userId: u.id }, 'nightly regenerate failed');
            }
          }
        },
      });
      app.addHook('onClose', async () => stop());
      return app.listen({ port: env.WORKER_PORT, host: '0.0.0.0' });
    })
    .catch((err) => { console.error(err); process.exit(1); });
}
```

- [ ] **Step 3: Smoke test the route**

Run worker:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
CRON_DISABLED=1 \
  pnpm --filter @perfin/worker dev
```

In another shell, hit the endpoint with a signed body:
```bash
node -e "const c=require('node:crypto');const b=JSON.stringify({userId:1});console.log(c.createHmac('sha256','dev-shared-secret-replace-in-prod').update(b).digest('hex'));"
```
Take that hex, then:
```bash
curl -X POST http://localhost:8001/jobs/regenerate \
  -H 'content-type: application/json' \
  -H 'x-perfin-sig: <PASTE-HEX>' \
  -d '{"userId":1}'
```
Expected: `{ "ok": true, "insightCount": …, "anomalyCount": …, "recurringCount": … }`. Stop the worker.

- [ ] **Step 4: Typecheck and commit**

```bash
pnpm --filter @perfin/worker typecheck
git add apps/worker
git commit -m "feat(worker): POST /jobs/regenerate + nightly cron registration"
```

---

## Task 10: Web — `/api/home` route + `useHome` hook

**Files:**
- Create: `apps/web/app/api/home/route.ts`
- Create: `apps/web/hooks/useHome.ts`

- [ ] **Step 1: Create `apps/web/app/api/home/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { createDb, transactions, insights, accounts } from '@perfin/db';
import { computeKpis, formatCurrency } from '@perfin/core';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

const ymNow = () => new Date().toISOString().slice(0, 7);

export async function GET() {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);

  const [allTxns, recent, todayInsights, accs] = await Promise.all([
    db.select({
      id: transactions.id,
      date: transactions.date,
      description: transactions.description,
      amountCents: transactions.amountCents,
      category: transactions.category,
    }).from(transactions).where(eq(transactions.userId, userId)),
    db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.date), desc(transactions.id)).limit(8),
    db.select().from(insights).where(and(eq(insights.userId, userId), eq(insights.surface, 'home'))).orderBy(desc(insights.confidence)).limit(1),
    db.select().from(accounts).where(eq(accounts.userId, userId)),
  ]);

  const kpis = computeKpis({ transactions: allTxns, currentMonth: ymNow() });
  const currency = accs[0]?.currency ?? 'INR';

  // Build a 90-day balance sparkline (running cumulative)
  const sorted = [...allTxns].sort((a, b) => a.date.localeCompare(b.date));
  let running = 0;
  const series = sorted.map((t) => {
    running += t.amountCents;
    return { date: t.date, balanceCents: running };
  });
  const last90 = series.slice(-90).map((s) => s.balanceCents);

  const netWorthCents = accs.reduce((sum, a) => sum + a.balanceCents, 0) || running;

  return NextResponse.json({
    currency,
    netWorthCents,
    netWorthFormatted: formatCurrency(netWorthCents, currency),
    sparkline90d: last90,
    kpis: {
      ...kpis,
      incomeFormatted: formatCurrency(kpis.incomeCents, currency),
      expensesFormatted: formatCurrency(kpis.expensesCents, currency),
      topCategory: { ...kpis.topCategory, formatted: formatCurrency(kpis.topCategory.spendCents, currency) },
    },
    todayInsight: todayInsights[0] ?? null,
    recent: recent.map((r) => ({ ...r, amountFormatted: formatCurrency(r.amountCents, currency) })),
  });
}
```

- [ ] **Step 2: Create `apps/web/hooks/useHome.ts`**

```ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface HomeData {
  currency: string;
  netWorthCents: number;
  netWorthFormatted: string;
  sparkline90d: number[];
  kpis: {
    incomeCents: number; incomeFormatted: string;
    expensesCents: number; expensesFormatted: string;
    savingsRate: number;
    topCategory: { name: string; spendCents: number; formatted: string };
  };
  todayInsight: { id: number; headline: string; body: string; kind: string; payload: Record<string, unknown> } | null;
  recent: Array<{ id: number; date: string; description: string; category: string; amountCents: number; amountFormatted: string }>;
}

export function useHome() {
  return useQuery<HomeData>({
    queryKey: ['home'],
    queryFn: () => apiFetch<HomeData>('/api/home'),
  });
}
```

- [ ] **Step 3: Typecheck and commit**

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 \
AUTH_URL=http://localhost:3000 \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
  pnpm --filter @perfin/web typecheck
```
Expected: clean.

```bash
git add apps/web
git commit -m "feat(web): GET /api/home + useHome hook"
```

---

## Task 11: Web — Home bento page (rewrite of `/app`)

**Files:**
- Create: `apps/web/components/home/HeroNetWorth.tsx`
- Create: `apps/web/components/home/KpiStrip.tsx`
- Create: `apps/web/components/home/TodayInsight.tsx`
- Create: `apps/web/components/home/RecentActivity.tsx`
- Create: `apps/web/components/home/InboxPreview.tsx`
- Modify: `apps/web/app/(app)/app/page.tsx`

- [ ] **Step 1: Create `apps/web/components/home/HeroNetWorth.tsx`**

```tsx
'use client';

import { Tile, AreaSparkline } from '@perfin/ui';
import type { HomeData } from '@/hooks/useHome';

export function HeroNetWorth({ data }: { data: HomeData }) {
  return (
    <Tile variant="hero" className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-wider font-semibold text-text-subtle">Net worth</div>
        <div className="text-5xl font-mono font-semibold tracking-tight mt-1">{data.netWorthFormatted}</div>
      </div>
      <AreaSparkline values={data.sparkline90d} width={600} height={70} />
    </Tile>
  );
}
```

- [ ] **Step 2: Create `apps/web/components/home/KpiStrip.tsx`**

```tsx
'use client';

import { Stat } from '@perfin/ui';
import type { HomeData } from '@/hooks/useHome';

export function KpiStrip({ data }: { data: HomeData }) {
  const { kpis } = data;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Stat label="INCOME · MO" value={kpis.incomeFormatted} />
      <Stat label="EXPENSES · MO" value={kpis.expensesFormatted} />
      <Stat label="SAVINGS RATE" value={`${(kpis.savingsRate * 100).toFixed(0)}%`} />
      <Stat label="TOP CATEGORY" value={kpis.topCategory.name} deltaText={kpis.topCategory.formatted} deltaTone="neutral" />
    </div>
  );
}
```

- [ ] **Step 3: Create `apps/web/components/home/TodayInsight.tsx`**

```tsx
'use client';

import { AITile, Button } from '@perfin/ui';
import Link from 'next/link';
import type { HomeData } from '@/hooks/useHome';

export function TodayInsight({ data }: { data: HomeData }) {
  if (!data.todayInsight) {
    return (
      <AITile
        headline="Today's insight"
        body="Once you've imported ~30 days of transactions, Perfin will start surfacing patterns here."
      />
    );
  }
  const { headline, body } = data.todayInsight;
  return (
    <AITile
      headline={headline}
      body={body}
      actions={
        <>
          <Link href="/app/insights"><Button variant="secondary" size="sm">Show me</Button></Link>
          <Button variant="ghost" size="sm">Dismiss</Button>
        </>
      }
    />
  );
}
```

- [ ] **Step 4: Create `apps/web/components/home/RecentActivity.tsx`**

```tsx
'use client';

import { Tile, Badge, cn } from '@perfin/ui';
import Link from 'next/link';
import type { HomeData } from '@/hooks/useHome';

export function RecentActivity({ data }: { data: HomeData }) {
  return (
    <Tile className="space-y-3 p-0 overflow-hidden">
      <header className="flex items-center justify-between p-4 pb-0">
        <h2 className="font-semibold">Recent activity</h2>
        <Link href="/app/transactions" className="text-xs text-accent">All transactions →</Link>
      </header>
      <div>
        {data.recent.map((t) => {
          const expense = t.amountCents < 0;
          return (
            <div key={t.id} className="grid grid-cols-[80px_1fr_120px_110px] items-center gap-3 px-4 py-3 text-sm border-t border-border">
              <span className="text-text-muted font-mono text-xs">{t.date}</span>
              <span className="font-medium truncate">{t.description}</span>
              <Badge variant={expense ? 'expense' : 'income'}>{t.category}</Badge>
              <span className={cn('font-mono font-medium text-right', expense ? 'text-negative' : 'text-positive')}>
                {t.amountFormatted}
              </span>
            </div>
          );
        })}
      </div>
    </Tile>
  );
}
```

- [ ] **Step 5: Create `apps/web/components/home/InboxPreview.tsx`**

```tsx
'use client';

import { Tile, Badge } from '@perfin/ui';
import Link from 'next/link';
import { useInbox } from '@/hooks/useInbox';

export function InboxPreview() {
  const { data, isLoading } = useInbox();
  const count = data?.count ?? 0;

  return (
    <Tile className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Inbox</h2>
        <Link href="/app/inbox" className="text-xs text-accent">Open →</Link>
      </div>
      {isLoading ? (
        <div className="text-sm text-text-muted">Loading…</div>
      ) : count === 0 ? (
        <div className="text-sm text-text-muted">Nothing needs review.</div>
      ) : (
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="warning">{count}</Badge>
          <span>{count === 1 ? 'item' : 'items'} need review</span>
        </div>
      )}
    </Tile>
  );
}
```

- [ ] **Step 6: Replace `apps/web/app/(app)/app/page.tsx`**

```tsx
'use client';

import { Skeleton } from '@perfin/ui';
import { useHome } from '@/hooks/useHome';
import { HeroNetWorth } from '@/components/home/HeroNetWorth';
import { KpiStrip } from '@/components/home/KpiStrip';
import { TodayInsight } from '@/components/home/TodayInsight';
import { RecentActivity } from '@/components/home/RecentActivity';
import { InboxPreview } from '@/components/home/InboxPreview';

export default function HomePage() {
  const { data, isLoading } = useHome();

  if (isLoading || !data) {
    return (
      <div className="p-8 max-w-6xl space-y-4">
        <Skeleton variant="tile" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="kpi" />)}
        </div>
        <Skeleton variant="tile" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl space-y-4">
      <h1 className="text-2xl font-semibold">Home</h1>
      <HeroNetWorth data={data} />
      <KpiStrip data={data} />
      <TodayInsight data={data} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2"><RecentActivity data={data} /></div>
        <InboxPreview />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Typecheck and commit**

```bash
pnpm --filter @perfin/web typecheck
git add apps/web
git commit -m "feat(web): bento Home — hero, KPIs, today's insight, recent activity, inbox preview"
```

---

## Task 12: Web — `/api/insights` + `useInsights` + Insights page

**Files:**
- Create: `apps/web/app/api/insights/route.ts`
- Create: `apps/web/app/api/insights/[id]/route.ts`
- Create: `apps/web/hooks/useInsights.ts`
- Create: `apps/web/components/insights/InsightCard.tsx`
- Create: `apps/web/components/insights/InsightTabs.tsx`
- Create: `apps/web/components/insights/InsightFeed.tsx`
- Create: `apps/web/app/(app)/insights/page.tsx`

- [ ] **Step 1: Create `apps/web/app/api/insights/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { createDb, insights } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);

  const url = new URL(req.url);
  const kind = url.searchParams.get('kind');

  const cond = [eq(insights.userId, userId)];
  if (kind) cond.push(eq(insights.kind, kind));

  const rows = await db
    .select()
    .from(insights)
    .where(and(...cond))
    .orderBy(desc(insights.confidence), desc(insights.createdAt))
    .limit(50);

  return NextResponse.json({ rows });
}
```

- [ ] **Step 2: Create `apps/web/app/api/insights/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { createDb, insights } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);
  const { id } = await params;
  const insightId = Number(id);

  const body = (await req.json()) as { actionTaken?: boolean };
  await db
    .update(insights)
    .set({ actionTaken: !!body.actionTaken })
    .where(and(eq(insights.id, insightId), eq(insights.userId, userId)));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Create `apps/web/hooks/useInsights.ts`**

```ts
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface InsightRow {
  id: number;
  kind: 'anomaly' | 'recurring_detected' | 'category_drift' | 'monthly_narrative';
  headline: string;
  body: string;
  payload: Record<string, unknown>;
  confidence: number;
  surface: 'home' | 'insights';
  actionTaken: boolean;
  createdAt: string;
}

export function useInsights(kind?: string) {
  const params = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  return useQuery({
    queryKey: ['insights', kind ?? 'all'],
    queryFn: () => apiFetch<{ rows: InsightRow[] }>(`/api/insights${params}`),
  });
}

export function useDismissInsight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/api/insights/${id}`, { method: 'PATCH', body: JSON.stringify({ actionTaken: true }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insights'] });
      qc.invalidateQueries({ queryKey: ['home'] });
    },
  });
}
```

- [ ] **Step 4: Create `apps/web/components/insights/InsightCard.tsx`**

```tsx
'use client';

import { Tile, Badge, Button } from '@perfin/ui';
import type { InsightRow } from '@/hooks/useInsights';
import { useDismissInsight } from '@/hooks/useInsights';

const kindLabel: Record<InsightRow['kind'], string> = {
  anomaly: 'Anomaly',
  recurring_detected: 'Recurring',
  category_drift: 'Trend',
  monthly_narrative: 'Monthly recap',
};

const kindTone: Record<InsightRow['kind'], 'warning' | 'info' | 'accent' | 'income'> = {
  anomaly: 'warning',
  recurring_detected: 'info',
  category_drift: 'accent',
  monthly_narrative: 'income',
};

export function InsightCard({ insight }: { insight: InsightRow }) {
  const dismiss = useDismissInsight();
  return (
    <Tile className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant={kindTone[insight.kind]}>{kindLabel[insight.kind]}</Badge>
        <span className="text-xs text-text-subtle">confidence {(insight.confidence * 100).toFixed(0)}%</span>
      </div>
      <h3 className="font-semibold">{insight.headline}</h3>
      <p className="text-sm text-text-muted">{insight.body}</p>
      <div className="flex gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={() => dismiss.mutate(insight.id)} disabled={dismiss.isPending}>
          Dismiss
        </Button>
      </div>
    </Tile>
  );
}
```

- [ ] **Step 5: Create `apps/web/components/insights/InsightTabs.tsx`**

```tsx
'use client';

import { cn } from '@perfin/ui';

const tabs = [
  { key: 'all',                 label: 'All' },
  { key: 'anomaly',             label: 'Anomalies' },
  { key: 'recurring_detected', label: 'Recurring' },
  { key: 'category_drift',      label: 'Trends' },
] as const;

export type InsightTabKey = typeof tabs[number]['key'];

export function InsightTabs({ value, onChange }: { value: InsightTabKey; onChange: (k: InsightTabKey) => void }) {
  return (
    <div className="flex gap-2 border-b border-border">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'h-9 px-4 text-sm font-medium transition-colors duration-[120ms]',
            value === t.key ? 'text-accent border-b-2 border-accent' : 'text-text-muted hover:text-text',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Create `apps/web/components/insights/InsightFeed.tsx`**

```tsx
'use client';

import { Skeleton } from '@perfin/ui';
import type { InsightRow } from '@/hooks/useInsights';
import { InsightCard } from './InsightCard';

export function InsightFeed({ rows, loading }: { rows: InsightRow[]; loading: boolean }) {
  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="tile" />)}</div>;
  }
  if (!rows.length) {
    return <div className="text-text-muted text-sm py-12 text-center">No insights yet.</div>;
  }
  return <div className="space-y-3">{rows.map((r) => <InsightCard key={r.id} insight={r} />)}</div>;
}
```

- [ ] **Step 7: Create `apps/web/app/(app)/insights/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useInsights } from '@/hooks/useInsights';
import { InsightTabs, type InsightTabKey } from '@/components/insights/InsightTabs';
import { InsightFeed } from '@/components/insights/InsightFeed';

export default function InsightsPage() {
  const [tab, setTab] = useState<InsightTabKey>('all');
  const { data, isLoading } = useInsights(tab === 'all' ? undefined : tab);
  return (
    <div className="p-8 max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Insights</h1>
      <InsightTabs value={tab} onChange={setTab} />
      <InsightFeed rows={data?.rows ?? []} loading={isLoading} />
    </div>
  );
}
```

- [ ] **Step 8: Typecheck and commit**

```bash
pnpm --filter @perfin/web typecheck
git add apps/web
git commit -m "feat(web): /api/insights + Insights page (tabs, feed, dismiss)"
```

---

## Task 13: Web — `/api/inbox` + `useInbox` + Inbox page + sidebar badge

**Files:**
- Create: `apps/web/app/api/inbox/route.ts`
- Create: `apps/web/hooks/useInbox.ts`
- Create: `apps/web/components/inbox/InboxList.tsx`
- Create: `apps/web/app/(app)/inbox/page.tsx`
- Modify: `apps/web/components/Sidebar.tsx`

- [ ] **Step 1: Create `apps/web/app/api/inbox/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { createDb, anomalies, transactions } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);

  const [needsReview, openAnomalies] = await Promise.all([
    db.select().from(transactions).where(and(eq(transactions.userId, userId), eq(transactions.category, 'Needs Review'))).limit(50),
    db.select().from(anomalies).where(and(eq(anomalies.userId, userId), eq(anomalies.status, 'open'))).limit(50),
  ]);

  return NextResponse.json({
    count: needsReview.length + openAnomalies.length,
    needsReview,
    anomalies: openAnomalies,
  });
}
```

- [ ] **Step 2: Create `apps/web/hooks/useInbox.ts`**

```ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

interface InboxData {
  count: number;
  needsReview: Array<{ id: number; date: string; description: string; amountCents: number; category: string }>;
  anomalies: Array<{ id: number; transactionId: number; kind: string; reason: string; score: number }>;
}

export function useInbox() {
  return useQuery<InboxData>({
    queryKey: ['inbox'],
    queryFn: () => apiFetch<InboxData>('/api/inbox'),
    refetchInterval: 30_000,
  });
}
```

- [ ] **Step 3: Create `apps/web/components/inbox/InboxList.tsx`**

```tsx
'use client';

import { Tile, Badge, Skeleton } from '@perfin/ui';
import Link from 'next/link';
import { useInbox } from '@/hooks/useInbox';

export function InboxList() {
  const { data, isLoading } = useInbox();
  if (isLoading || !data) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="tile" />)}</div>;
  }
  if (data.count === 0) return <p className="text-text-muted">Inbox zero.</p>;

  return (
    <div className="space-y-3">
      {data.needsReview.map((t) => (
        <Tile key={`nr-${t.id}`} className="flex items-center justify-between">
          <div>
            <Badge variant="warning">Needs review</Badge>
            <div className="font-medium mt-1">{t.description}</div>
            <div className="text-xs text-text-subtle font-mono mt-1">{t.date}</div>
          </div>
          <Link href="/app/transactions" className="text-accent text-sm">Categorize →</Link>
        </Tile>
      ))}
      {data.anomalies.map((a) => (
        <Tile key={`an-${a.id}`} className="space-y-1">
          <Badge variant="warning">Anomaly</Badge>
          <div className="font-medium">{a.reason}</div>
          <div className="text-xs text-text-subtle">confidence {(a.score * 100).toFixed(0)}%</div>
        </Tile>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create `apps/web/app/(app)/inbox/page.tsx`**

```tsx
import { InboxList } from '@/components/inbox/InboxList';

export default function InboxPage() {
  return (
    <div className="p-8 max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Inbox</h1>
      <p className="text-sm text-text-muted">Things that need a quick decision.</p>
      <InboxList />
    </div>
  );
}
```

- [ ] **Step 5: Modify `apps/web/components/Sidebar.tsx` to add live badge**

Replace contents:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles, ListOrdered, Lightbulb, MessageSquare, Landmark, Target, BarChart3, Inbox, Upload,
} from 'lucide-react';
import { cn } from '@perfin/ui';
import { useInbox } from '@/hooks/useInbox';

const items = [
  { href: '/app',              label: 'Home',            Icon: Sparkles },
  { href: '/app/transactions', label: 'Transactions',    Icon: ListOrdered },
  { href: '/app/insights',     label: 'Insights',        Icon: Lightbulb },
  { href: '/app/ask',          label: 'Ask',             Icon: MessageSquare },
  { href: '/app/accounts',     label: 'Accounts',        Icon: Landmark },
  { href: '/app/budgets',      label: 'Budgets & Goals', Icon: Target },
  { href: '/app/reports',      label: 'Reports',         Icon: BarChart3 },
  { href: '/app/inbox',        label: 'Inbox',           Icon: Inbox, hasBadge: true },
] as const;

export function Sidebar() {
  const path = usePathname();
  const { data: inbox } = useInbox();
  const inboxCount = inbox?.count ?? 0;

  return (
    <aside className="w-60 h-screen bg-surface border-r border-border flex flex-col">
      <header className="h-16 px-5 flex items-center border-b border-border">
        <span className="text-text font-semibold">Perfin</span>
      </header>
      <nav className="flex-1 p-3 space-y-0.5" aria-label="Primary">
        {items.map(({ href, label, Icon, ...rest }) => {
          const active = path === href || (href !== '/app' && path.startsWith(href));
          const showBadge = 'hasBadge' in rest && rest.hasBadge && inboxCount > 0;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 h-9 px-3 rounded-md text-sm font-medium',
                'transition-colors duration-[120ms]',
                active
                  ? 'bg-accent-soft text-accent'
                  : 'text-text-muted hover:bg-surface-2 hover:text-text',
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
              {showBadge && (
                <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs font-semibold bg-warning text-text-inverse">
                  {inboxCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <footer className="p-3 border-t border-border space-y-2">
        <Link
          href="/app/upload"
          className="flex items-center gap-2 h-9 px-3 rounded-md text-sm font-medium bg-accent text-white hover:bg-accent-hover"
        >
          <Upload className="w-4 h-4" /> Upload statement
        </Link>
        <p className="text-xs text-text-subtle px-3">v0.3 · Phase 2</p>
      </footer>
    </aside>
  );
}
```

- [ ] **Step 6: Typecheck and commit**

```bash
pnpm --filter @perfin/web typecheck
git add apps/web
git commit -m "feat(web): /api/inbox + Inbox page + live sidebar badge"
```

---

## Task 14: Web — `/api/budgets` + Budgets page (read-only display)

**Files:**
- Create: `apps/web/app/api/budgets/route.ts`
- Create: `apps/web/hooks/useBudgets.ts`
- Create: `apps/web/components/budgets/BudgetRow.tsx`
- Create: `apps/web/components/budgets/BudgetsList.tsx`
- Create: `apps/web/app/(app)/budgets/page.tsx`

- [ ] **Step 1: Create `apps/web/app/api/budgets/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { createDb, budgets, transactions } from '@perfin/db';
import { computeBudgetStatus, formatCurrency } from '@perfin/core';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

const ymNow = () => new Date().toISOString().slice(0, 7);

export async function GET() {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);

  const [bs, txns] = await Promise.all([
    db.select().from(budgets).where(eq(budgets.userId, userId)),
    db.select({ date: transactions.date, category: transactions.category, amountCents: transactions.amountCents })
      .from(transactions).where(eq(transactions.userId, userId)),
  ]);

  const statuses = computeBudgetStatus({
    budgets: bs.map((b) => ({ id: b.id, category: b.category, amountCents: b.amountCents })),
    transactions: txns,
    currentMonth: ymNow(),
  });

  const enriched = statuses.map((s) => ({
    ...s,
    spentFormatted: formatCurrency(s.spentCents, 'INR'),
    budgetFormatted: formatCurrency(s.budgetCents, 'INR'),
    remainingFormatted: formatCurrency(s.remainingCents, 'INR'),
  }));

  return NextResponse.json({ rows: enriched });
}
```

- [ ] **Step 2: Create `apps/web/hooks/useBudgets.ts`**

```ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface BudgetStatusRow {
  budgetId: number;
  category: string;
  budgetCents: number;
  spentCents: number;
  remainingCents: number;
  percent: number;
  spentFormatted: string;
  budgetFormatted: string;
  remainingFormatted: string;
}

export function useBudgets() {
  return useQuery<{ rows: BudgetStatusRow[] }>({
    queryKey: ['budgets'],
    queryFn: () => apiFetch<{ rows: BudgetStatusRow[] }>('/api/budgets'),
  });
}
```

- [ ] **Step 3: Create `apps/web/components/budgets/BudgetRow.tsx`**

```tsx
'use client';

import { cn } from '@perfin/ui';
import type { BudgetStatusRow } from '@/hooks/useBudgets';

export function BudgetRow({ row }: { row: BudgetStatusRow }) {
  const over = row.percent > 100;
  const fillClass = over ? 'bg-negative' : 'bg-accent';
  return (
    <div className="space-y-2 py-3 border-b border-border last:border-0">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{row.category}</span>
        <span className="font-mono text-text-muted">
          {row.spentFormatted} / {row.budgetFormatted}
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
        <div
          className={cn('h-full transition-[width] duration-200', fillClass)}
          style={{ width: `${Math.min(100, row.percent)}%` }}
        />
      </div>
      <div className="text-xs text-text-subtle">
        {over ? `Over by ${row.remainingFormatted.replace('−', '')}` : `${row.remainingFormatted} left`}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `apps/web/components/budgets/BudgetsList.tsx`**

```tsx
'use client';

import { Tile, Skeleton } from '@perfin/ui';
import { useBudgets } from '@/hooks/useBudgets';
import { BudgetRow } from './BudgetRow';

export function BudgetsList() {
  const { data, isLoading } = useBudgets();
  if (isLoading) return <Skeleton variant="tile" />;
  if (!data?.rows.length) {
    return (
      <Tile className="text-center text-text-muted text-sm py-12">
        No budgets yet. Create a budget on the Settings page (coming soon).
      </Tile>
    );
  }
  return (
    <Tile className="px-4">
      {data.rows.map((r) => <BudgetRow key={r.budgetId} row={r} />)}
    </Tile>
  );
}
```

- [ ] **Step 5: Create `apps/web/app/(app)/budgets/page.tsx`**

```tsx
import { BudgetsList } from '@/components/budgets/BudgetsList';

export default function BudgetsPage() {
  return (
    <div className="p-8 max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Budgets & Goals</h1>
      <p className="text-sm text-text-muted">Month-to-date spend per category. Goals land in a later phase.</p>
      <BudgetsList />
    </div>
  );
}
```

- [ ] **Step 6: Typecheck and commit**

```bash
pnpm --filter @perfin/web typecheck
git add apps/web
git commit -m "feat(web): /api/budgets + Budgets page (read-only with progress bars)"
```

---

## Task 15: Web — `/api/recurring` + `useRecurring` (used by Insights tabs)

**Files:**
- Create: `apps/web/app/api/recurring/route.ts`
- Create: `apps/web/hooks/useRecurring.ts`

- [ ] **Step 1: Create `apps/web/app/api/recurring/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { createDb, recurringSeries } from '@perfin/db';
import { formatCurrency } from '@perfin/core';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);

  const rows = await db.select().from(recurringSeries).where(eq(recurringSeries.userId, userId));
  return NextResponse.json({
    rows: rows.map((r) => ({ ...r, amountFormatted: formatCurrency(r.amountCents, 'INR') })),
  });
}
```

- [ ] **Step 2: Create `apps/web/hooks/useRecurring.ts`**

```ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface RecurringRow {
  id: number;
  merchant: string;
  category: string;
  amountCents: number;
  amountFormatted: string;
  cadence: 'weekly' | 'monthly' | 'quarterly' | 'annual';
  nextExpectedAt: string | null;
  confidence: number;
  firstSeen: string;
  lastSeen: string;
}

export function useRecurring() {
  return useQuery<{ rows: RecurringRow[] }>({
    queryKey: ['recurring'],
    queryFn: () => apiFetch<{ rows: RecurringRow[] }>('/api/recurring'),
  });
}
```

- [ ] **Step 3: Typecheck and commit**

```bash
pnpm --filter @perfin/web typecheck
git add apps/web
git commit -m "feat(web): /api/recurring + useRecurring hook"
```

---

## Task 16: Sample data fixture for e2e

**Files:**
- Create: `data/seeds/60-day-sample.csv`

- [ ] **Step 1: Create the fixture**

Create `data/seeds/60-day-sample.csv`:

```csv
Date,Description,Amount
2026-03-01,Salary Acme Corp,80000
2026-03-02,Spotify,-1099
2026-03-05,Swiggy Bangalore,-450
2026-03-08,Whole Foods,-3200
2026-03-12,Netflix,-1499
2026-03-15,Uber,-220
2026-03-18,Swiggy Bangalore,-380
2026-03-22,Jio Mobile,-29900
2026-03-25,Apple Store,-249900
2026-03-28,Coffee Day,-180
2026-04-01,Salary Acme Corp,80000
2026-04-02,Spotify,-1099
2026-04-04,Swiggy Bangalore,-520
2026-04-07,Whole Foods,-2800
2026-04-12,Netflix,-1499
2026-04-13,Swiggy Bangalore,-410
2026-04-15,Uber,-310
2026-04-18,Swiggy Bangalore,-460
2026-04-20,Coffee Day,-150
2026-04-22,Jio Mobile,-32000
2026-04-25,Swiggy Bangalore,-540
2026-04-26,Swiggy Bangalore,-380
2026-04-28,Coffee Day,-200
2026-04-29,Swiggy Bangalore,-440
2026-04-30,Coffee Day,-180
```

- [ ] **Step 2: Commit**

```bash
git add data/seeds
git commit -m "data: 60-day sample CSV (subscriptions, recurring food, anomaly)"
```

---

## Task 17: Playwright e2e for the insights flow

**Files:**
- Create: `apps/web/tests/e2e/insights-flow.spec.ts`

- [ ] **Step 1: Create the test**

```ts
import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { createHmac } from 'node:crypto';

const SECRET = process.env.WORKER_HMAC_SECRET ?? 'dev-shared-secret-replace-in-prod';
const WORKER = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:8001';

test('signup → upload 60d sample → trigger regenerate → see insights', async ({ page, request }) => {
  const stamp = Date.now();
  const email = `e2e-ins-${stamp}@perfin.dev`;
  const password = 'password12345';
  const csv = resolve(__dirname, '../../../../data/seeds/60-day-sample.csv');

  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /create account/i }).click();
  await page.waitForURL('**/onboarding/welcome');
  await page.getByRole('link', { name: /get started/i }).click();
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByRole('link', { name: /upload a statement/i }).click();
  await page.waitForURL('**/upload');
  await page.locator('input[type="file"]').setInputFiles(csv);
  await page.waitForURL('**/app/transactions', { timeout: 30_000 });

  // Regenerate insights via signed worker call
  const userIdMatch = await request.get('/api/home');
  expect(userIdMatch.ok()).toBe(true);

  // Find user id by email via direct DB call: skip; use the regenerate-all endpoint by hitting the cron job's path with userId from auth.
  // Easier: log in again as same user, call the worker with the user_id we can get from /api/home (which currently doesn't return it).
  // For Phase 2 we can short-circuit: fire the regenerate from the app side via the worker URL using userId=1 since the e2e starts on a fresh DB.
  // BUT the e2e DB is shared. So instead, we trigger the regenerate by reading the userId from the session cookie isn't simple here.
  // Workable: hit a temporary helper page that calls the worker with the current session user id.

  // Pragmatic fallback: call the worker for ALL users via a small test helper endpoint.
  // We provide one in the web app's /api/test-regenerate (added in Task 18).

  const reg = await request.post('/api/test-regenerate', { headers: { 'content-type': 'application/json' } });
  expect(reg.ok()).toBe(true);

  await page.goto('/app/insights');
  await expect(page.getByRole('heading', { name: /insights/i })).toBeVisible();
  // We expect at least one card to appear within 10s
  await expect(page.locator('text=/Spotify|Netflix|Swiggy|Jio|Apple/i').first()).toBeVisible({ timeout: 10_000 });

  // Home should show net worth + KPIs
  await page.goto('/app');
  await expect(page.getByText(/net worth/i)).toBeVisible();
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/tests
git commit -m "test(web): e2e for upload → regenerate → insights surfaces"
```

---

## Task 18: Test-only `POST /api/test-regenerate` (gated by NODE_ENV)

**Files:**
- Create: `apps/web/app/api/test-regenerate/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { callWorker } from '@/lib/worker';

export const runtime = 'nodejs';

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'disabled in production' }, { status: 403 });
  }
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);
  const out = await callWorker<{ ok: true }>('/jobs/regenerate', { userId });
  return NextResponse.json(out);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/api/test-regenerate
git commit -m "feat(web): test-only /api/test-regenerate (gated NODE_ENV != production)"
```

---

## Task 19: Phase 2 acceptance — full sweep

- [ ] **Step 1: Typecheck + tests**

Run:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 \
AUTH_URL=http://localhost:3000 \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
  pnpm typecheck
```
Expected: clean across all packages.

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 \
AUTH_URL=http://localhost:3000 \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
  pnpm test
```
Expected: ≥ 130 tests pass.

- [ ] **Step 2: Build**

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 \
AUTH_URL=http://localhost:3000 \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
  pnpm build
```
Expected: web (≥ 21 routes) + worker both build.

- [ ] **Step 3: e2e**

Make sure Postgres is up and migrations applied:
```bash
docker compose up -d
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin pnpm db:migrate
```
Run e2e:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 \
AUTH_URL=http://localhost:3000 \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
CRON_DISABLED=1 \
  pnpm --filter @perfin/web test:e2e
```
Expected: all 4 e2e tests pass (2 happy-path + 1 upload-flow + 1 insights-flow).

- [ ] **Step 4: Manual smoke**

Sign up fresh, complete onboarding, drop `data/seeds/60-day-sample.csv`, wait for transactions to appear, hit `/app/insights` — confirm cards. Open `/app/inbox` — confirm sidebar badge matches count. Open `/app/budgets` — confirm any budgets render with progress bars (or empty state if none seeded).

- [ ] **Step 5: Tag and push**

```bash
git tag v0.3.0-phase2
git push origin main
git push origin v0.3.0-phase2
```

- [ ] **Step 6: Update `docs/PHASES.md`**

Move Phase 2 to ✅ Done; add a completion-notes section mirroring Phase 1's. Commit:

```bash
git add docs/PHASES.md
git commit -m "docs(phases): mark Phase 2 as done"
git push origin main
```

---

## Phase 2 — Definition of done

- [ ] All 19 tasks committed
- [ ] `pnpm typecheck` clean across all packages
- [ ] `pnpm test` passes — ≥ 130 unit tests total
- [ ] `pnpm build` succeeds
- [ ] Playwright e2e (4 scenarios) passes: signup, upload-flow, insights-flow, route-protection
- [ ] Manual smoke: signup → upload 60-day sample → see categorized transactions, KPIs, recent activity, at least one Spotify/Netflix-style recurring card and one anomaly card
- [ ] Tag `v0.3.0-phase2` on `main`, pushed
- [ ] `docs/PHASES.md` updated

---

## Self-review notes

**Spec coverage check.** Phase 2 of the design spec calls for: recurring + anomaly detectors (TS port — done in Tasks 1-3), Home bento page (Task 11), Insights feed (Task 12), Inbox (Task 13), scheduled nightly job (Tasks 8-9), monthly narrative (Task 5), category drift (Task 4), budgets read-only display (Task 14). The single thing the design spec mentions that this plan does NOT implement: **goals** — those land later (the design lists them under "Budgets & Goals" but Phase 2's stated scope is "budgets read-only", and goal projection requires the cash-flow forecast which is a Phase 3 piece). The Budgets page header explicitly says "Goals land in a later phase".

**Type-consistency check.** `Transaction` shape — every consumer uses `{ id, date, description, amountCents, category }` (sometimes plus). Recurring `Cadence` is `'weekly' | 'monthly' | 'quarterly' | 'annual'` everywhere. Anomaly `kind` matches the enum in `@perfin/db`'s `anomalies.kind` text column. `Insight` shape passes `payload: Record<string, unknown>` (matches Drizzle's jsonb column type). Sidebar badge reads `inbox.count` from the same `useInbox` hook used by Home's `InboxPreview`.

**Out of scope — deferred to Phase 3.** Goals, cash-flow forecast, agent chat, agent action confirmations, agent_actions audit log surface (the table exists but no UI yet). Phase 4: Plaid, email-forwarding ingest. Phase 5: marketing, billing, PWA push.

**Risk notes.**
- *Cron-in-process*: nightly job runs in the same Node process as the Fastify HTTP server. Acceptable single-machine; would graduate to a separate worker process / BullMQ when load justifies. `CRON_DISABLED=1` is honored in tests so tests don't race the scheduler.
- *Claude API in narrative*: when `ANTHROPIC_API_KEY` is unset, the narrative path is skipped entirely; everything else still works. Tests don't make live calls; `narrative.test.ts` tests only the deterministic stat block.
- *Data freshness*: the Home and Insights pages don't auto-poll for new insights. The dismiss action invalidates the React Query cache. The 30-second `useInbox` polling refresh is enough to catch new anomalies between explicit reloads.
- *Insight idempotency*: `regenerateForUser` deletes-then-inserts insights and recurring rows for the user (anomalies are deleted by `(userId, status='open')` to preserve user-confirmed/dismissed state). This guarantees the page always reflects the latest run rather than accumulating duplicates across runs.
