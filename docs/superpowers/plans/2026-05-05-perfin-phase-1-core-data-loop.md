# Perfin — Phase 1: Core Data Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sign up → upload a PDF/CSV/Excel statement → watch the worker extract, normalize, and categorize transactions → see them in a paginated, filterable table on `/app/transactions` → manage manual accounts on `/app/accounts` → ship a 3-step onboarding that lands the user inside the app with their first batch of categorized data.

**Architecture:** Two new packages — `@perfin/core` (pure-TS domain logic; no I/O) for normalization + rule-engine + Claude categorization orchestrator, and `@perfin/extractors` (Node-only) for CSV/Excel/PDF parsers and per-bank heuristics. The web app gets a React Query layer for transactions/accounts hooks, real pages on `/app/transactions` and `/app/accounts`, and a 3-step onboarding flow. The worker grows two new endpoints: `POST /jobs/upload` (HMAC-signed, called by the web app's server action after the file lands on disk) and `GET /jobs/:id/stream` (Server-Sent Events for live progress). File storage is local disk under `apps/worker/data/uploads/` for Phase 1 (R2 swap deferred to Phase 5).

**Tech Stack:** All Phase 0 stack plus: `@anthropic-ai/sdk` 0.30 · `pdfjs-dist` 4.7 · `xlsx` (sheetjs CDN tarball) · `csv-parse` 5.5 · `@tanstack/react-query` 5.59 · `lucide-react` 0.456 · `node:crypto` HMAC.

**Phase 1 acceptance:**
1. New user signs up → onboarding (3 steps) → /app/onboarding/connect → drops a CSV → upload page shows live progress → lands on /app/transactions with N rows already categorized.
2. `pnpm typecheck`, `pnpm test`, `pnpm build` clean.
3. Playwright e2e covering signup → upload sample CSV → see categorized transactions → filter by category → edit one transaction's category → assert change persists.
4. The legacy SQLite import (Phase 0 task 12) still works end-to-end.

---

## File Structure

Files created or modified in this phase:

```
perfin/
├── packages/
│   ├── core/                                    # NEW
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── money.ts                         # cents <-> rupees, formatCurrency
│   │   │   ├── text.ts                          # normalizeDescription, hashRow
│   │   │   ├── normalize.ts                     # raw row -> NormalizedTxn
│   │   │   ├── categorize/
│   │   │   │   ├── types.ts
│   │   │   │   ├── rules.ts                     # rule loader + matcher
│   │   │   │   ├── seed-rules.ts                # ported merchant_rules.json
│   │   │   │   ├── claude.ts                    # Anthropic SDK wrapper
│   │   │   │   └── orchestrate.ts               # rules -> claude fallback
│   │   │   └── categories.ts                    # canonical taxonomy enum
│   │   ├── tests/
│   │   │   ├── money.test.ts
│   │   │   ├── text.test.ts
│   │   │   ├── normalize.test.ts
│   │   │   ├── rules.test.ts
│   │   │   ├── orchestrate.test.ts
│   │   │   └── fixtures/
│   │   │       └── sample-rows.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── package.json
│   └── extractors/                              # NEW
│       ├── src/
│       │   ├── index.ts
│       │   ├── types.ts
│       │   ├── csv.ts
│       │   ├── excel.ts
│       │   ├── pdf.ts
│       │   ├── detect.ts                        # mime sniff -> extractor
│       │   └── banks/
│       │       ├── index.ts
│       │       └── hdfc.ts                      # one bank heuristic to prove pattern
│       ├── tests/
│       │   ├── csv.test.ts
│       │   ├── excel.test.ts
│       │   ├── pdf.test.ts
│       │   ├── detect.test.ts
│       │   ├── hdfc.test.ts
│       │   └── fixtures/
│       │       ├── basic.csv
│       │       ├── basic.xlsx                   # generated via xlsx in test setup
│       │       └── hdfc-sample.txt              # text snippet that mimics HDFC layout
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       └── package.json
│
├── apps/
│   ├── worker/
│   │   ├── src/
│   │   │   ├── server.ts                        # MODIFIED: register new routes
│   │   │   ├── env.ts                           # MODIFIED: add UPLOAD_DIR
│   │   │   ├── lib/
│   │   │   │   ├── hmac.ts                      # NEW
│   │   │   │   ├── jobs.ts                      # NEW: in-memory job registry + emitter
│   │   │   │   └── pipeline.ts                  # NEW: orchestrates extract→normalize→categorize→insert
│   │   │   └── routes/
│   │   │       ├── health.ts
│   │   │       ├── upload.ts                    # NEW
│   │   │       └── stream.ts                    # NEW
│   │   ├── tests/
│   │   │   ├── health.test.ts
│   │   │   ├── hmac.test.ts                     # NEW
│   │   │   ├── upload.test.ts                   # NEW
│   │   │   └── pipeline.test.ts                 # NEW
│   │   └── package.json                         # MODIFIED: add deps
│   └── web/
│       ├── app/
│       │   ├── (app)/
│       │   │   ├── transactions/page.tsx        # NEW
│       │   │   ├── accounts/page.tsx            # NEW
│       │   │   └── upload/page.tsx              # NEW
│       │   ├── onboarding/
│       │   │   ├── layout.tsx                   # NEW
│       │   │   ├── welcome/page.tsx             # NEW
│       │   │   ├── locale/page.tsx              # NEW
│       │   │   ├── locale/actions.ts            # NEW
│       │   │   ├── connect/page.tsx             # NEW
│       │   │   └── done/page.tsx                # NEW
│       │   └── api/
│       │       ├── upload/route.ts              # NEW: receives file, persists, calls worker
│       │       └── transactions/                # NEW
│       │           ├── route.ts                 # GET list
│       │           └── [id]/route.ts            # PATCH update
│       ├── components/
│       │   ├── Sidebar.tsx                      # MODIFIED: add badges (placeholders)
│       │   ├── transactions/
│       │   │   ├── TransactionsTable.tsx
│       │   │   ├── TransactionFilters.tsx
│       │   │   └── TransactionEditSheet.tsx
│       │   ├── accounts/
│       │   │   ├── AccountsGrid.tsx
│       │   │   └── AccountCard.tsx
│       │   └── upload/
│       │       └── UploadDropzone.tsx
│       ├── lib/
│       │   ├── api.ts                           # NEW: typed fetcher
│       │   ├── query.ts                         # NEW: React Query client + provider
│       │   ├── currency.ts                      # NEW: thin re-export of @perfin/core/money
│       │   └── worker.ts                        # NEW: HMAC-signed worker calls
│       ├── hooks/
│       │   ├── useTransactions.ts               # NEW
│       │   └── useAccounts.ts                   # NEW
│       └── tests/e2e/
│           ├── happy-path.spec.ts               # MODIFIED
│           └── upload-flow.spec.ts              # NEW
│
└── data/
    └── uploads/                                 # NEW (gitignored): worker file store
        └── .gitkeep
```

**Boundaries:**
- `@perfin/core` — pure TS, no Node-only APIs, no env, no I/O. Both web and worker import it.
- `@perfin/extractors` — Node-only (uses `pdfjs-dist`, `xlsx`, `csv-parse`). Worker only.
- Worker writes to `data/uploads/` and to Postgres. Never to the web app's filesystem.
- Web `POST /api/upload` is the only endpoint the browser hits; web then HMAC-signs a call to worker `POST /jobs/upload` with the saved file path + user id.

---

## Task 1: Add `@perfin/core` package

**Files:**
- Create: `packages/core/package.json`, `tsconfig.json`, `vitest.config.ts`
- Create: `packages/core/src/index.ts`

- [ ] **Step 1: Create `packages/core/package.json`**

```json
{
  "name": "@perfin/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "0.30.1"
  },
  "devDependencies": {
    "@perfin/config": "workspace:*",
    "@types/node": "22.9.0",
    "typescript": "5.6.3",
    "vitest": "2.1.4"
  }
}
```

- [ ] **Step 2: Create `packages/core/tsconfig.json`**

```json
{
  "extends": "@perfin/config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "noEmit": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Create `packages/core/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', globals: true },
});
```

- [ ] **Step 4: Create `packages/core/src/index.ts`**

```ts
export {};
```

- [ ] **Step 5: Install + commit**

Run:
```bash
pnpm install
git add packages/core pnpm-lock.yaml
git commit -m "chore(core): scaffold @perfin/core package"
```
Expected: install succeeds; commit created.

---

## Task 2: Money helpers

**Files:**
- Create: `packages/core/src/money.ts`
- Create: `packages/core/tests/money.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/core/tests/money.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { rupeesToCents, centsToRupees, formatCurrency } from '../src/money';

describe('rupeesToCents', () => {
  it('handles whole numbers', () => {
    expect(rupeesToCents(100)).toBe(10000);
  });
  it('handles decimals safely (no FP drift)', () => {
    expect(rupeesToCents(0.1 + 0.2)).toBe(30);
    expect(rupeesToCents(19.99)).toBe(1999);
  });
  it('handles negatives', () => {
    expect(rupeesToCents(-12.34)).toBe(-1234);
  });
});

describe('centsToRupees', () => {
  it('round-trips', () => {
    expect(centsToRupees(rupeesToCents(123.45))).toBe(123.45);
  });
});

describe('formatCurrency', () => {
  it('formats USD', () => {
    expect(formatCurrency(1234567, 'USD')).toBe('$12,345.67');
  });
  it('formats INR with rupee sign', () => {
    expect(formatCurrency(1234567, 'INR')).toMatch(/₹/);
  });
  it('uses U+2212 for negatives', () => {
    expect(formatCurrency(-1000, 'USD')).toContain('−');
    expect(formatCurrency(-1000, 'USD')).not.toContain('-');
  });
  it('always shows the sign on positives when withSign=true', () => {
    expect(formatCurrency(1000, 'USD', { withSign: true })).toContain('+');
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/core test
```
Expected: fails — `money.ts` does not exist.

- [ ] **Step 3: Create `packages/core/src/money.ts`**

```ts
export function rupeesToCents(amount: number): number {
  return Math.round(amount * 100);
}

export function centsToRupees(cents: number): number {
  return cents / 100;
}

export interface FormatOptions {
  withSign?: boolean;
}

export function formatCurrency(
  cents: number,
  currency: string,
  opts: FormatOptions = {},
): string {
  const negative = cents < 0;
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  let body = formatter.format(Math.abs(cents) / 100);
  // Replace the locale's standard ASCII '-' (if any leaked in) with U+2212.
  body = body.replace(/-/g, '−');
  if (negative) return `−${body}`;
  if (opts.withSign) return `+${body}`;
  return body;
}
```

- [ ] **Step 4: Run test (expect pass)**

Run:
```bash
pnpm --filter @perfin/core test
```
Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): money helpers (cents conversion + locale-aware format)"
```

---

## Task 3: Text and dedupe helpers

**Files:**
- Create: `packages/core/src/text.ts`
- Create: `packages/core/tests/text.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/core/tests/text.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeDescription, hashRow } from '../src/text';

describe('normalizeDescription', () => {
  it('collapses whitespace and trims', () => {
    expect(normalizeDescription('  Whole   Foods   Market  ')).toBe('Whole Foods Market');
  });
  it('strips common bank junk', () => {
    expect(normalizeDescription('UPI/HDFC0000123/swiggy')).toBe('swiggy');
    expect(normalizeDescription('POS XXXX1234 STARBUCKS NEW YORK')).toBe('STARBUCKS NEW YORK');
  });
  it('removes trailing transaction codes', () => {
    expect(normalizeDescription('Amazon AMZN.COM 4FN8K2L1Q')).toBe('Amazon AMZN.COM');
  });
});

describe('hashRow', () => {
  it('produces a stable 16-hex hash', () => {
    const a = hashRow({ date: '2026-05-01', description: 'X', amountCents: 100, sourceFile: 'a.csv' });
    const b = hashRow({ date: '2026-05-01', description: 'X', amountCents: 100, sourceFile: 'a.csv' });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });
  it('differs when any field changes', () => {
    const a = hashRow({ date: '2026-05-01', description: 'X', amountCents: 100, sourceFile: 'a.csv' });
    const b = hashRow({ date: '2026-05-02', description: 'X', amountCents: 100, sourceFile: 'a.csv' });
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/core test
```
Expected: fails.

- [ ] **Step 3: Create `packages/core/src/text.ts`**

```ts
import { createHash } from 'node:crypto';

const BANK_PREFIX_PATTERNS = [
  /^UPI\/[^\/]+\//i,
  /^POS\s+X{2,}\d+\s+/i,
  /^NEFT-/i,
  /^IMPS-/i,
  /^ATM\s+WD\s+/i,
];

const TRAILING_CODE = /\s+[A-Z0-9]{6,}$/;

export function normalizeDescription(raw: string): string {
  let s = raw.trim().replace(/\s+/g, ' ');
  for (const pattern of BANK_PREFIX_PATTERNS) {
    s = s.replace(pattern, '');
  }
  s = s.replace(TRAILING_CODE, '');
  return s.trim();
}

export interface HashRowInput {
  date: string;
  description: string;
  amountCents: number;
  sourceFile: string | null;
}

export function hashRow(row: HashRowInput): string {
  const key = `${row.date}|${row.description}|${row.amountCents}|${row.sourceFile ?? ''}`;
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}
```

- [ ] **Step 4: Run test (expect pass)**

Run:
```bash
pnpm --filter @perfin/core test
```
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): text normalization + row hash"
```

---

## Task 4: Canonical category taxonomy + normalization

**Files:**
- Create: `packages/core/src/categories.ts`
- Create: `packages/core/src/normalize.ts`
- Create: `packages/core/tests/normalize.test.ts`

- [ ] **Step 1: Create `packages/core/src/categories.ts`**

```ts
export const CATEGORIES = [
  'Income',
  'Food',
  'Groceries',
  'Transport',
  'Utilities',
  'Shopping',
  'Rent',
  'Insurance',
  'Subscription',
  'Investment',
  'Transfer',
  'Medical',
  'Entertainment',
  'Travel',
  'Education',
  'Professional Services',
  'Home Maintenance',
  'Personal Care',
  'Gifts & Donations',
  'Other',
  'Needs Review',
] as const;

export type Category = typeof CATEGORIES[number];

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}
```

- [ ] **Step 2: Write failing test**

Create `packages/core/tests/normalize.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeRow, type RawRow } from '../src/normalize';

describe('normalizeRow', () => {
  it('produces a NormalizedTxn with cents and cleaned description', () => {
    const raw: RawRow = {
      date: '2026-05-01',
      description: '  Whole   Foods  Market  ',
      amount: -84.20,
      sourceFile: 'apr.csv',
    };
    const out = normalizeRow(raw);
    expect(out.date).toBe('2026-05-01');
    expect(out.description).toBe('Whole Foods Market');
    expect(out.rawDescription).toBe('  Whole   Foods  Market  ');
    expect(out.amountCents).toBe(-8420);
    expect(out.sourceFile).toBe('apr.csv');
    expect(out.dedupeHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('parses dd/mm/yyyy', () => {
    const out = normalizeRow({
      date: '01/05/2026', description: 'X', amount: 1, sourceFile: null,
    });
    expect(out.date).toBe('2026-05-01');
  });

  it('parses mm/dd/yyyy when locale=US', () => {
    const out = normalizeRow({
      date: '05/01/2026', description: 'X', amount: 1, sourceFile: null,
    }, { locale: 'US' });
    expect(out.date).toBe('2026-05-01');
  });

  it('throws on unparseable date', () => {
    expect(() => normalizeRow({
      date: 'lol', description: 'X', amount: 1, sourceFile: null,
    })).toThrow(/date/i);
  });
});
```

- [ ] **Step 3: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/core test
```
Expected: fails.

- [ ] **Step 4: Create `packages/core/src/normalize.ts`**

```ts
import { rupeesToCents } from './money';
import { hashRow, normalizeDescription } from './text';

export interface RawRow {
  date: string;
  description: string;
  amount: number;
  sourceFile: string | null;
  account?: string | null;
}

export interface NormalizedTxn {
  date: string;          // ISO yyyy-mm-dd
  description: string;
  rawDescription: string;
  amountCents: number;
  sourceFile: string | null;
  account: string | null;
  dedupeHash: string;
}

export interface NormalizeOptions {
  locale?: 'IN' | 'US' | 'EU';
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const SLASH = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
const SHORT = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/;

function pad(n: string): string { return n.padStart(2, '0'); }
function expandYear(y: string): string { return y.length === 2 ? `20${y}` : y; }

export function parseDate(input: string, opts: NormalizeOptions = {}): string {
  const trimmed = input.trim();
  const iso = ISO.exec(trimmed);
  if (iso) return `${iso[1]}-${pad(iso[2]!)}-${pad(iso[3]!)}`;

  const slash = SLASH.exec(trimmed) ?? SHORT.exec(trimmed);
  if (slash) {
    const a = slash[1]!;
    const b = slash[2]!;
    const yRaw = slash[3]!;
    const year = expandYear(yRaw);
    const usFirst = opts.locale === 'US';
    const month = usFirst ? a : b;
    const day = usFirst ? b : a;
    return `${year}-${pad(month)}-${pad(day)}`;
  }
  throw new Error(`unparseable date: ${input}`);
}

export function normalizeRow(raw: RawRow, opts: NormalizeOptions = {}): NormalizedTxn {
  const date = parseDate(raw.date, opts);
  const description = normalizeDescription(raw.description);
  const amountCents = rupeesToCents(raw.amount);
  const sourceFile = raw.sourceFile;
  const dedupeHash = hashRow({ date, description, amountCents, sourceFile });
  return {
    date,
    description,
    rawDescription: raw.description,
    amountCents,
    sourceFile,
    account: raw.account ?? null,
    dedupeHash,
  };
}
```

- [ ] **Step 5: Update `packages/core/src/index.ts`**

```ts
export * from './money';
export * from './text';
export * from './categories';
export * from './normalize';
```

- [ ] **Step 6: Run test (expect pass)**

Run:
```bash
pnpm --filter @perfin/core test
```
Expected: 4 tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/core
git commit -m "feat(core): NormalizedTxn type + normalizeRow with date parsing"
```

---

## Task 5: Categorization — types + rule loader

**Files:**
- Create: `packages/core/src/categorize/types.ts`
- Create: `packages/core/src/categorize/rules.ts`
- Create: `packages/core/tests/rules.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/core/tests/rules.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { matchRule, type Rule } from '../src/categorize/rules';

const rules: Rule[] = [
  { priority: 10, matchType: 'contains', pattern: 'salary', category: 'Income' },
  { priority: 9,  matchType: 'contains', pattern: 'swiggy', category: 'Food' },
  { priority: 5,  matchType: 'regex',    pattern: '^amzn',  category: 'Shopping' },
  { priority: 1,  matchType: 'exact',    pattern: 'rent',   category: 'Rent' },
];

describe('matchRule', () => {
  it('matches by contains, case-insensitive', () => {
    expect(matchRule('SWIGGY Bangalore', rules)?.category).toBe('Food');
  });
  it('matches by regex', () => {
    expect(matchRule('AMZN Mktp US', rules)?.category).toBe('Shopping');
  });
  it('matches by exact', () => {
    expect(matchRule('rent', rules)?.category).toBe('Rent');
    expect(matchRule('rental car', rules)?.category).toBeNull();
  });
  it('respects priority — highest wins', () => {
    const overlapping: Rule[] = [
      { priority: 5,  matchType: 'contains', pattern: 'amazon', category: 'Shopping' },
      { priority: 9,  matchType: 'contains', pattern: 'amazon', category: 'Subscription' },
    ];
    expect(matchRule('Amazon Prime', overlapping)?.category).toBe('Subscription');
  });
  it('returns null when nothing matches', () => {
    expect(matchRule('Unknown Vendor 42', rules)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/core test
```
Expected: fails.

- [ ] **Step 3: Create `packages/core/src/categorize/types.ts`**

```ts
import type { Category } from '../categories';

export interface Rule {
  priority: number;
  matchType: 'contains' | 'exact' | 'regex';
  pattern: string;
  category: Category;
}

export interface CategorizationResult {
  category: Category;
  source: 'rule' | 'llm' | 'default';
  confidence: number;
  reason?: string;
}
```

- [ ] **Step 4: Create `packages/core/src/categorize/rules.ts`**

```ts
import type { Rule } from './types';

export type { Rule };

export function matchRule(description: string, rules: Rule[]): Rule | null {
  const desc = description.toLowerCase();
  const sorted = [...rules].sort((a, b) => b.priority - a.priority);
  for (const r of sorted) {
    const p = r.pattern.toLowerCase();
    if (r.matchType === 'contains' && desc.includes(p)) return r;
    if (r.matchType === 'exact'    && desc === p)        return r;
    if (r.matchType === 'regex') {
      try {
        if (new RegExp(r.pattern, 'i').test(description)) return r;
      } catch {
        // skip invalid regex
      }
    }
  }
  return null;
}
```

- [ ] **Step 5: Run test (expect pass)**

Run:
```bash
pnpm --filter @perfin/core test
```
Expected: 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core
git commit -m "feat(core): rule matcher (contains/exact/regex with priority)"
```

---

## Task 6: Seed rules (port `merchant_rules.json`)

**Files:**
- Create: `packages/core/src/categorize/seed-rules.ts`

- [ ] **Step 1: Inspect the legacy rules**

Run:
```bash
jq 'length' _legacy/ai_accountant/rules/merchant_rules.json
```
Expected: a number around 41 (the rules array length). The file is a list of `{keywords: string[], category: string, priority: number}` objects.

- [ ] **Step 2: Create `packages/core/src/categorize/seed-rules.ts`**

Translate every keyword in the legacy rules into a separate `Rule` with `matchType: 'contains'`. Read the JSON manually and produce the array below:

```ts
import type { Rule } from './types';

// Ported from _legacy/ai_accountant/rules/merchant_rules.json (read once at build time).
// Each {keywords[], category, priority} entry becomes one Rule per keyword.
export const SEED_RULES: Rule[] = [
  // priority 10 — Income / Investment
  { priority: 10, matchType: 'contains', pattern: 'salary',          category: 'Income' },
  { priority: 10, matchType: 'contains', pattern: 'payroll',         category: 'Income' },
  { priority: 10, matchType: 'contains', pattern: 'direct deposit',  category: 'Income' },
  { priority: 10, matchType: 'contains', pattern: 'paycheck',        category: 'Income' },
  { priority: 10, matchType: 'contains', pattern: 'refund',          category: 'Income' },
  { priority: 10, matchType: 'contains', pattern: 'reimbursement',   category: 'Income' },
  { priority: 10, matchType: 'contains', pattern: 'cashback',        category: 'Income' },
  { priority: 10, matchType: 'contains', pattern: 'interest',        category: 'Investment' },
  { priority: 10, matchType: 'contains', pattern: 'dividend',        category: 'Investment' },
  { priority: 10, matchType: 'contains', pattern: 'capital gain',    category: 'Investment' },

  // priority 9 — high-confidence merchants
  { priority: 9, matchType: 'contains', pattern: 'swiggy',         category: 'Food' },
  { priority: 9, matchType: 'contains', pattern: 'zomato',         category: 'Food' },
  { priority: 9, matchType: 'contains', pattern: 'ubereats',       category: 'Food' },
  { priority: 9, matchType: 'contains', pattern: 'doordash',       category: 'Food' },
  { priority: 9, matchType: 'contains', pattern: 'grubhub',        category: 'Food' },
  { priority: 9, matchType: 'contains', pattern: 'restaurant',     category: 'Food' },
  { priority: 9, matchType: 'contains', pattern: 'cafe',           category: 'Food' },
  { priority: 9, matchType: 'contains', pattern: 'coffee',         category: 'Food' },
  { priority: 9, matchType: 'contains', pattern: 'starbucks',      category: 'Food' },
  { priority: 9, matchType: 'contains', pattern: 'mcdonald',       category: 'Food' },
  { priority: 9, matchType: 'contains', pattern: 'pizza',          category: 'Food' },
  { priority: 9, matchType: 'contains', pattern: 'walmart',        category: 'Groceries' },
  { priority: 9, matchType: 'contains', pattern: 'target',         category: 'Groceries' },
  { priority: 9, matchType: 'contains', pattern: 'costco',         category: 'Groceries' },
  { priority: 9, matchType: 'contains', pattern: 'whole foods',    category: 'Groceries' },
  { priority: 9, matchType: 'contains', pattern: 'trader joe',     category: 'Groceries' },
  { priority: 9, matchType: 'contains', pattern: 'blinkit',        category: 'Groceries' },
  { priority: 9, matchType: 'contains', pattern: 'uber',           category: 'Transport' },
  { priority: 9, matchType: 'contains', pattern: 'lyft',           category: 'Transport' },
  { priority: 9, matchType: 'contains', pattern: 'ola',            category: 'Transport' },
  { priority: 9, matchType: 'contains', pattern: 'rapido',         category: 'Transport' },
  { priority: 9, matchType: 'contains', pattern: 'netflix',        category: 'Subscription' },
  { priority: 9, matchType: 'contains', pattern: 'spotify',        category: 'Subscription' },
  { priority: 9, matchType: 'contains', pattern: 'youtube premium',category: 'Subscription' },
  { priority: 9, matchType: 'contains', pattern: 'icloud',         category: 'Subscription' },
  { priority: 9, matchType: 'contains', pattern: 'amazon prime',   category: 'Subscription' },
  { priority: 9, matchType: 'contains', pattern: 'disney',         category: 'Subscription' },

  // priority 8 — generic
  { priority: 8, matchType: 'contains', pattern: 'grocery',        category: 'Groceries' },
  { priority: 8, matchType: 'contains', pattern: 'supermarket',    category: 'Groceries' },
  { priority: 8, matchType: 'contains', pattern: 'gas station',    category: 'Transport' },
  { priority: 8, matchType: 'contains', pattern: 'shell',          category: 'Transport' },
  { priority: 8, matchType: 'contains', pattern: 'metro',          category: 'Transport' },
  { priority: 8, matchType: 'contains', pattern: 'electricity',    category: 'Utilities' },
  { priority: 8, matchType: 'contains', pattern: 'water bill',     category: 'Utilities' },
  { priority: 8, matchType: 'contains', pattern: 'internet',       category: 'Utilities' },
  { priority: 8, matchType: 'contains', pattern: 'mobile recharge',category: 'Utilities' },
  { priority: 8, matchType: 'contains', pattern: 'jio',            category: 'Utilities' },
  { priority: 8, matchType: 'contains', pattern: 'airtel',         category: 'Utilities' },
  { priority: 8, matchType: 'contains', pattern: 'pharmacy',       category: 'Medical' },
  { priority: 8, matchType: 'contains', pattern: 'hospital',       category: 'Medical' },
  { priority: 8, matchType: 'contains', pattern: 'doctor',         category: 'Medical' },
  { priority: 8, matchType: 'contains', pattern: 'apollo',         category: 'Medical' },
  { priority: 8, matchType: 'contains', pattern: 'flight',         category: 'Travel' },
  { priority: 8, matchType: 'contains', pattern: 'airline',        category: 'Travel' },
  { priority: 8, matchType: 'contains', pattern: 'hotel',          category: 'Travel' },
  { priority: 8, matchType: 'contains', pattern: 'airbnb',         category: 'Travel' },
  { priority: 8, matchType: 'contains', pattern: 'makemytrip',     category: 'Travel' },
  { priority: 8, matchType: 'contains', pattern: 'amazon',         category: 'Shopping' },
  { priority: 8, matchType: 'contains', pattern: 'flipkart',       category: 'Shopping' },
  { priority: 8, matchType: 'contains', pattern: 'myntra',         category: 'Shopping' },
  { priority: 8, matchType: 'contains', pattern: 'rent',           category: 'Rent' },
  { priority: 8, matchType: 'contains', pattern: 'lic',            category: 'Insurance' },
  { priority: 8, matchType: 'contains', pattern: 'insurance',      category: 'Insurance' },

  // priority 5 — fallbacks
  { priority: 5, matchType: 'contains', pattern: 'transfer',       category: 'Transfer' },
  { priority: 5, matchType: 'contains', pattern: 'imps',           category: 'Transfer' },
  { priority: 5, matchType: 'contains', pattern: 'neft',           category: 'Transfer' },
  { priority: 5, matchType: 'contains', pattern: 'upi',            category: 'Transfer' },
];
```

- [ ] **Step 3: Verify it loads and matches**

Add a smoke test inline at the bottom of `packages/core/tests/rules.test.ts`:

```ts
import { SEED_RULES } from '../src/categorize/seed-rules';

describe('SEED_RULES', () => {
  it('has at least 50 entries', () => {
    expect(SEED_RULES.length).toBeGreaterThanOrEqual(50);
  });
  it('categorizes Swiggy as Food', () => {
    const r = SEED_RULES.find(rr => rr.pattern === 'swiggy');
    expect(r?.category).toBe('Food');
  });
});
```

Run:
```bash
pnpm --filter @perfin/core test
```
Expected: all tests still pass, including 2 new ones.

- [ ] **Step 4: Commit**

```bash
git add packages/core
git commit -m "feat(core): seed rules ported from legacy merchant_rules.json"
```

---

## Task 7: Claude categorization wrapper

**Files:**
- Create: `packages/core/src/categorize/claude.ts`

- [ ] **Step 1: Create `packages/core/src/categorize/claude.ts`**

```ts
import Anthropic from '@anthropic-ai/sdk';
import { CATEGORIES, type Category, isCategory } from '../categories';

const SYSTEM = [
  'You are a transaction categorizer for a personal-finance app.',
  'Given a list of transaction descriptions, return one category per row.',
  'You must pick from this exact list:',
  CATEGORIES.join(', '),
  'If unsure, return "Needs Review". Never invent new categories.',
  'Reply ONLY with a JSON array of {index, category} objects, nothing else.',
].join('\n');

export interface ClaudeCategorizer {
  categorize(descriptions: string[]): Promise<Category[]>;
}

export interface ClaudeOptions {
  apiKey: string;
  model?: string;
  maxBatch?: number;
}

export function createClaudeCategorizer(opts: ClaudeOptions): ClaudeCategorizer {
  const client = new Anthropic({ apiKey: opts.apiKey });
  const model = opts.model ?? 'claude-haiku-4-5-20251001';
  const maxBatch = opts.maxBatch ?? 50;

  return {
    async categorize(descriptions) {
      const out: Category[] = [];
      for (let i = 0; i < descriptions.length; i += maxBatch) {
        const slice = descriptions.slice(i, i + maxBatch);
        const userBlock = slice
          .map((d, idx) => `${idx}. ${d}`)
          .join('\n');
        const resp = await client.messages.create({
          model,
          max_tokens: 1024,
          system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: userBlock }],
        });
        const text = resp.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('');
        const parsed = parseResponse(text, slice.length);
        out.push(...parsed);
      }
      return out;
    },
  };
}

function parseResponse(text: string, expected: number): Category[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return Array(expected).fill('Needs Review' as Category);
  try {
    const arr = JSON.parse(match[0]) as Array<{ index: number; category: string }>;
    const out: Category[] = Array(expected).fill('Needs Review' as Category);
    for (const item of arr) {
      if (item.index >= 0 && item.index < expected && isCategory(item.category)) {
        out[item.index] = item.category;
      }
    }
    return out;
  } catch {
    return Array(expected).fill('Needs Review' as Category);
  }
}

export const __test = { parseResponse };
```

- [ ] **Step 2: Add a parser-only test (no live API call)**

Append to `packages/core/tests/rules.test.ts`:

```ts
import { __test as claudeTest } from '../src/categorize/claude';

describe('Claude response parser', () => {
  it('parses a clean JSON array', () => {
    const out = claudeTest.parseResponse(
      '[{"index":0,"category":"Food"},{"index":1,"category":"Transport"}]',
      2,
    );
    expect(out).toEqual(['Food', 'Transport']);
  });
  it('falls back to Needs Review on invalid category', () => {
    const out = claudeTest.parseResponse('[{"index":0,"category":"Bogus"}]', 1);
    expect(out).toEqual(['Needs Review']);
  });
  it('handles extra prose around JSON', () => {
    const out = claudeTest.parseResponse('Here you go: [{"index":0,"category":"Food"}] cheers', 1);
    expect(out).toEqual(['Food']);
  });
  it('returns all Needs Review when nothing parses', () => {
    expect(claudeTest.parseResponse('not json', 3))
      .toEqual(['Needs Review', 'Needs Review', 'Needs Review']);
  });
});
```

Run:
```bash
pnpm --filter @perfin/core test
```
Expected: 4 new tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/core
git commit -m "feat(core): Claude categorizer (Haiku 4.5, prompt cache, batch + JSON parse)"
```

---

## Task 8: Categorization orchestrator

**Files:**
- Create: `packages/core/src/categorize/orchestrate.ts`
- Create: `packages/core/tests/orchestrate.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/core/tests/orchestrate.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { categorizeAll } from '../src/categorize/orchestrate';
import { SEED_RULES } from '../src/categorize/seed-rules';

describe('categorizeAll', () => {
  it('rule-matches first; calls LLM only for the rest', async () => {
    const llm = { categorize: vi.fn().mockResolvedValue(['Other']) };
    const out = await categorizeAll(
      ['Swiggy Bangalore', 'Some Mystery Vendor'],
      { rules: SEED_RULES, llm },
    );
    expect(out[0]).toEqual({ category: 'Food', source: 'rule', confidence: 1, reason: expect.any(String) });
    expect(out[1]).toEqual({ category: 'Other', source: 'llm', confidence: 0.7 });
    expect(llm.categorize).toHaveBeenCalledTimes(1);
    expect(llm.categorize).toHaveBeenCalledWith(['Some Mystery Vendor']);
  });

  it('falls back to Needs Review if no rule and no LLM', async () => {
    const out = await categorizeAll(['Mystery'], { rules: [], llm: null });
    expect(out[0]).toEqual({ category: 'Needs Review', source: 'default', confidence: 0 });
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/core test
```
Expected: fails.

- [ ] **Step 3: Create `packages/core/src/categorize/orchestrate.ts`**

```ts
import type { Category } from '../categories';
import { matchRule, type Rule } from './rules';
import type { CategorizationResult } from './types';

export interface LlmCategorizer {
  categorize(descriptions: string[]): Promise<Category[]>;
}

export interface OrchestrateOptions {
  rules: Rule[];
  llm: LlmCategorizer | null;
}

export async function categorizeAll(
  descriptions: string[],
  opts: OrchestrateOptions,
): Promise<CategorizationResult[]> {
  const out: (CategorizationResult | null)[] = descriptions.map(() => null);
  const remainder: { idx: number; description: string }[] = [];

  for (let i = 0; i < descriptions.length; i++) {
    const desc = descriptions[i]!;
    const rule = matchRule(desc, opts.rules);
    if (rule) {
      out[i] = {
        category: rule.category,
        source: 'rule',
        confidence: 1,
        reason: `matched ${rule.matchType} rule "${rule.pattern}"`,
      };
    } else {
      remainder.push({ idx: i, description: desc });
    }
  }

  if (remainder.length && opts.llm) {
    const llmCats = await opts.llm.categorize(remainder.map((r) => r.description));
    for (let j = 0; j < remainder.length; j++) {
      out[remainder[j]!.idx] = {
        category: llmCats[j] ?? 'Needs Review',
        source: 'llm',
        confidence: 0.7,
      };
    }
  }

  for (let i = 0; i < out.length; i++) {
    if (!out[i]) {
      out[i] = { category: 'Needs Review', source: 'default', confidence: 0 };
    }
  }

  return out as CategorizationResult[];
}
```

- [ ] **Step 4: Update `packages/core/src/index.ts`**

```ts
export * from './money';
export * from './text';
export * from './categories';
export * from './normalize';
export * from './categorize/types';
export * from './categorize/rules';
export * from './categorize/seed-rules';
export * from './categorize/claude';
export * from './categorize/orchestrate';
```

- [ ] **Step 5: Run test (expect pass)**

Run:
```bash
pnpm --filter @perfin/core test
```
Expected: 2 new tests pass; total ~28 tests across `@perfin/core`.

- [ ] **Step 6: Commit**

```bash
git add packages/core
git commit -m "feat(core): categorization orchestrator (rules → LLM → default)"
```

---

## Task 9: Add `@perfin/extractors` package

**Files:**
- Create: `packages/extractors/package.json`, `tsconfig.json`, `vitest.config.ts`
- Create: `packages/extractors/src/index.ts`, `src/types.ts`

- [ ] **Step 1: Create `packages/extractors/package.json`**

```json
{
  "name": "@perfin/extractors",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@perfin/core": "workspace:*",
    "csv-parse": "5.5.6",
    "pdfjs-dist": "4.7.76",
    "xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"
  },
  "devDependencies": {
    "@perfin/config": "workspace:*",
    "@types/node": "22.9.0",
    "typescript": "5.6.3",
    "vitest": "2.1.4"
  }
}
```

- [ ] **Step 2: Create `packages/extractors/tsconfig.json`**

```json
{
  "extends": "@perfin/config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "noEmit": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Create `packages/extractors/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', globals: true },
});
```

- [ ] **Step 4: Create `packages/extractors/src/types.ts`**

```ts
import type { RawRow } from '@perfin/core';

export interface ExtractInput {
  buffer: Buffer;
  fileName: string;
  password?: string;
}

export interface ExtractResult {
  rows: RawRow[];
  bank?: string;          // detected bank format, e.g. "hdfc"
  warnings: string[];
}

export type Extractor = (input: ExtractInput) => Promise<ExtractResult>;
```

- [ ] **Step 5: Create `packages/extractors/src/index.ts`**

```ts
export type * from './types';
export { extractCsv } from './csv';
export { extractExcel } from './excel';
export { extractPdf } from './pdf';
export { detectExtractor } from './detect';
```

- [ ] **Step 6: Install + commit**

Run:
```bash
pnpm install
git add packages/extractors pnpm-lock.yaml
git commit -m "chore(extractors): scaffold @perfin/extractors package"
```

---

## Task 10: CSV extractor

**Files:**
- Create: `packages/extractors/src/csv.ts`
- Create: `packages/extractors/tests/fixtures/basic.csv`
- Create: `packages/extractors/tests/csv.test.ts`

- [ ] **Step 1: Create `packages/extractors/tests/fixtures/basic.csv`**

```csv
Date,Description,Amount
2026-04-01,Whole Foods Market,-84.20
2026-04-02,Salary Acme Corp,6800.00
2026-04-02,Spotify,-10.99
```

- [ ] **Step 2: Write failing test**

Create `packages/extractors/tests/csv.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { extractCsv } from '../src/csv';

const fixture = (name: string) => resolve(__dirname, 'fixtures', name);

describe('extractCsv', () => {
  it('parses a simple Date/Description/Amount CSV', async () => {
    const buffer = await readFile(fixture('basic.csv'));
    const out = await extractCsv({ buffer, fileName: 'basic.csv' });
    expect(out.rows).toHaveLength(3);
    expect(out.rows[0]).toMatchObject({
      date: '2026-04-01',
      description: 'Whole Foods Market',
      amount: -84.2,
      sourceFile: 'basic.csv',
    });
    expect(out.rows[1]?.amount).toBe(6800);
  });

  it('detects header columns regardless of case', async () => {
    const buffer = Buffer.from('date,description,amount\n2026-01-01,X,1.50\n');
    const out = await extractCsv({ buffer, fileName: 't.csv' });
    expect(out.rows[0]?.amount).toBe(1.5);
  });

  it('reports a warning when a column is missing', async () => {
    const buffer = Buffer.from('Date,Description\n2026-01-01,X\n');
    const out = await extractCsv({ buffer, fileName: 't.csv' });
    expect(out.warnings.some((w) => /amount/i.test(w))).toBe(true);
    expect(out.rows).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/extractors test
```
Expected: fails.

- [ ] **Step 4: Create `packages/extractors/src/csv.ts`**

```ts
import { parse } from 'csv-parse/sync';
import type { Extractor, ExtractResult } from './types';

const DATE_KEYS        = ['date', 'transaction date', 'txn date', 'posted'];
const DESC_KEYS        = ['description', 'narration', 'particulars', 'details', 'memo'];
const AMOUNT_KEYS      = ['amount', 'amt', 'value'];
const DEBIT_KEYS       = ['debit', 'withdrawal'];
const CREDIT_KEYS      = ['credit', 'deposit'];

function findKey(header: string[], candidates: string[]): string | null {
  for (const c of candidates) {
    const found = header.find((h) => h.toLowerCase().trim() === c);
    if (found) return found;
  }
  return null;
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[,\s₹$€£]/g, '').replace(/\((.*)\)/, '-$1');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

export const extractCsv: Extractor = async ({ buffer, fileName }): Promise<ExtractResult> => {
  const records = parse(buffer, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  const warnings: string[] = [];
  if (!records.length) return { rows: [], warnings: ['empty CSV'] };

  const header = Object.keys(records[0]!);
  const dateKey = findKey(header, DATE_KEYS);
  const descKey = findKey(header, DESC_KEYS);
  const amountKey = findKey(header, AMOUNT_KEYS);
  const debitKey  = findKey(header, DEBIT_KEYS);
  const creditKey = findKey(header, CREDIT_KEYS);

  if (!dateKey) { warnings.push('no date column found'); return { rows: [], warnings }; }
  if (!descKey) { warnings.push('no description column found'); return { rows: [], warnings }; }
  if (!amountKey && !debitKey && !creditKey) {
    warnings.push('no amount/debit/credit column found');
    return { rows: [], warnings };
  }

  const rows = records
    .map((r) => {
      const date = r[dateKey] ?? '';
      const description = r[descKey] ?? '';
      let amount: number;
      if (amountKey) {
        amount = parseAmount(r[amountKey] ?? '');
      } else {
        const debit  = debitKey  ? parseAmount(r[debitKey]  ?? '0') : 0;
        const credit = creditKey ? parseAmount(r[creditKey] ?? '0') : 0;
        amount = (Number.isFinite(credit) ? credit : 0) - (Number.isFinite(debit) ? debit : 0);
      }
      if (!Number.isFinite(amount)) return null;
      return { date, description, amount, sourceFile: fileName, account: null };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return { rows, warnings };
};
```

- [ ] **Step 5: Run test (expect pass)**

Run:
```bash
pnpm --filter @perfin/extractors test
```
Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/extractors
git commit -m "feat(extractors): CSV extractor with header sniffing + debit/credit columns"
```

---

## Task 11: Excel extractor

**Files:**
- Create: `packages/extractors/src/excel.ts`
- Create: `packages/extractors/tests/excel.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/extractors/tests/excel.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { extractExcel } from '../src/excel';

function makeXlsx(rows: unknown[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('extractExcel', () => {
  it('reads a simple statement sheet', async () => {
    const buffer = makeXlsx([
      ['Date', 'Description', 'Amount'],
      ['2026-04-01', 'Whole Foods', -84.2],
      ['2026-04-02', 'Salary', 6800],
    ]);
    const out = await extractExcel({ buffer, fileName: 't.xlsx' });
    expect(out.rows).toHaveLength(2);
    expect(out.rows[0]?.amount).toBe(-84.2);
  });

  it('handles debit/credit columns', async () => {
    const buffer = makeXlsx([
      ['Date', 'Narration', 'Debit', 'Credit'],
      ['2026-04-01', 'Whole Foods', 84.2, 0],
      ['2026-04-02', 'Salary', 0, 6800],
    ]);
    const out = await extractExcel({ buffer, fileName: 't.xlsx' });
    expect(out.rows[0]?.amount).toBe(-84.2);
    expect(out.rows[1]?.amount).toBe(6800);
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/extractors test
```
Expected: fails.

- [ ] **Step 3: Create `packages/extractors/src/excel.ts`**

```ts
import * as XLSX from 'xlsx';
import { extractCsv } from './csv';
import type { Extractor, ExtractResult } from './types';

export const extractExcel: Extractor = async ({ buffer, fileName }): Promise<ExtractResult> => {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) return { rows: [], warnings: ['empty workbook'] };
  const sheet = wb.Sheets[firstSheet]!;
  const csv = XLSX.utils.sheet_to_csv(sheet);
  return extractCsv({ buffer: Buffer.from(csv), fileName });
};
```

- [ ] **Step 4: Run test (expect pass)**

Run:
```bash
pnpm --filter @perfin/extractors test
```
Expected: 2 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/extractors
git commit -m "feat(extractors): Excel extractor (delegates to csv after sheet→csv)"
```

---

## Task 12: PDF extractor (text-based PDFs)

**Files:**
- Create: `packages/extractors/src/pdf.ts`
- Create: `packages/extractors/tests/pdf.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/extractors/tests/pdf.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { extractPdf } from '../src/pdf';

describe('extractPdf', () => {
  it('returns structured warning for non-PDF buffer', async () => {
    const out = await extractPdf({ buffer: Buffer.from('not a pdf'), fileName: 'x.pdf' });
    expect(out.rows).toEqual([]);
    expect(out.warnings.length).toBeGreaterThan(0);
  });

  it('returns rows for a real PDF when fixture is available', async () => {
    // Smoke-only: in CI we point this at a small statement PDF via env var.
    const path = process.env.PDF_FIXTURE_PATH;
    if (!path) return;
    const { readFile } = await import('node:fs/promises');
    const buffer = await readFile(path);
    const out = await extractPdf({ buffer, fileName: path });
    expect(out.rows.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/extractors test
```
Expected: fails.

- [ ] **Step 3: Create `packages/extractors/src/pdf.ts`**

```ts
import type { Extractor, ExtractResult } from './types';
import { detectBank, applyBank } from './banks';

export const extractPdf: Extractor = async ({ buffer, fileName, password }): Promise<ExtractResult> => {
  const warnings: string[] = [];
  let lines: string[] = [];

  try {
    // Use the legacy build (no DOM dependency)
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs') as typeof import('pdfjs-dist');
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      password,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    const doc = await loadingTask.promise;
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      // Group items by their y coord into lines
      const lineMap = new Map<number, string[]>();
      for (const item of content.items as Array<{ str: string; transform: number[] }>) {
        const y = Math.round(item.transform[5]!);
        const existing = lineMap.get(y) ?? [];
        existing.push(item.str);
        lineMap.set(y, existing);
      }
      const sorted = Array.from(lineMap.entries()).sort(([a], [b]) => b - a);
      for (const [, parts] of sorted) {
        const line = parts.join(' ').replace(/\s+/g, ' ').trim();
        if (line) lines.push(line);
      }
    }
  } catch (err) {
    warnings.push(`PDF parse error: ${err instanceof Error ? err.message : String(err)}`);
    return { rows: [], warnings };
  }

  if (!lines.length) {
    warnings.push('no text in PDF (possibly scanned image — OCR not implemented yet)');
    return { rows: [], warnings };
  }

  const bank = detectBank(lines);
  const result = applyBank(lines, fileName, bank);
  return { rows: result.rows, bank: result.bank, warnings: [...warnings, ...result.warnings] };
};
```

- [ ] **Step 4: Create stub `packages/extractors/src/banks/index.ts` (so pdf.ts imports resolve)**

```ts
import type { ExtractResult } from '../types';

export interface BankResult extends ExtractResult {
  bank?: string;
}

export function detectBank(_lines: string[]): string | null {
  return null;
}

export function applyBank(_lines: string[], _fileName: string, _bank: string | null): BankResult {
  return { rows: [], warnings: ['no bank format matched (Phase 1 ships HDFC only)'] };
}
```

- [ ] **Step 5: Run test (expect pass for the Buffer-from-text case)**

Run:
```bash
pnpm --filter @perfin/extractors test
```
Expected: 1 test passes (the negative-input case). The PDF-fixture test is auto-skipped without `PDF_FIXTURE_PATH`.

- [ ] **Step 6: Commit**

```bash
git add packages/extractors
git commit -m "feat(extractors): PDF text extraction via pdfjs (legacy build)"
```

---

## Task 13: HDFC bank-format heuristic

**Files:**
- Create: `packages/extractors/src/banks/hdfc.ts`
- Modify: `packages/extractors/src/banks/index.ts`
- Create: `packages/extractors/tests/fixtures/hdfc-sample.txt`
- Create: `packages/extractors/tests/hdfc.test.ts`

- [ ] **Step 1: Create `packages/extractors/tests/fixtures/hdfc-sample.txt`**

```
HDFC BANK
Statement of account 01/04/2026 to 30/04/2026
Date           Narration                                        Withdrawal     Deposit       Balance
01/04/2026     UPI/HDFC0000123/swiggy                            450.00                      12,550.00
02/04/2026     SALARY ACME CORP                                                 80,000.00    92,550.00
03/04/2026     POS XXXX1234 STARBUCKS                            350.00                      92,200.00
```

- [ ] **Step 2: Write failing test**

Create `packages/extractors/tests/hdfc.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { detectBank, applyBank } from '../src/banks';

const fixture = (name: string) => resolve(__dirname, 'fixtures', name);

async function loadLines(name: string): Promise<string[]> {
  const text = await readFile(fixture(name), 'utf8');
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

describe('HDFC parser', () => {
  it('detects HDFC from header', async () => {
    const lines = await loadLines('hdfc-sample.txt');
    expect(detectBank(lines)).toBe('hdfc');
  });

  it('applies HDFC parser, signs amounts correctly', async () => {
    const lines = await loadLines('hdfc-sample.txt');
    const out = applyBank(lines, 'apr.pdf', 'hdfc');
    expect(out.bank).toBe('hdfc');
    expect(out.rows).toHaveLength(3);
    expect(out.rows[0]).toMatchObject({ date: '01/04/2026', amount: -450 });
    expect(out.rows[1]).toMatchObject({ date: '02/04/2026', amount: 80000 });
    expect(out.rows[2]).toMatchObject({ date: '03/04/2026', amount: -350 });
  });
});
```

- [ ] **Step 3: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/extractors test
```
Expected: fails.

- [ ] **Step 4: Create `packages/extractors/src/banks/hdfc.ts`**

```ts
import type { ExtractResult } from '../types';

const ROW = /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s{2,}([\d,]+\.\d{2})?\s*([\d,]+\.\d{2})?\s*[\d,]+\.\d{2}$/;

function num(s: string | undefined): number {
  if (!s) return 0;
  return Number(s.replace(/,/g, ''));
}

export function isHdfc(lines: string[]): boolean {
  return lines.some((l) => /^HDFC BANK/i.test(l));
}

export function parseHdfc(lines: string[], fileName: string): ExtractResult {
  const warnings: string[] = [];
  const rows = [];
  for (const line of lines) {
    const m = ROW.exec(line);
    if (!m) continue;
    const [, date, narration, withdrawal, deposit] = m;
    const amount = num(deposit) - num(withdrawal);
    if (!amount) continue;
    rows.push({
      date: date!,
      description: narration!.trim(),
      amount,
      sourceFile: fileName,
      account: null,
    });
  }
  if (!rows.length) warnings.push('HDFC parser found no rows');
  return { rows, warnings };
}
```

- [ ] **Step 5: Update `packages/extractors/src/banks/index.ts`**

```ts
import type { ExtractResult } from '../types';
import { isHdfc, parseHdfc } from './hdfc';

export interface BankResult extends ExtractResult {
  bank?: string;
}

export function detectBank(lines: string[]): string | null {
  if (isHdfc(lines)) return 'hdfc';
  return null;
}

export function applyBank(lines: string[], fileName: string, bank: string | null): BankResult {
  if (bank === 'hdfc') return { ...parseHdfc(lines, fileName), bank };
  return { rows: [], warnings: ['no bank format matched (Phase 1 ships HDFC only)'] };
}
```

- [ ] **Step 6: Run test (expect pass)**

Run:
```bash
pnpm --filter @perfin/extractors test
```
Expected: 2 new tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/extractors
git commit -m "feat(extractors): HDFC PDF parser (proves bank-heuristic pattern)"
```

---

## Task 14: Mime detection / dispatch

**Files:**
- Create: `packages/extractors/src/detect.ts`
- Create: `packages/extractors/tests/detect.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/extractors/tests/detect.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { detectExtractor } from '../src/detect';
import { extractCsv } from '../src/csv';
import { extractExcel } from '../src/excel';
import { extractPdf } from '../src/pdf';

describe('detectExtractor', () => {
  it('csv by extension', () => {
    expect(detectExtractor({ buffer: Buffer.from(''), fileName: 'a.csv' })).toBe(extractCsv);
  });
  it('xlsx by extension', () => {
    expect(detectExtractor({ buffer: Buffer.from(''), fileName: 'a.xlsx' })).toBe(extractExcel);
  });
  it('pdf by magic bytes', () => {
    expect(detectExtractor({ buffer: Buffer.from('%PDF-1.4'), fileName: 'unknown' })).toBe(extractPdf);
  });
  it('returns null on unknown', () => {
    expect(detectExtractor({ buffer: Buffer.from('???'), fileName: 'a.bin' })).toBe(null);
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/extractors test
```
Expected: fails.

- [ ] **Step 3: Create `packages/extractors/src/detect.ts`**

```ts
import type { Extractor, ExtractInput } from './types';
import { extractCsv } from './csv';
import { extractExcel } from './excel';
import { extractPdf } from './pdf';

export function detectExtractor(input: ExtractInput): Extractor | null {
  const lower = input.fileName.toLowerCase();
  if (lower.endsWith('.csv')) return extractCsv;
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return extractExcel;
  if (lower.endsWith('.pdf')) return extractPdf;

  if (input.buffer.subarray(0, 4).toString('ascii') === '%PDF') return extractPdf;
  if (input.buffer.subarray(0, 2).toString('hex') === '504b') return extractExcel; // zip = xlsx
  return null;
}
```

- [ ] **Step 4: Run test (expect pass)**

Run:
```bash
pnpm --filter @perfin/extractors test
```
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/extractors
git commit -m "feat(extractors): mime/extension dispatch"
```

---

## Task 15: Worker — HMAC verification helper

**Files:**
- Create: `apps/worker/src/lib/hmac.ts`
- Create: `apps/worker/tests/hmac.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/worker/tests/hmac.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { sign, verify } from '../src/lib/hmac';

describe('hmac', () => {
  it('sign and verify round-trip', () => {
    const sig = sign('secret', 'hello');
    expect(verify('secret', 'hello', sig)).toBe(true);
  });
  it('rejects tampered body', () => {
    const sig = sign('secret', 'hello');
    expect(verify('secret', 'hello!', sig)).toBe(false);
  });
  it('rejects wrong secret', () => {
    const sig = sign('secret', 'hello');
    expect(verify('other', 'hello', sig)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/worker test
```
Expected: fails.

- [ ] **Step 3: Create `apps/worker/src/lib/hmac.ts`**

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export function sign(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export function verify(secret: string, body: string, signature: string): boolean {
  const expected = sign(secret, body);
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}
```

- [ ] **Step 4: Run test (expect pass)**

Run:
```bash
pnpm --filter @perfin/worker test
```
Expected: 3 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/worker
git commit -m "feat(worker): HMAC sign/verify helper for web→worker calls"
```

---

## Task 16: Worker — job registry + SSE emitter

**Files:**
- Create: `apps/worker/src/lib/jobs.ts`
- Modify: `apps/worker/src/env.ts` (add `UPLOAD_DIR`)
- Modify: `apps/worker/package.json` (add `@perfin/core`, `@perfin/extractors`, `@perfin/db`, `drizzle-orm`)

- [ ] **Step 1: Update `apps/worker/package.json` dependencies**

Replace `dependencies` section with:

```json
"dependencies": {
  "@perfin/core": "workspace:*",
  "@perfin/db": "workspace:*",
  "@perfin/extractors": "workspace:*",
  "drizzle-orm": "0.36.0",
  "fastify": "5.1.0",
  "zod": "3.23.8"
}
```

Run:
```bash
pnpm install
```
Expected: workspaces linked.

- [ ] **Step 2: Modify `apps/worker/src/env.ts`**

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
});

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  WORKER_PORT: process.env.WORKER_PORT,
  WORKER_HMAC_SECRET: process.env.WORKER_HMAC_SECRET,
  UPLOAD_DIR: process.env.UPLOAD_DIR,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
});
```

- [ ] **Step 3: Create `apps/worker/src/lib/jobs.ts`**

```ts
import { EventEmitter } from 'node:events';

export type JobStatus = 'queued' | 'extracting' | 'categorizing' | 'inserting' | 'done' | 'failed';

export interface JobEvent {
  status: JobStatus;
  message?: string;
  extractedCount?: number;
  insertedCount?: number;
  error?: string;
}

interface JobState {
  id: number;
  events: JobEvent[];
  emitter: EventEmitter;
  done: boolean;
}

const jobs = new Map<number, JobState>();

export function createJob(id: number): void {
  jobs.set(id, { id, events: [], emitter: new EventEmitter(), done: false });
}

export function emit(id: number, event: JobEvent): void {
  const state = jobs.get(id);
  if (!state) return;
  state.events.push(event);
  state.emitter.emit('event', event);
  if (event.status === 'done' || event.status === 'failed') state.done = true;
}

export function subscribe(id: number, listener: (e: JobEvent) => void): () => void {
  const state = jobs.get(id);
  if (!state) return () => undefined;
  for (const evt of state.events) listener(evt);
  state.emitter.on('event', listener);
  return () => state.emitter.off('event', listener);
}

export function isDone(id: number): boolean {
  return jobs.get(id)?.done ?? false;
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/worker
git commit -m "feat(worker): in-memory job registry, env additions for upload pipeline"
```

---

## Task 17: Worker — pipeline (extract → normalize → categorize → insert)

**Files:**
- Create: `apps/worker/src/lib/pipeline.ts`
- Create: `apps/worker/tests/pipeline.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/worker/tests/pipeline.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { runPipeline } from '../src/lib/pipeline';

describe('runPipeline', () => {
  it('extracts → normalizes → categorizes → returns row count (no DB write in unit test)', async () => {
    const csv = Buffer.from(
      'Date,Description,Amount\n2026-04-01,Swiggy Bangalore,-450\n2026-04-02,Salary,80000\n',
    );
    const out = await runPipeline({
      buffer: csv,
      fileName: 'apr.csv',
      userId: 1,
      uploadJobId: 0,
      writeToDb: false,
    });
    expect(out.extracted).toBe(2);
    expect(out.normalized).toBe(2);
    expect(out.categorized[0]?.category).toBe('Food');
    expect(out.categorized[1]?.category).toBe('Income');
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/worker test
```
Expected: fails.

- [ ] **Step 3: Create `apps/worker/src/lib/pipeline.ts`**

```ts
import { createDb, transactions, type Db } from '@perfin/db';
import {
  categorizeAll,
  createClaudeCategorizer,
  normalizeRow,
  SEED_RULES,
  type CategorizationResult,
  type NormalizedTxn,
} from '@perfin/core';
import { detectExtractor } from '@perfin/extractors';
import { env } from '../env.js';
import { emit } from './jobs.js';

export interface PipelineInput {
  buffer: Buffer;
  fileName: string;
  userId: number;
  uploadJobId: number;
  writeToDb?: boolean;
  db?: Db;
}

export interface PipelineOutput {
  extracted: number;
  normalized: number;
  inserted: number;
  warnings: string[];
  categorized: CategorizationResult[];
  rows: NormalizedTxn[];
}

export async function runPipeline(input: PipelineInput): Promise<PipelineOutput> {
  const { buffer, fileName, userId, uploadJobId, writeToDb = true } = input;

  const extractor = detectExtractor({ buffer, fileName });
  if (!extractor) {
    emit(uploadJobId, { status: 'failed', error: 'unsupported file type' });
    return { extracted: 0, normalized: 0, inserted: 0, warnings: ['unsupported file type'], categorized: [], rows: [] };
  }

  emit(uploadJobId, { status: 'extracting' });
  const extracted = await extractor({ buffer, fileName });
  emit(uploadJobId, { status: 'extracting', extractedCount: extracted.rows.length });

  const rows: NormalizedTxn[] = [];
  for (const r of extracted.rows) {
    try { rows.push(normalizeRow(r)); }
    catch { /* skip rows with bad dates */ }
  }

  emit(uploadJobId, { status: 'categorizing' });
  const llm = env.ANTHROPIC_API_KEY
    ? createClaudeCategorizer({ apiKey: env.ANTHROPIC_API_KEY })
    : null;
  const categorized = await categorizeAll(
    rows.map((r) => r.description),
    { rules: SEED_RULES, llm },
  );

  let inserted = 0;
  if (writeToDb && rows.length) {
    emit(uploadJobId, { status: 'inserting' });
    const db = input.db ?? createDb(env.DATABASE_URL).db;
    const values = rows.map((r, i) => ({
      userId,
      date: r.date,
      description: r.description,
      rawDescription: r.rawDescription,
      amountCents: r.amountCents,
      category: categorized[i]!.category,
      sourceFile: r.sourceFile,
    }));
    const result = await db.insert(transactions).values(values).onConflictDoNothing().returning({ id: transactions.id });
    inserted = result.length;
  }

  emit(uploadJobId, { status: 'done', insertedCount: inserted });

  return {
    extracted: extracted.rows.length,
    normalized: rows.length,
    inserted,
    warnings: extracted.warnings,
    categorized,
    rows,
  };
}
```

- [ ] **Step 4: Run test (expect pass)**

Run:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
  pnpm --filter @perfin/worker test
```
Expected: pipeline test passes (skips DB write because `writeToDb: false`).

- [ ] **Step 5: Commit**

```bash
git add apps/worker
git commit -m "feat(worker): pipeline orchestrator (extract → normalize → categorize → insert)"
```

---

## Task 18: Worker — `/jobs/upload` route

**Files:**
- Create: `apps/worker/src/routes/upload.ts`
- Create: `apps/worker/tests/upload.test.ts`
- Modify: `apps/worker/src/server.ts` (register the route)

- [ ] **Step 1: Write failing test**

Create `apps/worker/tests/upload.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { buildServer } from '../src/server';
import { sign } from '../src/lib/hmac';

const SECRET = process.env.WORKER_HMAC_SECRET ?? 'dev-shared-secret-replace-in-prod';

describe('POST /jobs/upload', () => {
  it('rejects without signature', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'POST', url: '/jobs/upload', payload: {} });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('accepts signed payload, returns job id', async () => {
    const dir = resolve(tmpdir(), `perfin-test-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    const path = resolve(dir, 'apr.csv');
    await writeFile(path, 'Date,Description,Amount\n2026-04-01,Swiggy,-450\n');
    const body = { userId: 1, uploadJobId: 0, filePath: path, fileName: 'apr.csv' };
    const payload = JSON.stringify(body);
    const sig = sign(SECRET, payload);

    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/jobs/upload',
      headers: { 'content-type': 'application/json', 'x-perfin-sig': sig },
      payload,
    });
    expect(res.statusCode).toBe(202);
    const json = res.json();
    expect(json.accepted).toBe(true);
    await app.close();
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
  pnpm --filter @perfin/worker test
```
Expected: fails.

- [ ] **Step 3: Create `apps/worker/src/routes/upload.ts`**

```ts
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { env } from '../env.js';
import { verify } from '../lib/hmac.js';
import { createJob, emit } from '../lib/jobs.js';
import { runPipeline } from '../lib/pipeline.js';

const Body = z.object({
  userId: z.number().int().positive(),
  uploadJobId: z.number().int().nonnegative(),
  filePath: z.string().min(1),
  fileName: z.string().min(1),
});

export async function uploadRoutes(app: FastifyInstance) {
  app.post('/jobs/upload', async (req: FastifyRequest, reply) => {
    const sig = req.headers['x-perfin-sig'];
    if (typeof sig !== 'string') {
      return reply.code(401).send({ error: 'missing signature' });
    }
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!verify(env.WORKER_HMAC_SECRET, raw, sig)) {
      return reply.code(401).send({ error: 'invalid signature' });
    }

    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { userId, uploadJobId, filePath, fileName } = parsed.data;

    createJob(uploadJobId);
    emit(uploadJobId, { status: 'queued' });

    // Run async; return immediately
    void (async () => {
      try {
        const buffer = await readFile(filePath);
        await runPipeline({ buffer, fileName, userId, uploadJobId });
      } catch (err) {
        emit(uploadJobId, {
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    return reply.code(202).send({ accepted: true, uploadJobId });
  });
}
```

- [ ] **Step 4: Modify `apps/worker/src/server.ts`**

Replace contents:

```ts
import Fastify from 'fastify';
import { env } from './env.js';
import { healthRoutes } from './routes/health.js';
import { uploadRoutes } from './routes/upload.js';
import { streamRoutes } from './routes/stream.js';

export async function buildServer() {
  const app = Fastify({ logger: true });
  await app.register(healthRoutes);
  await app.register(uploadRoutes);
  await app.register(streamRoutes);
  return app;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  buildServer()
    .then((app) => app.listen({ port: env.WORKER_PORT, host: '0.0.0.0' }))
    .catch((err) => { console.error(err); process.exit(1); });
}
```

(The `streamRoutes` import will resolve in Task 19.)

- [ ] **Step 5: Stub `apps/worker/src/routes/stream.ts` to satisfy the import**

Create with placeholder:

```ts
import type { FastifyInstance } from 'fastify';
export async function streamRoutes(_app: FastifyInstance) { /* implemented in Task 19 */ }
```

- [ ] **Step 6: Run test (expect pass)**

Run:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
  pnpm --filter @perfin/worker test
```
Expected: 2 new upload tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/worker
git commit -m "feat(worker): POST /jobs/upload (HMAC verified, kicks off pipeline)"
```

---

## Task 19: Worker — `/jobs/:id/stream` SSE

**Files:**
- Modify: `apps/worker/src/routes/stream.ts`

- [ ] **Step 1: Replace contents of `apps/worker/src/routes/stream.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { isDone, subscribe } from '../lib/jobs.js';

export async function streamRoutes(app: FastifyInstance) {
  app.get('/jobs/:id/stream', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'bad id' });

    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });

    const send = (e: unknown) => {
      reply.raw.write(`data: ${JSON.stringify(e)}\n\n`);
    };

    const unsubscribe = subscribe(id, (event) => {
      send(event);
      if (event.status === 'done' || event.status === 'failed') {
        reply.raw.end();
      }
    });

    if (isDone(id)) reply.raw.end();

    req.raw.on('close', unsubscribe);
  });
}
```

- [ ] **Step 2: Smoke-test manually**

Run:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
  pnpm --filter @perfin/worker dev
```
In another shell, open `http://localhost:8001/jobs/0/stream` in a browser tab — expect a hanging connection that reports nothing (no job 0 exists yet). Stop both.

- [ ] **Step 3: Commit**

```bash
git add apps/worker
git commit -m "feat(worker): GET /jobs/:id/stream Server-Sent Events"
```

---

## Task 20: Web — React Query provider + typed fetcher + worker client

**Files:**
- Create: `apps/web/lib/query.ts`
- Create: `apps/web/lib/api.ts`
- Create: `apps/web/lib/worker.ts`
- Create: `apps/web/lib/currency.ts`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/package.json` (add `@perfin/core`, `@tanstack/react-query`, `lucide-react`)

- [ ] **Step 1: Update `apps/web/package.json` dependencies**

Add to `dependencies`:

```json
"@perfin/core": "workspace:*",
"@tanstack/react-query": "5.59.20",
"lucide-react": "0.456.0"
```

Run:
```bash
pnpm install
```

- [ ] **Step 2: Create `apps/web/lib/query.ts`**

```ts
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
    },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 3: Create `apps/web/lib/api.ts`**

```ts
export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}
```

- [ ] **Step 4: Create `apps/web/lib/worker.ts`**

```ts
import { createHmac } from 'node:crypto';

const SECRET = process.env.WORKER_HMAC_SECRET ?? '';
const BASE   = process.env.WORKER_URL ?? 'http://localhost:8001';

export async function callWorker<T>(path: string, body: unknown): Promise<T> {
  if (!SECRET) throw new Error('WORKER_HMAC_SECRET not set');
  const payload = JSON.stringify(body);
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-perfin-sig': sig },
    body: payload,
  });
  if (!res.ok) throw new Error(`worker ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}
```

- [ ] **Step 5: Create `apps/web/lib/currency.ts`**

```ts
export { formatCurrency, centsToRupees, rupeesToCents } from '@perfin/core';
```

- [ ] **Step 6: Modify `apps/web/app/layout.tsx`**

Replace contents:

```tsx
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';
import type { ReactNode } from 'react';
import { QueryProvider } from '@/lib/query';

export const metadata = {
  title: 'Perfin — your money, finally explained',
  description: 'AI-powered personal finance.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body><QueryProvider>{children}</QueryProvider></body>
    </html>
  );
}
```

- [ ] **Step 7: Update `apps/web/lib/env.ts`** to include the worker vars:

```ts
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(16),
  AUTH_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  WORKER_URL: z.string().url().default('http://localhost:8001'),
  WORKER_HMAC_SECRET: z.string().min(8),
});

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_URL: process.env.AUTH_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  WORKER_URL: process.env.WORKER_URL,
  WORKER_HMAC_SECRET: process.env.WORKER_HMAC_SECRET,
});
```

- [ ] **Step 8: Typecheck and commit**

Run:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 \
AUTH_URL=http://localhost:3000 \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
  pnpm --filter @perfin/web typecheck
```
Expected: clean.

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): React Query provider + typed fetcher + HMAC worker client"
```

---

## Task 21: Web — `POST /api/upload` route

**Files:**
- Create: `apps/web/app/api/upload/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { createDb, uploadJobs, users } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';
import { callWorker } from '@/lib/worker';

const UPLOAD_DIR = resolve(process.cwd(), '../..', 'data/uploads');
const { db } = createDb(env.DATABASE_URL);

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);

  // Confirm user exists (defense in depth)
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) return NextResponse.json({ error: 'user not found' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file required' }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'file too large (10MB max)' }, { status: 413 });

  await mkdir(UPLOAD_DIR, { recursive: true });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = resolve(UPLOAD_DIR, `${randomUUID()}-${safeName}`);
  await writeFile(path, Buffer.from(await file.arrayBuffer()));

  const [job] = await db.insert(uploadJobs).values({
    userId,
    fileName: file.name,
    mime: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    status: 'queued',
  }).returning();
  if (!job) return NextResponse.json({ error: 'job create failed' }, { status: 500 });

  await callWorker('/jobs/upload', {
    userId,
    uploadJobId: job.id,
    filePath: path,
    fileName: file.name,
  });

  return NextResponse.json({ uploadJobId: job.id });
}
```

- [ ] **Step 2: Add `data/uploads/.gitkeep`**

Run:
```bash
mkdir -p data/uploads && touch data/uploads/.gitkeep
echo 'data/uploads/' >> .gitignore
git add .gitignore data/uploads/.gitkeep
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
git add apps/web/app/api/upload
git commit -m "feat(web): POST /api/upload (auth, persist to disk, kick worker job)"
```

---

## Task 22: Web — `useTransactions` + `useAccounts` hooks

**Files:**
- Create: `apps/web/hooks/useTransactions.ts`
- Create: `apps/web/hooks/useAccounts.ts`
- Create: `apps/web/app/api/transactions/route.ts`
- Create: `apps/web/app/api/transactions/[id]/route.ts`
- Create: `apps/web/app/api/accounts/route.ts`

- [ ] **Step 1: Create `apps/web/app/api/transactions/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { and, desc, eq, gte, ilike, lte } from 'drizzle-orm';
import { createDb, transactions } from '@perfin/db';
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
  const search = url.searchParams.get('search');
  const category = url.searchParams.get('category');
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');

  const conditions = [eq(transactions.userId, userId)];
  if (category) conditions.push(eq(transactions.category, category));
  if (start) conditions.push(gte(transactions.date, start));
  if (end) conditions.push(lte(transactions.date, end));
  if (search) conditions.push(ilike(transactions.description, `%${search}%`));

  const rows = await db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.date), desc(transactions.id))
    .limit(200);

  return NextResponse.json({ rows });
}
```

- [ ] **Step 2: Create `apps/web/app/api/transactions/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { createDb, transactions } from '@perfin/db';
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
  const txnId = Number(id);

  const body = (await req.json()) as { category?: string; description?: string };
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body.category !== undefined) patch.category = body.category;
  if (body.description !== undefined) patch.description = body.description;

  await db.update(transactions)
    .set(patch)
    .where(and(eq(transactions.id, txnId), eq(transactions.userId, userId)));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Create `apps/web/app/api/accounts/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { createDb, accounts } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);

  const rows = await db.select().from(accounts).where(eq(accounts.userId, userId)).orderBy(accounts.createdAt);
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);

  const body = (await req.json()) as { name: string; bank?: string; type?: string; currency?: string; color?: string };
  if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const [row] = await db.insert(accounts).values({
    userId,
    name: body.name,
    bank: body.bank ?? '',
    type: body.type ?? 'checking',
    currency: body.currency ?? 'INR',
    color: body.color ?? '#6366f1',
  }).returning();
  return NextResponse.json({ row });
}
```

- [ ] **Step 4: Create `apps/web/hooks/useTransactions.ts`**

```ts
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { Transaction } from '@perfin/db';

export interface TxnFilters {
  search?: string;
  category?: string;
  start?: string;
  end?: string;
}

export function useTransactions(filters: TxnFilters = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => apiFetch<{ rows: Transaction[] }>(`/api/transactions?${params}`),
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: { category?: string; description?: string } }) =>
      apiFetch<{ ok: true }>(`/api/transactions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}
```

- [ ] **Step 5: Create `apps/web/hooks/useAccounts.ts`**

```ts
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { Account } from '@perfin/db';

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiFetch<{ rows: Account[] }>('/api/accounts'),
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; bank?: string; type?: string; currency?: string; color?: string }) =>
      apiFetch<{ row: Account }>('/api/accounts', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
}
```

- [ ] **Step 6: Typecheck and commit**

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
git commit -m "feat(web): /api/{transactions,accounts} routes + React Query hooks"
```

---

## Task 23: Web — Transactions page

**Files:**
- Create: `apps/web/components/transactions/TransactionsTable.tsx`
- Create: `apps/web/components/transactions/TransactionFilters.tsx`
- Create: `apps/web/components/transactions/TransactionEditSheet.tsx`
- Create: `apps/web/app/(app)/transactions/page.tsx`

- [ ] **Step 1: Create `apps/web/components/transactions/TransactionsTable.tsx`**

```tsx
'use client';

import { Skeleton, Badge, cn } from '@perfin/ui';
import { formatCurrency } from '@/lib/currency';
import type { Transaction } from '@perfin/db';

interface Props {
  rows: Transaction[];
  loading?: boolean;
  onRowClick: (txn: Transaction) => void;
}

export function TransactionsTable({ rows, loading, onRowClick }: Props) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} variant="row" className="h-10" />)}
      </div>
    );
  }
  if (!rows.length) {
    return <div className="text-text-muted text-sm py-12 text-center">No transactions yet.</div>;
  }
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      {rows.map((t) => {
        const expense = t.amountCents < 0;
        return (
          <button
            key={t.id}
            onClick={() => onRowClick(t)}
            className={cn(
              'w-full grid grid-cols-[80px_1fr_140px_110px] items-center gap-3',
              'px-4 py-3 text-left text-sm border-b border-border last:border-0',
              'hover:bg-surface-2 transition-colors duration-[120ms]',
            )}
          >
            <span className="text-text-muted font-mono text-xs">{t.date}</span>
            <span className="font-medium text-text truncate">{t.description}</span>
            <Badge variant={expense ? 'expense' : 'income'}>{t.category}</Badge>
            <span className={cn('font-mono font-medium text-right', expense ? 'text-negative' : 'text-positive')}>
              {formatCurrency(t.amountCents, 'INR', { withSign: !expense })}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/web/components/transactions/TransactionFilters.tsx`**

```tsx
'use client';

import { Field, Input } from '@perfin/ui';
import { CATEGORIES } from '@perfin/core';
import type { TxnFilters } from '@/hooks/useTransactions';

interface Props {
  value: TxnFilters;
  onChange: (next: TxnFilters) => void;
}

export function TransactionFilters({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <Field label="Search">
        <Input
          placeholder="Description…"
          value={value.search ?? ''}
          onChange={(e) => onChange({ ...value, search: e.target.value || undefined })}
        />
      </Field>
      <Field label="Category">
        <select
          value={value.category ?? ''}
          onChange={(e) => onChange({ ...value, category: e.target.value || undefined })}
          className="h-10 w-full px-3 rounded-md bg-surface-2 border border-border-strong text-text"
        >
          <option value="">All</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="From">
        <Input type="date" value={value.start ?? ''} onChange={(e) => onChange({ ...value, start: e.target.value || undefined })} />
      </Field>
      <Field label="To">
        <Input type="date" value={value.end ?? ''} onChange={(e) => onChange({ ...value, end: e.target.value || undefined })} />
      </Field>
    </div>
  );
}
```

- [ ] **Step 3: Create `apps/web/components/transactions/TransactionEditSheet.tsx`**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Modal, Button, Field, Input, Badge } from '@perfin/ui';
import { CATEGORIES } from '@perfin/core';
import type { Transaction } from '@perfin/db';
import { useUpdateTransaction } from '@/hooks/useTransactions';
import { formatCurrency } from '@/lib/currency';

interface Props {
  txn: Transaction | null;
  onClose: () => void;
}

export function TransactionEditSheet({ txn, onClose }: Props) {
  const update = useUpdateTransaction();
  const [category, setCategory] = useState(txn?.category ?? 'Needs Review');
  const [description, setDescription] = useState(txn?.description ?? '');

  useEffect(() => {
    if (txn) {
      setCategory(txn.category);
      setDescription(txn.description);
    }
  }, [txn]);

  if (!txn) return null;

  return (
    <Modal open={!!txn} onOpenChange={(o) => { if (!o) onClose(); }} title="Edit transaction" size="md">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-text-muted text-sm font-mono">{txn.date}</span>
          <span className="font-mono font-medium">
            {formatCurrency(txn.amountCents, 'INR')}
          </span>
        </div>
        <Field label="Description">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Category">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 w-full px-3 rounded-md bg-surface-2 border border-border-strong text-text"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Badge variant="neutral">Raw: {txn.rawDescription}</Badge>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={update.isPending}
            onClick={async () => {
              await update.mutateAsync({ id: txn.id, patch: { category, description } });
              onClose();
            }}
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 4: Create `apps/web/app/(app)/transactions/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@perfin/ui';
import Link from 'next/link';
import type { Transaction } from '@perfin/db';
import { useTransactions, type TxnFilters } from '@/hooks/useTransactions';
import { TransactionsTable } from '@/components/transactions/TransactionsTable';
import { TransactionFilters } from '@/components/transactions/TransactionFilters';
import { TransactionEditSheet } from '@/components/transactions/TransactionEditSheet';

export default function TransactionsPage() {
  const [filters, setFilters] = useState<TxnFilters>({});
  const [active, setActive] = useState<Transaction | null>(null);
  const { data, isLoading } = useTransactions(filters);

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <Link href="/app/upload"><Button variant="primary">+ Upload</Button></Link>
      </div>
      <TransactionFilters value={filters} onChange={setFilters} />
      <TransactionsTable
        rows={data?.rows ?? []}
        loading={isLoading}
        onRowClick={setActive}
      />
      <TransactionEditSheet txn={active} onClose={() => setActive(null)} />
    </div>
  );
}
```

- [ ] **Step 5: Typecheck and commit**

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
git commit -m "feat(web): transactions page (table + filters + edit sheet)"
```

---

## Task 24: Web — Accounts page

**Files:**
- Create: `apps/web/components/accounts/AccountCard.tsx`
- Create: `apps/web/components/accounts/AccountsGrid.tsx`
- Create: `apps/web/app/(app)/accounts/page.tsx`

- [ ] **Step 1: Create `apps/web/components/accounts/AccountCard.tsx`**

```tsx
'use client';

import { Tile } from '@perfin/ui';
import type { Account } from '@perfin/db';
import { formatCurrency } from '@/lib/currency';

export function AccountCard({ account }: { account: Account }) {
  return (
    <Tile variant="raised" className="space-y-3">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
          style={{ background: account.color }}
        >
          {account.name.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <div className="font-semibold">{account.name}</div>
          <div className="text-xs text-text-muted">{account.bank || account.type}</div>
        </div>
      </div>
      <div className="text-2xl font-mono font-semibold">
        {formatCurrency(account.balanceCents, account.currency)}
      </div>
    </Tile>
  );
}
```

- [ ] **Step 2: Create `apps/web/components/accounts/AccountsGrid.tsx`**

```tsx
'use client';

import { Skeleton, Tile, Button, Modal, Field, Input } from '@perfin/ui';
import { useState } from 'react';
import { useAccounts, useCreateAccount } from '@/hooks/useAccounts';
import { AccountCard } from './AccountCard';

export function AccountsGrid() {
  const { data, isLoading } = useAccounts();
  const create = useCreateAccount();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [bank, setBank] = useState('');
  const [type, setType] = useState('checking');
  const [currency, setCurrency] = useState('INR');

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="tile" />)}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data?.rows.map((a) => <AccountCard key={a.id} account={a} />)}
        <Tile className="border-dashed flex items-center justify-center min-h-[140px]">
          <Button variant="ghost" onClick={() => setOpen(true)}>+ Add account</Button>
        </Tile>
      </div>
      <Modal open={open} onOpenChange={setOpen} title="Add account">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name) return;
            await create.mutateAsync({ name, bank, type, currency });
            setOpen(false);
            setName(''); setBank(''); setType('checking');
          }}
        >
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
          <Field label="Bank"><Input value={bank} onChange={(e) => setBank(e.target.value)} /></Field>
          <Field label="Type">
            <select value={type} onChange={(e) => setType(e.target.value)} className="h-10 w-full px-3 rounded-md bg-surface-2 border border-border-strong text-text">
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="credit">Credit card</option>
              <option value="cash">Cash</option>
              <option value="investment">Investment</option>
            </select>
          </Field>
          <Field label="Currency">
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-10 w-full px-3 rounded-md bg-surface-2 border border-border-strong text-text">
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
```

- [ ] **Step 3: Create `apps/web/app/(app)/accounts/page.tsx`**

```tsx
import { AccountsGrid } from '@/components/accounts/AccountsGrid';

export default function AccountsPage() {
  return (
    <div className="p-8 max-w-6xl space-y-6">
      <h1 className="text-2xl font-semibold">Accounts</h1>
      <AccountsGrid />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck and commit**

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
git commit -m "feat(web): accounts page (grid + add modal)"
```

---

## Task 25: Web — Upload page (with SSE progress)

**Files:**
- Create: `apps/web/components/upload/UploadDropzone.tsx`
- Create: `apps/web/app/(app)/upload/page.tsx`

- [ ] **Step 1: Create `apps/web/components/upload/UploadDropzone.tsx`**

```tsx
'use client';

import { useState, useRef } from 'react';
import { Button, cn } from '@perfin/ui';

interface Props {
  onUploaded: (uploadJobId: number) => void;
}

export function UploadDropzone({ onUploaded }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function send(file: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(await res.text());
      const { uploadJobId } = (await res.json()) as { uploadJobId: number };
      onUploaded(uploadJobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) void send(f);
      }}
      className={cn(
        'border-2 border-dashed rounded-xl p-12 text-center',
        'transition-colors duration-[120ms] cursor-pointer',
        dragOver ? 'border-accent bg-accent-soft' : 'border-border-strong bg-surface',
      )}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,.pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void send(f); }}
      />
      <p className="text-text font-medium">Drop a CSV, Excel, or PDF here</p>
      <p className="text-text-muted text-sm mt-1">or click to choose a file (max 10 MB)</p>
      <Button className="mt-4" variant="secondary" disabled={busy}>
        {busy ? 'Uploading…' : 'Choose file'}
      </Button>
      {error && <p className="text-negative text-sm mt-3">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/web/app/(app)/upload/page.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tile, Badge } from '@perfin/ui';
import { UploadDropzone } from '@/components/upload/UploadDropzone';

interface JobEvent {
  status: 'queued' | 'extracting' | 'categorizing' | 'inserting' | 'done' | 'failed';
  message?: string;
  extractedCount?: number;
  insertedCount?: number;
  error?: string;
}

const WORKER_BASE = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:8001';

export default function UploadPage() {
  const router = useRouter();
  const [jobId, setJobId] = useState<number | null>(null);
  const [events, setEvents] = useState<JobEvent[]>([]);

  useEffect(() => {
    if (jobId == null) return;
    const es = new EventSource(`${WORKER_BASE}/jobs/${jobId}/stream`);
    es.onmessage = (m) => {
      const data = JSON.parse(m.data) as JobEvent;
      setEvents((prev) => [...prev, data]);
      if (data.status === 'done') setTimeout(() => router.push('/app/transactions'), 1200);
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [jobId, router]);

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Upload statement</h1>
      {jobId == null
        ? <UploadDropzone onUploaded={setJobId} />
        : (
          <Tile variant="raised" className="space-y-2">
            <p className="font-medium">Processing job #{jobId}…</p>
            {events.map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Badge variant={e.status === 'failed' ? 'expense' : e.status === 'done' ? 'income' : 'info'}>
                  {e.status}
                </Badge>
                {e.extractedCount !== undefined && <span>extracted {e.extractedCount}</span>}
                {e.insertedCount  !== undefined && <span>inserted {e.insertedCount}</span>}
                {e.error && <span className="text-negative">{e.error}</span>}
              </div>
            ))}
          </Tile>
        )}
    </div>
  );
}
```

- [ ] **Step 3: Add `NEXT_PUBLIC_WORKER_URL` to `.env.example` and `.env`**

Append to both:

```
NEXT_PUBLIC_WORKER_URL=http://localhost:8001
```

- [ ] **Step 4: Typecheck and commit**

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 \
AUTH_URL=http://localhost:3000 \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
  pnpm --filter @perfin/web typecheck
```
Expected: clean.

```bash
git add apps/web .env.example .env
git commit -m "feat(web): upload page with drag-drop + SSE live progress"
```

---

## Task 26: Web — Onboarding 3-step flow

**Files:**
- Create: `apps/web/app/onboarding/layout.tsx`
- Create: `apps/web/app/onboarding/welcome/page.tsx`
- Create: `apps/web/app/onboarding/locale/page.tsx`
- Create: `apps/web/app/onboarding/locale/actions.ts`
- Create: `apps/web/app/onboarding/connect/page.tsx`
- Create: `apps/web/app/onboarding/done/page.tsx`
- Modify: `apps/web/app/(auth)/signup/actions.ts` (redirect to onboarding instead of /app)

- [ ] **Step 1: Create `apps/web/app/onboarding/layout.tsx`**

```tsx
import type { ReactNode } from 'react';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
```

- [ ] **Step 2: Create welcome page**

`apps/web/app/onboarding/welcome/page.tsx`:

```tsx
import Link from 'next/link';
import { Tile, Button } from '@perfin/ui';

export default function WelcomePage() {
  return (
    <Tile variant="hero" className="space-y-4 text-center">
      <h1 className="text-2xl font-semibold">Welcome to Perfin</h1>
      <p className="text-text-muted">
        Let's get you set up. This takes about a minute.
      </p>
      <Link href="/onboarding/locale"><Button size="lg" className="w-full">Get started</Button></Link>
    </Tile>
  );
}
```

- [ ] **Step 3: Create locale step**

`apps/web/app/onboarding/locale/actions.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { createDb, accounts, users } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);

export async function saveLocaleAction(formData: FormData) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) redirect('/login');
  const userId = Number(userIdStr);
  const currency = String(formData.get('currency') ?? 'INR');

  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) redirect('/login');

  // Create a default "Cash" account in the chosen currency if none exists
  const existing = await db.select().from(accounts).where(eq(accounts.userId, userId));
  if (existing.length === 0) {
    await db.insert(accounts).values({
      userId,
      name: 'Cash',
      bank: '',
      type: 'cash',
      currency,
      color: '#6366f1',
    }).onConflictDoNothing();
  }

  redirect('/onboarding/connect');
}
```

`apps/web/app/onboarding/locale/page.tsx`:

```tsx
import { Tile, Button, Field } from '@perfin/ui';
import { saveLocaleAction } from './actions';

export default function LocalePage() {
  return (
    <Tile variant="hero" className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Pick your currency</h1>
        <p className="text-sm text-text-muted">You can change this later in Settings.</p>
      </header>
      <form action={saveLocaleAction} className="space-y-4">
        <Field label="Currency" htmlFor="currency">
          <select
            id="currency"
            name="currency"
            defaultValue="INR"
            className="h-10 w-full px-3 rounded-md bg-surface-2 border border-border-strong text-text"
          >
            <option value="INR">INR (₹)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
          </select>
        </Field>
        <Button type="submit" size="lg" className="w-full">Continue</Button>
      </form>
    </Tile>
  );
}
```

- [ ] **Step 4: Create connect step**

`apps/web/app/onboarding/connect/page.tsx`:

```tsx
import Link from 'next/link';
import { Tile, Button } from '@perfin/ui';

export default function ConnectPage() {
  return (
    <Tile variant="hero" className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Bring in your data</h1>
        <p className="text-sm text-text-muted">
          Upload a recent statement to see Perfin in action. Bank connections (Plaid)
          and email forwarding are coming soon.
        </p>
      </header>
      <Link href="/app/upload"><Button size="lg" className="w-full">Upload a statement</Button></Link>
      <Link href="/app" className="block text-center text-sm text-text-muted">Skip for now</Link>
    </Tile>
  );
}
```

- [ ] **Step 5: Create done step (used after first upload completes)**

`apps/web/app/onboarding/done/page.tsx`:

```tsx
import Link from 'next/link';
import { Tile, Button } from '@perfin/ui';

export default function DonePage() {
  return (
    <Tile variant="hero" className="space-y-4 text-center">
      <h1 className="text-2xl font-semibold">You're all set.</h1>
      <p className="text-text-muted">
        Your transactions are categorized. The AI insights will start to fill in
        once we have ~30 days of activity.
      </p>
      <Link href="/app"><Button size="lg" className="w-full">Open my dashboard</Button></Link>
    </Tile>
  );
}
```

- [ ] **Step 6: Modify signup action to land on onboarding**

Edit `apps/web/app/(auth)/signup/actions.ts` — change the trailing `redirect('/app')` to `redirect('/onboarding/welcome')`. The diff:

```diff
-  await signIn('credentials', { email, password, redirect: false });
-  redirect('/app');
+  await signIn('credentials', { email, password, redirect: false });
+  redirect('/onboarding/welcome');
```

- [ ] **Step 7: Update middleware matcher**

Edit `apps/web/middleware.ts` matcher to include onboarding:

```diff
 export const config = {
-  matcher: ['/app/:path*', '/login', '/signup'],
+  matcher: ['/app/:path*', '/onboarding/:path*', '/login', '/signup'],
 };
```

And add a redirect rule inside the auth callback to require login on `/onboarding/*`:

```diff
   if (path.startsWith('/app') && !isLoggedIn) {
+    const url = req.nextUrl.clone();
+    url.pathname = '/login';
+    return NextResponse.redirect(url);
+  }
+  if (path.startsWith('/onboarding') && !isLoggedIn) {
     const url = req.nextUrl.clone();
     url.pathname = '/login';
     return NextResponse.redirect(url);
   }
```

- [ ] **Step 8: Typecheck and commit**

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
git commit -m "feat(web): 3-step onboarding (welcome → locale → connect)"
```

---

## Task 27: Sidebar polish + transactions live in nav

**Files:**
- Modify: `apps/web/components/Sidebar.tsx`

- [ ] **Step 1: Replace icons with `lucide-react` and add an "Upload" footer action**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles, ListOrdered, Lightbulb, MessageSquare, Landmark, Target, BarChart3, Inbox, Upload,
} from 'lucide-react';
import { cn } from '@perfin/ui';

const items = [
  { href: '/app',              label: 'Home',            Icon: Sparkles },
  { href: '/app/transactions', label: 'Transactions',    Icon: ListOrdered },
  { href: '/app/insights',     label: 'Insights',        Icon: Lightbulb },
  { href: '/app/ask',          label: 'Ask',             Icon: MessageSquare },
  { href: '/app/accounts',     label: 'Accounts',        Icon: Landmark },
  { href: '/app/budgets',      label: 'Budgets & Goals', Icon: Target },
  { href: '/app/reports',      label: 'Reports',         Icon: BarChart3 },
  { href: '/app/inbox',        label: 'Inbox',           Icon: Inbox },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-60 h-screen bg-surface border-r border-border flex flex-col">
      <header className="h-16 px-5 flex items-center border-b border-border">
        <span className="text-text font-semibold">Perfin</span>
      </header>
      <nav className="flex-1 p-3 space-y-0.5" aria-label="Primary">
        {items.map(({ href, label, Icon }) => {
          const active = path === href || (href !== '/app' && path.startsWith(href));
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
        <p className="text-xs text-text-subtle px-3">v0.1 · Phase 1</p>
      </footer>
    </aside>
  );
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
pnpm --filter @perfin/web typecheck
```
Expected: clean.

```bash
git add apps/web/components/Sidebar.tsx
git commit -m "feat(web): sidebar uses lucide icons, footer shows Upload CTA"
```

---

## Task 28: Update happy-path e2e + add upload-flow e2e

**Files:**
- Modify: `apps/web/tests/e2e/happy-path.spec.ts`
- Create: `apps/web/tests/e2e/upload-flow.spec.ts`

- [ ] **Step 1: Update happy-path**

Replace contents of `apps/web/tests/e2e/happy-path.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('signup → onboarding → land on /app', async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e-${stamp}@perfin.dev`;
  const password = 'password12345';

  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /create account/i }).click();

  await page.waitForURL('**/onboarding/welcome', { timeout: 10_000 });
  await page.getByRole('link', { name: /get started/i }).click();
  await page.waitForURL('**/onboarding/locale');
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL('**/onboarding/connect');
  await page.getByRole('link', { name: /skip for now/i }).click();
  await page.waitForURL('**/app');
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
});

test('logout redirect: /app while logged out goes to /login', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/app');
  await page.waitForURL('**/login');
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
});
```

- [ ] **Step 2: Create upload-flow e2e**

`apps/web/tests/e2e/upload-flow.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

test('signup → upload CSV → see categorized transactions', async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e-up-${stamp}@perfin.dev`;
  const password = 'password12345';
  const dir = resolve(tmpdir(), `perfin-up-${stamp}`);
  await mkdir(dir, { recursive: true });
  const csvPath = resolve(dir, 'apr.csv');
  await writeFile(
    csvPath,
    'Date,Description,Amount\n2026-04-01,Swiggy Bangalore,-450\n2026-04-02,Salary Acme,80000\n',
  );

  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /create account/i }).click();
  await page.waitForURL('**/onboarding/welcome');
  await page.getByRole('link', { name: /get started/i }).click();
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByRole('link', { name: /upload a statement/i }).click();

  await page.waitForURL('**/upload');
  const input = page.locator('input[type="file"]');
  await input.setInputFiles(csvPath);

  // SSE events stream; we expect to land on /transactions within ~10s
  await page.waitForURL('**/app/transactions', { timeout: 30_000 });
  await expect(page.getByText('Swiggy Bangalore', { exact: false })).toBeVisible();
  await expect(page.getByText('Salary Acme',     { exact: false })).toBeVisible();
});
```

- [ ] **Step 3: Update Playwright webServer config to start the worker too**

Replace `apps/web/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'pnpm --filter @perfin/worker dev',
      url: 'http://localhost:8001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'pnpm dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
});
```

- [ ] **Step 4: Run e2e**

Bring up Postgres if needed:
```bash
docker compose up -d
```
Then:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 \
AUTH_URL=http://localhost:3000 \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
  pnpm --filter @perfin/web test:e2e
```
Expected: 3 e2e tests pass (happy-path × 2, upload-flow × 1).

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "test(web): e2e for onboarding + upload flow"
```

---

## Task 29: Phase 1 acceptance — full sweep

- [ ] **Step 1: Run typecheck across all packages**

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 \
AUTH_URL=http://localhost:3000 \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
  pnpm typecheck
```
Expected: clean across all 6 packages.

- [ ] **Step 2: Run all unit tests**

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 \
AUTH_URL=http://localhost:3000 \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
  pnpm test
```
Expected: all green; total ~80 tests across db / core / extractors / ui / worker.

- [ ] **Step 3: Run production build**

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 \
AUTH_URL=http://localhost:3000 \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
  pnpm build
```
Expected: web and worker both build.

- [ ] **Step 4: Manual smoke**

Two terminals:
```bash
# T1
docker compose up -d
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin pnpm db:migrate
# (then start the web dev server)
pnpm --filter @perfin/web dev
```
```bash
# T2
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
  pnpm --filter @perfin/worker dev
```
Browser:
1. Visit `http://localhost:3000`
2. Sign up
3. Onboarding: welcome → locale (INR) → connect → click "Upload a statement"
4. Drop a real statement (CSV/Excel/PDF). Watch SSE progress through queued → extracting → categorizing → done.
5. Land on `/app/transactions`. Confirm rows appear with categories.
6. Click a row → edit category in Sheet → save → see the category change.
7. Visit `/app/accounts` → see the seeded "Cash" account from onboarding.

- [ ] **Step 5: Tag the milestone**

```bash
git tag v0.2.0-phase1
git push origin main
git push origin v0.2.0-phase1
```

---

## Phase 1 — Definition of done

- [ ] All 29 tasks committed
- [ ] `pnpm typecheck` clean across all packages
- [ ] `pnpm test` passes (≥ 80 tests total)
- [ ] `pnpm build` succeeds
- [ ] Playwright e2e (signup→onboarding + signup→upload→transactions) passes
- [ ] Manual flow: signup → onboarding → upload → transactions, verified in browser
- [ ] Tag `v0.2.0-phase1` on `main`

---

## Self-review notes

**Spec coverage check.** Phase 1 of the design spec calls for: `packages/extractors` (CSV+PDF+Excel), `packages/core` categorizer (rules + Claude), upload flow with R2/disk + worker pipeline + SSE progress, Transactions page, Accounts page (manual only), Onboarding steps 1-3 minus Plaid. All covered: extractors in Tasks 9-14, core in Tasks 1-8, upload in 15-21 + 25, Transactions in 22-23, Accounts in 24, onboarding in 26.

**Type-consistency check.** `NormalizedTxn` (Task 4), `Rule` (Task 5), `CategorizationResult` (Task 5), `ExtractInput`/`ExtractResult` (Task 9), `JobEvent` (Task 16), `PipelineInput`/`PipelineOutput` (Task 17) are all referenced consistently in downstream tasks. Web hooks return `Transaction`/`Account` types from `@perfin/db`. Sidebar item shape (`{ href, label, Icon }`) is identical in Tasks 24 web layout and Task 27 polish — Task 27 swaps icon strings for lucide components without changing the item count or routes.

**Out of scope (deferred to later phases).** Plaid (Phase 4), email forwarding (Phase 4), insights generation (Phase 2), agent/chat (Phase 3), bank format library beyond HDFC (Phase 4 / on demand), R2/S3 file storage (Phase 5), light theme (v1.1), receipt OCR via Claude vision (Phase 4 fallback), agent-triggered category corrections (Phase 3).

**Risk: Claude API in pipeline.** If `ANTHROPIC_API_KEY` is unset, the pipeline still works — every uncategorized row falls back to `"Needs Review"`. Tests don't make live calls. CI runs without an API key by design.

**Risk: file-based job registry.** Phase 1's worker keeps job state in memory. If the worker crashes mid-upload, the SSE stream silently dies. Acceptable for single-machine dev; Phase 2 swaps to a `upload_jobs` table-backed registry so progress survives restarts.
