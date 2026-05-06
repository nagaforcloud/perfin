# Perfin — Phase 3: Agentic Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Ask page — a streaming, tool-using chat with Claude Sonnet 4.6 that can answer arbitrary money questions over the user's ledger and *propose* writes (update transaction, split transaction, set a budget, create a savings goal) for one-click user confirmation. Every confirmed write lands in an `agent_actions` audit table that the user can see in Settings → Activity.

**Architecture:** New `@perfin/agent` package owns: tool schemas (zod), system prompt builder, the read-tool execution layer that runs against the DB, and the write-proposal layer that *creates a row in `agent_proposals`* instead of executing. The web app gets a streaming route (`POST /api/ask/stream`) that uses Vercel AI SDK 4 + `@ai-sdk/anthropic` with tool-use; thread + message persistence in two new tables; a confirm-or-cancel endpoint pair that executes the write atomically and writes the audit row; an Ask page with chat UI (ChatBubble, ToolCard, ProposalCard, MessageComposer, ThreadList sidebar, StarterPrompts); and a Settings → Activity page that lists every agent write the user has approved. A 6-prompt rotating "starter prompts" panel makes the empty state feel alive.

**Tech Stack:** All Phase 2 stack plus: Vercel AI SDK v4 (`ai` 4.0.10) · `@ai-sdk/anthropic` 0.0.55 · `react-markdown` 9.0.1 · Server-Sent Events for stream piping · Drizzle migration #2 (chat_threads, chat_messages, agent_proposals tables; `proposal_status` enum).

**Phase 3 acceptance:**
1. Authenticated user opens `/app/ask` → sees 6 starter prompts → clicks one → chat streams Claude response with at least one inline `ToolCard` (e.g. `✓ ledger.query · 23 transactions · 187 ms`).
2. User asks "Cap me at $500/mo for dining starting next month" → agent calls `budget.upsert` → chat renders an inline `ProposalCard` with the proposed change, **no DB write yet** → user clicks Confirm → server executes the write → chat inserts a result message → row appears in Settings → Activity.
3. Cancelling a proposal does NOT execute the write; row marked `cancelled` in `agent_proposals`.
4. Threads persist across page reloads; sidebar lists last 20.
5. `pnpm typecheck`, `pnpm test`, `pnpm build` clean. ≥ 30 new unit tests pass.
6. Playwright e2e: signup → seed sample → ask "How much did I spend on Food this month?" → assert tool call rendered → assert reply mentions a money figure.
7. Tag `v0.4.0-phase3` on `main`; `docs/PHASES.md` updated.

---

## File Structure

```
perfin/
├── packages/
│   ├── db/
│   │   ├── src/
│   │   │   ├── enums.ts                          # MODIFIED (add proposal_status)
│   │   │   └── schema/
│   │   │       ├── chatThreads.ts                # NEW
│   │   │       ├── chatMessages.ts               # NEW
│   │   │       ├── agentProposals.ts             # NEW
│   │   │       └── index.ts                      # MODIFIED
│   │   └── migrations/
│   │       └── 0001_*.sql                        # NEW (generated)
│   └── agent/                                    # NEW package
│       ├── src/
│       │   ├── index.ts
│       │   ├── system-prompt.ts
│       │   ├── tools/
│       │   │   ├── types.ts
│       │   │   ├── ledger-query.ts               # READ
│       │   │   ├── analytics-summary.ts          # READ
│       │   │   ├── recurring-detect.ts           # READ
│       │   │   ├── anomalies-list.ts             # READ
│       │   │   ├── forecast-cashflow.ts          # READ
│       │   │   ├── transaction-update.ts         # WRITE (proposal)
│       │   │   ├── transaction-split.ts          # WRITE (proposal)
│       │   │   ├── budget-upsert.ts              # WRITE (proposal)
│       │   │   ├── goal-create.ts                # WRITE (proposal)
│       │   │   └── registry.ts                   # build tool record per request
│       │   └── execute.ts                        # confirm-side write executor
│       ├── tests/
│       │   ├── ledger-query.test.ts
│       │   ├── analytics-summary.test.ts
│       │   ├── forecast-cashflow.test.ts
│       │   ├── proposals.test.ts
│       │   └── execute.test.ts
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       └── package.json
│
└── apps/
    └── web/
        ├── app/
        │   ├── (app)/
        │   │   ├── ask/page.tsx                  # NEW
        │   │   └── settings/
        │   │       ├── layout.tsx                # NEW
        │   │       └── activity/page.tsx         # NEW
        │   └── api/
        │       ├── ask/
        │       │   ├── stream/route.ts           # NEW (POST, AI SDK)
        │       │   └── threads/
        │       │       ├── route.ts              # NEW (GET list, POST create)
        │       │       └── [id]/route.ts         # NEW (GET messages, DELETE)
        │       └── agent/
        │           ├── proposals/
        │           │   └── [id]/
        │           │       ├── confirm/route.ts  # NEW
        │           │       └── cancel/route.ts   # NEW
        │           └── activity/route.ts         # NEW
        ├── components/
        │   └── ask/
        │       ├── ChatBubble.tsx                # NEW
        │       ├── ToolCard.tsx                  # NEW
        │       ├── ProposalCard.tsx              # NEW
        │       ├── MessageComposer.tsx           # NEW
        │       ├── ThreadList.tsx                # NEW
        │       └── StarterPrompts.tsx            # NEW
        ├── hooks/
        │   ├── useAskChat.ts                     # NEW (wraps useChat from ai/react)
        │   ├── useThreads.ts                     # NEW
        │   └── useActivity.ts                    # NEW
        ├── lib/
        │   └── starter-prompts.ts                # NEW
        ├── package.json                          # MODIFIED (add ai, @ai-sdk/anthropic, react-markdown)
        └── tests/e2e/
            └── ask-flow.spec.ts                  # NEW
```

**Boundaries:**
- `@perfin/agent` exports tool *factories* that take `(userId, db)` and return `Tool` records compatible with Vercel AI SDK. No imports from `apps/`.
- Read tools execute immediately and return small JSON blobs.
- Write tools' `execute` does NOT mutate; it only writes a row to `agent_proposals` and returns `{ kind: 'proposal', proposalId, preview, args, tool }`. The chat UI special-cases this and renders a `ProposalCard`.
- `execute.ts` is the *only* code that performs the actual writes — it is called by the confirm route after user approval, runs in a single Drizzle transaction, and writes both the target row and the `agent_actions` audit row.
- `apps/web/app/api/ask/stream/route.ts` returns `result.toDataStreamResponse()`; the client uses `useChat` from `ai/react`.

---

## Task 1: DB schema — chat_threads + chat_messages + agent_proposals

**Files:**
- Modify: `packages/db/src/enums.ts`
- Create: `packages/db/src/schema/chatThreads.ts`
- Create: `packages/db/src/schema/chatMessages.ts`
- Create: `packages/db/src/schema/agentProposals.ts`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/tests/schema.test.ts`

- [ ] **Step 1: Add the new enum**

Edit `packages/db/src/enums.ts` — append:

```ts
export const proposalStatusEnum = pgEnum('proposal_status', [
  'pending', 'confirmed', 'cancelled',
]);

export const chatRoleEnum = pgEnum('chat_role', ['user', 'assistant', 'tool']);
```

- [ ] **Step 2: Write failing tests**

Append to `packages/db/tests/schema.test.ts`:

```ts
import {
  chatThreads, chatMessages, agentProposals,
  proposalStatusEnum, chatRoleEnum,
} from '../src/schema/index';

describe('chatThreads schema', () => {
  it('has expected columns', () => {
    expect(chatThreads.id).toBeDefined();
    expect(chatThreads.userId).toBeDefined();
    expect(chatThreads.title).toBeDefined();
    expect(chatThreads.pinned).toBeDefined();
  });
});

describe('chatMessages schema', () => {
  it('has expected columns', () => {
    expect(chatMessages.id).toBeDefined();
    expect(chatMessages.threadId).toBeDefined();
    expect(chatMessages.role).toBeDefined();
    expect(chatMessages.content).toBeDefined();
    expect(chatMessages.toolCalls).toBeDefined();
  });
});

describe('agentProposals schema', () => {
  it('has expected columns', () => {
    expect(agentProposals.id).toBeDefined();
    expect(agentProposals.userId).toBeDefined();
    expect(agentProposals.threadId).toBeDefined();
    expect(agentProposals.tool).toBeDefined();
    expect(agentProposals.input).toBeDefined();
    expect(agentProposals.preview).toBeDefined();
    expect(agentProposals.status).toBeDefined();
  });
});

describe('new enums', () => {
  it('proposal status', () => {
    expect(proposalStatusEnum.enumValues).toEqual(['pending', 'confirmed', 'cancelled']);
  });
  it('chat role', () => {
    expect(chatRoleEnum.enumValues).toEqual(['user', 'assistant', 'tool']);
  });
});
```

- [ ] **Step 3: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/db test
```
Expected: fails — schemas don't exist.

- [ ] **Step 4: Create `packages/db/src/schema/chatThreads.ts`**

```ts
import { pgTable, serial, integer, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const chatThreads = pgTable(
  'chat_threads',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('Untitled'),
    pinned: boolean('pinned').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('chat_threads_user_idx').on(t.userId),
  }),
);

export type ChatThread = typeof chatThreads.$inferSelect;
export type NewChatThread = typeof chatThreads.$inferInsert;
```

- [ ] **Step 5: Create `packages/db/src/schema/chatMessages.ts`**

```ts
import { pgTable, serial, integer, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { chatThreads } from './chatThreads';
import { chatRoleEnum } from '../enums';

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: serial('id').primaryKey(),
    threadId: integer('thread_id').notNull().references(() => chatThreads.id, { onDelete: 'cascade' }),
    role: chatRoleEnum('role').notNull(),
    content: text('content').notNull().default(''),
    toolCalls: jsonb('tool_calls'),         // assistant tool-call payload
    toolResults: jsonb('tool_results'),     // tool-result payload (matched by id)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    threadIdx: index('chat_messages_thread_idx').on(t.threadId, t.createdAt),
  }),
);

export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
```

- [ ] **Step 6: Create `packages/db/src/schema/agentProposals.ts`**

```ts
import { pgTable, serial, integer, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { chatThreads } from './chatThreads';
import { proposalStatusEnum } from '../enums';

export const agentProposals = pgTable(
  'agent_proposals',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    threadId: integer('thread_id').references(() => chatThreads.id, { onDelete: 'cascade' }),
    tool: text('tool').notNull(),                  // e.g. 'budget.upsert'
    input: jsonb('input').notNull(),               // raw tool args
    preview: text('preview').notNull(),            // human-readable summary
    status: proposalStatusEnum('status').notNull().default('pending'),
    output: jsonb('output'),                       // result of confirmed exec
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userStatusIdx: index('agent_proposals_user_status_idx').on(t.userId, t.status),
  }),
);

export type AgentProposal = typeof agentProposals.$inferSelect;
export type NewAgentProposal = typeof agentProposals.$inferInsert;
```

- [ ] **Step 7: Update `packages/db/src/schema/index.ts`** — append:

```ts
export * from './chatThreads';
export * from './chatMessages';
export * from './agentProposals';
```

- [ ] **Step 8: Run tests (expect pass)**

Run:
```bash
pnpm --filter @perfin/db test
```
Expected: 5 new tests pass.

- [ ] **Step 9: Generate + apply migration**

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin pnpm --filter @perfin/db generate
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin pnpm --filter @perfin/db migrate
```
Expected: migration `0001_*.sql` is generated and applied. Verify in Postgres:
```bash
docker exec -i perfin-postgres-1 psql -U perfin -d perfin -c '\dt'
```
Expected: `chat_threads`, `chat_messages`, `agent_proposals` listed.

- [ ] **Step 10: Commit**

```bash
git add packages/db
git commit -m "feat(db): chat_threads + chat_messages + agent_proposals schema (migration 0001)"
```

---

## Task 2: Scaffold `@perfin/agent` package

**Files:**
- Create: `packages/agent/package.json`, `tsconfig.json`, `vitest.config.ts`
- Create: `packages/agent/src/index.ts`
- Create: `packages/agent/src/tools/types.ts`

- [ ] **Step 1: Create `packages/agent/package.json`**

```json
{
  "name": "@perfin/agent",
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
    "@perfin/db": "workspace:*",
    "ai": "4.0.10",
    "drizzle-orm": "0.36.0",
    "zod": "3.23.8"
  },
  "devDependencies": {
    "@perfin/config": "workspace:*",
    "@types/node": "22.9.0",
    "typescript": "5.6.3",
    "vitest": "2.1.4"
  }
}
```

- [ ] **Step 2: Create `packages/agent/tsconfig.json`**

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

- [ ] **Step 3: Create `packages/agent/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', globals: true },
});
```

- [ ] **Step 4: Create `packages/agent/src/tools/types.ts`**

```ts
import type { Db } from '@perfin/db';

export interface ToolContext {
  userId: number;
  db: Db;
  threadId: number | null;
  currency: string;
}

export interface ProposalResult {
  kind: 'proposal';
  proposalId: number;
  tool: string;
  preview: string;
  args: Record<string, unknown>;
}

export function isProposal(v: unknown): v is ProposalResult {
  return !!v && typeof v === 'object' && (v as { kind?: string }).kind === 'proposal';
}
```

- [ ] **Step 5: Create `packages/agent/src/index.ts`**

```ts
export * from './tools/types';
export * from './system-prompt';
export * from './tools/registry';
export * from './execute';
```

- [ ] **Step 6: Install + commit**

```bash
pnpm install
git add packages/agent pnpm-lock.yaml
git commit -m "chore(agent): scaffold @perfin/agent package"
```

---

## Task 3: System prompt builder

**Files:**
- Create: `packages/agent/src/system-prompt.ts`

- [ ] **Step 1: Create `packages/agent/src/system-prompt.ts`**

```ts
export interface SystemPromptInput {
  currency: string;
  topCategories: string[];
  accountNames: string[];
  todayIso: string;             // YYYY-MM-DD
}

export function buildSystemPrompt(input: SystemPromptInput): string {
  return [
    'You are Perfin, a helpful, precise personal-finance copilot.',
    `Today's date: ${input.todayIso}`,
    `Default currency: ${input.currency}`,
    input.topCategories.length
      ? `User's top spending categories: ${input.topCategories.join(', ')}`
      : '',
    input.accountNames.length
      ? `User's accounts: ${input.accountNames.join(', ')}`
      : '',
    '',
    'You have READ tools (run immediately) and WRITE tools (return a proposal — they NEVER apply automatically; the user must confirm).',
    'When the user asks a question about their money, prefer one targeted READ tool call over guessing.',
    'When the user asks to change something (set a budget, fix a category, split a transaction, create a goal), call the matching WRITE tool. Phrase the preview clearly so the user knows what will happen if they confirm.',
    '',
    'Formatting rules:',
    '- Quote money values with the user\'s currency symbol and 2 decimals.',
    '- Use the U+2212 minus sign (−) for negative amounts.',
    '- If a question is ambiguous, ask ONE clarifying question rather than guessing.',
    '- Keep replies concise. Lead with the answer; supporting numbers second.',
  ].filter(Boolean).join('\n');
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/agent
git commit -m "feat(agent): system prompt builder"
```

---

## Task 4: Read tool — `ledger.query`

**Files:**
- Create: `packages/agent/src/tools/ledger-query.ts`
- Create: `packages/agent/tests/ledger-query.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/agent/tests/ledger-query.test.ts`:

```ts
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb, users, transactions, type Db } from '@perfin/db';
import { ledgerQuery } from '../src/tools/ledger-query';

const url = process.env.DATABASE_URL ?? 'postgres://perfin:perfin@localhost:5433/perfin';
const skip = process.env.SKIP_DB_TESTS === '1';
let db: Db;
let close: () => Promise<void>;
let userId: number;

beforeAll(async () => {
  if (skip) return;
  const created = createDb(url);
  db = created.db;
  close = created.close;
  const [u] = await db.insert(users).values({ email: `agent-lq-${Date.now()}@perfin.dev`, passwordHash: 'x' }).returning();
  userId = u!.id;
  await db.insert(transactions).values([
    { userId, date: '2026-04-01', description: 'Swiggy', rawDescription: 'Swiggy', amountCents: -45000, category: 'Food' },
    { userId, date: '2026-04-02', description: 'Salary', rawDescription: 'Salary', amountCents: 800000, category: 'Income' },
    { userId, date: '2026-04-03', description: 'Whole Foods', rawDescription: 'Whole Foods', amountCents: -28000, category: 'Groceries' },
  ]);
});

afterAll(async () => {
  if (skip) return;
  await db.delete(users).where(eq(users.id, userId));
  await close();
});

describe.skipIf(skip)('ledgerQuery', () => {
  it('filters by category', async () => {
    const tool = ledgerQuery({ userId, db, threadId: null, currency: 'INR' });
    const rows = await tool.execute({ category: 'Food' });
    expect(rows.count).toBe(1);
    expect(rows.totalCents).toBe(-45000);
  });
  it('filters by date range', async () => {
    const tool = ledgerQuery({ userId, db, threadId: null, currency: 'INR' });
    const rows = await tool.execute({ start: '2026-04-02', end: '2026-04-03' });
    expect(rows.count).toBe(2);
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin pnpm --filter @perfin/agent test
```
Expected: fails — module missing.

- [ ] **Step 3: Create `packages/agent/src/tools/ledger-query.ts`**

```ts
import { tool } from 'ai';
import { z } from 'zod';
import { and, desc, eq, gte, ilike, lte, type SQL } from 'drizzle-orm';
import { transactions } from '@perfin/db';
import { formatCurrency } from '@perfin/core';
import type { ToolContext } from './types';

const Args = z.object({
  category: z.string().optional(),
  type: z.enum(['income', 'expense']).optional(),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
});

export function ledgerQuery(ctx: ToolContext) {
  return tool({
    description: 'Query the user\'s transactions with filters. Returns count, total, and top rows.',
    parameters: Args,
    async execute(args) {
      const conds: SQL[] = [eq(transactions.userId, ctx.userId)];
      if (args.category) conds.push(eq(transactions.category, args.category));
      if (args.start)    conds.push(gte(transactions.date, args.start));
      if (args.end)      conds.push(lte(transactions.date, args.end));
      if (args.search)   conds.push(ilike(transactions.description, `%${args.search}%`));

      const all = await ctx.db
        .select()
        .from(transactions)
        .where(and(...conds))
        .orderBy(desc(transactions.date), desc(transactions.id));

      const filtered = args.type
        ? all.filter((t) => (args.type === 'income' ? t.amountCents > 0 : t.amountCents < 0))
        : all;

      const totalCents = filtered.reduce((s, r) => s + r.amountCents, 0);
      return {
        count: filtered.length,
        totalCents,
        totalFormatted: formatCurrency(totalCents, ctx.currency),
        rows: filtered.slice(0, args.limit).map((r) => ({
          id: r.id,
          date: r.date,
          description: r.description,
          category: r.category,
          amountCents: r.amountCents,
          amountFormatted: formatCurrency(r.amountCents, ctx.currency),
        })),
      };
    },
  });
}
```

- [ ] **Step 4: Run test (expect pass)**

Run:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin pnpm --filter @perfin/agent test
```
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/agent
git commit -m "feat(agent): ledger.query read tool"
```

---

## Task 5: Read tool — `analytics.summary`

**Files:**
- Create: `packages/agent/src/tools/analytics-summary.ts`
- Create: `packages/agent/tests/analytics-summary.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/agent/tests/analytics-summary.test.ts`:

```ts
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb, users, transactions, type Db } from '@perfin/db';
import { analyticsSummary } from '../src/tools/analytics-summary';

const url = process.env.DATABASE_URL ?? 'postgres://perfin:perfin@localhost:5433/perfin';
const skip = process.env.SKIP_DB_TESTS === '1';
let db: Db;
let close: () => Promise<void>;
let userId: number;

beforeAll(async () => {
  if (skip) return;
  const created = createDb(url);
  db = created.db;
  close = created.close;
  const [u] = await db.insert(users).values({ email: `agent-as-${Date.now()}@perfin.dev`, passwordHash: 'x' }).returning();
  userId = u!.id;
  await db.insert(transactions).values([
    { userId, date: '2026-04-01', description: 'X', rawDescription: 'X', amountCents: 800000, category: 'Income' },
    { userId, date: '2026-04-02', description: 'Y', rawDescription: 'Y', amountCents: -300000, category: 'Rent' },
    { userId, date: '2026-04-03', description: 'Z', rawDescription: 'Z', amountCents: -50000, category: 'Food' },
  ]);
});

afterAll(async () => {
  if (skip) return;
  await db.delete(users).where(eq(users.id, userId));
  await close();
});

describe.skipIf(skip)('analyticsSummary', () => {
  it('returns income/expense/savings rate for the requested month', async () => {
    const tool = analyticsSummary({ userId, db, threadId: null, currency: 'INR' });
    const out = await tool.execute({ month: '2026-04' });
    expect(out.incomeCents).toBe(800000);
    expect(out.expensesCents).toBe(350000);
    expect(out.topCategories[0]?.category).toBe('Rent');
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin pnpm --filter @perfin/agent test
```
Expected: fails.

- [ ] **Step 3: Create `packages/agent/src/tools/analytics-summary.ts`**

```ts
import { tool } from 'ai';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { transactions } from '@perfin/db';
import { computeKpis, formatCurrency } from '@perfin/core';
import type { ToolContext } from './types';

const Args = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export function analyticsSummary(ctx: ToolContext) {
  return tool({
    description: 'Aggregate income, expenses, savings rate, and top categories for a given month (defaults to current).',
    parameters: Args,
    async execute(args) {
      const month = args.month ?? new Date().toISOString().slice(0, 7);
      const all = await ctx.db
        .select({
          date: transactions.date,
          category: transactions.category,
          amountCents: transactions.amountCents,
        })
        .from(transactions)
        .where(eq(transactions.userId, ctx.userId));

      const kpis = computeKpis({ transactions: all, currentMonth: month });
      const byCat = new Map<string, number>();
      for (const t of all) {
        if (!t.date.startsWith(month)) continue;
        if (t.amountCents >= 0) continue;
        byCat.set(t.category, (byCat.get(t.category) ?? 0) + Math.abs(t.amountCents));
      }
      const topCategories = [...byCat.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category, cents]) => ({
          category,
          spendCents: cents,
          spendFormatted: formatCurrency(cents, ctx.currency),
        }));

      return {
        month,
        incomeCents: kpis.incomeCents,
        incomeFormatted: formatCurrency(kpis.incomeCents, ctx.currency),
        expensesCents: kpis.expensesCents,
        expensesFormatted: formatCurrency(kpis.expensesCents, ctx.currency),
        savingsRate: kpis.savingsRate,
        topCategories,
      };
    },
  });
}
```

- [ ] **Step 4: Run test (expect pass)**

Run:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin pnpm --filter @perfin/agent test
```
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add packages/agent
git commit -m "feat(agent): analytics.summary read tool"
```

---

## Task 6: Read tools — `recurring.detect` and `anomalies.list`

**Files:**
- Create: `packages/agent/src/tools/recurring-detect.ts`
- Create: `packages/agent/src/tools/anomalies-list.ts`

- [ ] **Step 1: Create `packages/agent/src/tools/recurring-detect.ts`**

```ts
import { tool } from 'ai';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { recurringSeries } from '@perfin/db';
import { formatCurrency } from '@perfin/core';
import type { ToolContext } from './types';

const Args = z.object({ category: z.string().optional() });

export function recurringDetect(ctx: ToolContext) {
  return tool({
    description: 'List the user\'s detected recurring payments / subscriptions, optionally filtered by category.',
    parameters: Args,
    async execute(args) {
      const rows = await ctx.db.select().from(recurringSeries).where(eq(recurringSeries.userId, ctx.userId));
      const filtered = args.category ? rows.filter((r) => r.category === args.category) : rows;
      return {
        count: filtered.length,
        rows: filtered.map((r) => ({
          merchant: r.merchant,
          category: r.category,
          amountCents: r.amountCents,
          amountFormatted: formatCurrency(r.amountCents, ctx.currency),
          cadence: r.cadence,
          confidence: r.confidence,
          firstSeen: r.firstSeen,
          lastSeen: r.lastSeen,
          nextExpectedAt: r.nextExpectedAt,
        })),
      };
    },
  });
}
```

- [ ] **Step 2: Create `packages/agent/src/tools/anomalies-list.ts`**

```ts
import { tool } from 'ai';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { anomalies } from '@perfin/db';
import type { ToolContext } from './types';

const Args = z.object({
  status: z.enum(['open', 'confirmed', 'dismissed']).optional(),
});

export function anomaliesList(ctx: ToolContext) {
  return tool({
    description: 'List anomalies (large/unusual transactions). Default status is "open".',
    parameters: Args,
    async execute(args) {
      const status = args.status ?? 'open';
      const rows = await ctx.db
        .select()
        .from(anomalies)
        .where(and(eq(anomalies.userId, ctx.userId), eq(anomalies.status, status)));
      return {
        count: rows.length,
        rows: rows.map((r) => ({
          id: r.id,
          transactionId: r.transactionId,
          kind: r.kind,
          score: r.score,
          reason: r.reason,
        })),
      };
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/agent
git commit -m "feat(agent): recurring.detect + anomalies.list read tools"
```

---

## Task 7: Read tool — `forecast.cashflow`

**Files:**
- Create: `packages/agent/src/tools/forecast-cashflow.ts`
- Create: `packages/agent/tests/forecast-cashflow.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/agent/tests/forecast-cashflow.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { __test as ft } from '../src/tools/forecast-cashflow';

describe('cashflow forecast helper', () => {
  it('projects flat using last-30-day average', () => {
    const txns = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, '0')}`,
      amountCents: -100,
    }));
    const out = ft.project({ transactions: txns, days: 30, todayIso: '2026-04-30' });
    expect(out.dailyAvgCents).toBe(-100);
    expect(out.projectedCents).toBe(-3000);
  });

  it('returns 0 projection on empty input', () => {
    const out = ft.project({ transactions: [], days: 30, todayIso: '2026-04-30' });
    expect(out.dailyAvgCents).toBe(0);
    expect(out.projectedCents).toBe(0);
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin pnpm --filter @perfin/agent test
```
Expected: fails.

- [ ] **Step 3: Create `packages/agent/src/tools/forecast-cashflow.ts`**

```ts
import { tool } from 'ai';
import { z } from 'zod';
import { and, eq, gte } from 'drizzle-orm';
import { transactions } from '@perfin/db';
import { formatCurrency } from '@perfin/core';
import type { ToolContext } from './types';

const Args = z.object({
  days: z.number().int().min(7).max(180).default(30),
});

interface ProjectInput {
  transactions: Array<{ date: string; amountCents: number }>;
  days: number;
  todayIso: string;
}

interface Projection {
  dailyAvgCents: number;
  projectedCents: number;
  startDate: string;
  endDate: string;
}

function project({ transactions: txns, days, todayIso }: ProjectInput): Projection {
  if (!txns.length) return { dailyAvgCents: 0, projectedCents: 0, startDate: todayIso, endDate: todayIso };
  const total = txns.reduce((s, t) => s + t.amountCents, 0);
  const dailyAvgCents = Math.round(total / Math.max(1, txns.length === 0 ? 1 : new Set(txns.map((t) => t.date)).size));
  const projectedCents = dailyAvgCents * days;
  const end = new Date(todayIso);
  end.setUTCDate(end.getUTCDate() + days);
  return {
    dailyAvgCents,
    projectedCents,
    startDate: todayIso,
    endDate: end.toISOString().slice(0, 10),
  };
}

export function forecastCashflow(ctx: ToolContext) {
  return tool({
    description: 'Project net cash flow over the next N days using the last 30 days as the baseline.',
    parameters: Args,
    async execute(args) {
      const today = new Date();
      const cutoff = new Date(today);
      cutoff.setUTCDate(cutoff.getUTCDate() - 30);
      const cutoffIso = cutoff.toISOString().slice(0, 10);

      const recent = await ctx.db
        .select({ date: transactions.date, amountCents: transactions.amountCents })
        .from(transactions)
        .where(and(eq(transactions.userId, ctx.userId), gte(transactions.date, cutoffIso)));

      const proj = project({
        transactions: recent,
        days: args.days,
        todayIso: today.toISOString().slice(0, 10),
      });
      return {
        ...proj,
        dailyAvgFormatted: formatCurrency(proj.dailyAvgCents, ctx.currency),
        projectedFormatted: formatCurrency(proj.projectedCents, ctx.currency),
      };
    },
  });
}

export const __test = { project };
```

- [ ] **Step 4: Run test (expect pass)**

Run:
```bash
pnpm --filter @perfin/agent test
```
Expected: 2 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/agent
git commit -m "feat(agent): forecast.cashflow read tool (linear projection)"
```

---

## Task 8: Write tools — proposal-only `transaction.update` + `transaction.split`

**Files:**
- Create: `packages/agent/src/tools/transaction-update.ts`
- Create: `packages/agent/src/tools/transaction-split.ts`
- Create: `packages/agent/tests/proposals.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/agent/tests/proposals.test.ts`:

```ts
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb, users, transactions, agentProposals, type Db } from '@perfin/db';
import { transactionUpdate } from '../src/tools/transaction-update';
import { transactionSplit } from '../src/tools/transaction-split';
import { isProposal } from '../src/tools/types';

const url = process.env.DATABASE_URL ?? 'postgres://perfin:perfin@localhost:5433/perfin';
const skip = process.env.SKIP_DB_TESTS === '1';
let db: Db;
let close: () => Promise<void>;
let userId: number;
let txnId: number;

beforeAll(async () => {
  if (skip) return;
  const created = createDb(url);
  db = created.db;
  close = created.close;
  const [u] = await db.insert(users).values({ email: `agent-pr-${Date.now()}@perfin.dev`, passwordHash: 'x' }).returning();
  userId = u!.id;
  const [t] = await db.insert(transactions).values({
    userId, date: '2026-04-15', description: 'X', rawDescription: 'X', amountCents: -20000, category: 'Other',
  }).returning();
  txnId = t!.id;
});

afterAll(async () => {
  if (skip) return;
  await db.delete(users).where(eq(users.id, userId));
  await close();
});

describe.skipIf(skip)('write proposals do not mutate immediately', () => {
  it('transaction.update creates a pending proposal', async () => {
    const tool = transactionUpdate({ userId, db, threadId: null, currency: 'INR' });
    const out = await tool.execute({ id: txnId, category: 'Food' });
    expect(isProposal(out)).toBe(true);
    expect(out.tool).toBe('transaction.update');
    const [props] = await db.select().from(agentProposals).where(eq(agentProposals.id, out.proposalId));
    expect(props?.status).toBe('pending');
    // Original txn unchanged
    const [txn] = await db.select().from(transactions).where(eq(transactions.id, txnId));
    expect(txn?.category).toBe('Other');
  });

  it('transaction.split creates a pending proposal', async () => {
    const tool = transactionSplit({ userId, db, threadId: null, currency: 'INR' });
    const out = await tool.execute({
      id: txnId,
      splits: [
        { amountCents: -10000, category: 'Food', description: 'lunch portion' },
        { amountCents: -10000, category: 'Groceries', description: 'snack portion' },
      ],
    });
    expect(isProposal(out)).toBe(true);
    expect(out.tool).toBe('transaction.split');
  });

  it('rejects splits that don\'t add up to original amount', async () => {
    const tool = transactionSplit({ userId, db, threadId: null, currency: 'INR' });
    await expect(tool.execute({
      id: txnId,
      splits: [
        { amountCents: -5000, category: 'Food', description: 'partial' },
      ],
    })).rejects.toThrow(/sum/i);
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin pnpm --filter @perfin/agent test
```
Expected: fails.

- [ ] **Step 3: Create `packages/agent/src/tools/transaction-update.ts`**

```ts
import { tool } from 'ai';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { agentProposals, transactions } from '@perfin/db';
import { CATEGORIES } from '@perfin/core';
import type { ProposalResult, ToolContext } from './types';

const Args = z.object({
  id: z.number().int().positive(),
  category: z.enum(CATEGORIES as readonly [string, ...string[]]).optional(),
  description: z.string().min(1).max(255).optional(),
});

export function transactionUpdate(ctx: ToolContext) {
  return tool({
    description: 'Propose an update to a transaction\'s category or description. Requires user confirmation.',
    parameters: Args,
    async execute(args): Promise<ProposalResult> {
      const [txn] = await ctx.db
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, args.id), eq(transactions.userId, ctx.userId)));
      if (!txn) throw new Error(`transaction ${args.id} not found`);

      const previewParts: string[] = [`Update transaction "${txn.description}" (${txn.date})`];
      if (args.category)    previewParts.push(`category → ${args.category}`);
      if (args.description) previewParts.push(`description → "${args.description}"`);
      const preview = previewParts.join(', ');

      const [row] = await ctx.db.insert(agentProposals).values({
        userId: ctx.userId,
        threadId: ctx.threadId,
        tool: 'transaction.update',
        input: args,
        preview,
        status: 'pending',
      }).returning();

      return { kind: 'proposal', proposalId: row!.id, tool: 'transaction.update', preview, args };
    },
  });
}
```

- [ ] **Step 4: Create `packages/agent/src/tools/transaction-split.ts`**

```ts
import { tool } from 'ai';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { agentProposals, transactions } from '@perfin/db';
import { CATEGORIES, formatCurrency } from '@perfin/core';
import type { ProposalResult, ToolContext } from './types';

const Args = z.object({
  id: z.number().int().positive(),
  splits: z.array(z.object({
    amountCents: z.number().int(),
    category: z.enum(CATEGORIES as readonly [string, ...string[]]),
    description: z.string().min(1).max(255),
  })).min(2),
});

export function transactionSplit(ctx: ToolContext) {
  return tool({
    description: 'Propose splitting a transaction into N child transactions. Splits must sum to the parent amount.',
    parameters: Args,
    async execute(args): Promise<ProposalResult> {
      const [txn] = await ctx.db
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, args.id), eq(transactions.userId, ctx.userId)));
      if (!txn) throw new Error(`transaction ${args.id} not found`);

      const sum = args.splits.reduce((s, p) => s + p.amountCents, 0);
      if (sum !== txn.amountCents) {
        throw new Error(`splits sum to ${sum} but parent is ${txn.amountCents}`);
      }

      const preview = `Split "${txn.description}" (${formatCurrency(txn.amountCents, ctx.currency)}) into ${args.splits.length} parts: `
        + args.splits.map((p) => `${p.category} ${formatCurrency(p.amountCents, ctx.currency)}`).join(', ');

      const [row] = await ctx.db.insert(agentProposals).values({
        userId: ctx.userId,
        threadId: ctx.threadId,
        tool: 'transaction.split',
        input: args,
        preview,
        status: 'pending',
      }).returning();

      return { kind: 'proposal', proposalId: row!.id, tool: 'transaction.split', preview, args };
    },
  });
}
```

- [ ] **Step 5: Run test (expect pass)**

Run:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin pnpm --filter @perfin/agent test
```
Expected: 3 new tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/agent
git commit -m "feat(agent): transaction.update + transaction.split write proposals (no mutation)"
```

---

## Task 9: Write tools — proposal-only `budget.upsert` and `goal.create`

**Files:**
- Create: `packages/agent/src/tools/budget-upsert.ts`
- Create: `packages/agent/src/tools/goal-create.ts`

- [ ] **Step 1: Create `packages/agent/src/tools/budget-upsert.ts`**

```ts
import { tool } from 'ai';
import { z } from 'zod';
import { agentProposals } from '@perfin/db';
import { CATEGORIES, formatCurrency } from '@perfin/core';
import type { ProposalResult, ToolContext } from './types';

const Args = z.object({
  category: z.enum(CATEGORIES as readonly [string, ...string[]]),
  amountCents: z.number().int().positive(),
  period: z.enum(['monthly', 'quarterly', 'annual']).default('monthly'),
});

export function budgetUpsert(ctx: ToolContext) {
  return tool({
    description: 'Propose creating or updating a spending budget for a category. Requires user confirmation.',
    parameters: Args,
    async execute(args): Promise<ProposalResult> {
      const preview = `Set ${args.period} budget for ${args.category}: ${formatCurrency(args.amountCents, ctx.currency)}`;
      const [row] = await ctx.db.insert(agentProposals).values({
        userId: ctx.userId,
        threadId: ctx.threadId,
        tool: 'budget.upsert',
        input: args,
        preview,
        status: 'pending',
      }).returning();
      return { kind: 'proposal', proposalId: row!.id, tool: 'budget.upsert', preview, args };
    },
  });
}
```

- [ ] **Step 2: Create `packages/agent/src/tools/goal-create.ts`**

```ts
import { tool } from 'ai';
import { z } from 'zod';
import { agentProposals } from '@perfin/db';
import { formatCurrency } from '@perfin/core';
import type { ProposalResult, ToolContext } from './types';

const Args = z.object({
  name: z.string().min(1).max(120),
  targetCents: z.number().int().positive(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export function goalCreate(ctx: ToolContext) {
  return tool({
    description: 'Propose creating a savings goal with an optional deadline. Requires user confirmation.',
    parameters: Args,
    async execute(args): Promise<ProposalResult> {
      const deadlinePart = args.deadline ? ` by ${args.deadline}` : '';
      const preview = `Create goal "${args.name}": ${formatCurrency(args.targetCents, ctx.currency)}${deadlinePart}`;
      const [row] = await ctx.db.insert(agentProposals).values({
        userId: ctx.userId,
        threadId: ctx.threadId,
        tool: 'goal.create',
        input: args,
        preview,
        status: 'pending',
      }).returning();
      return { kind: 'proposal', proposalId: row!.id, tool: 'goal.create', preview, args };
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/agent
git commit -m "feat(agent): budget.upsert + goal.create write proposals"
```

---

## Task 10: Tool registry + execute layer

**Files:**
- Create: `packages/agent/src/tools/registry.ts`
- Create: `packages/agent/src/execute.ts`
- Create: `packages/agent/tests/execute.test.ts`

- [ ] **Step 1: Create `packages/agent/src/tools/registry.ts`**

```ts
import { ledgerQuery } from './ledger-query';
import { analyticsSummary } from './analytics-summary';
import { recurringDetect } from './recurring-detect';
import { anomaliesList } from './anomalies-list';
import { forecastCashflow } from './forecast-cashflow';
import { transactionUpdate } from './transaction-update';
import { transactionSplit } from './transaction-split';
import { budgetUpsert } from './budget-upsert';
import { goalCreate } from './goal-create';
import type { ToolContext } from './types';

export function buildTools(ctx: ToolContext) {
  return {
    ledgerQuery:        ledgerQuery(ctx),
    analyticsSummary:   analyticsSummary(ctx),
    recurringDetect:    recurringDetect(ctx),
    anomaliesList:      anomaliesList(ctx),
    forecastCashflow:   forecastCashflow(ctx),
    transactionUpdate:  transactionUpdate(ctx),
    transactionSplit:   transactionSplit(ctx),
    budgetUpsert:       budgetUpsert(ctx),
    goalCreate:         goalCreate(ctx),
  };
}

export const READ_TOOLS  = ['ledgerQuery', 'analyticsSummary', 'recurringDetect', 'anomaliesList', 'forecastCashflow'] as const;
export const WRITE_TOOLS = ['transactionUpdate', 'transactionSplit', 'budgetUpsert', 'goalCreate'] as const;
```

- [ ] **Step 2: Write failing test for execute**

Create `packages/agent/tests/execute.test.ts`:

```ts
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb, users, transactions, agentProposals, agentActions, budgets, goals, type Db } from '@perfin/db';
import { transactionUpdate } from '../src/tools/transaction-update';
import { budgetUpsert } from '../src/tools/budget-upsert';
import { goalCreate } from '../src/tools/goal-create';
import { executeProposal } from '../src/execute';

const url = process.env.DATABASE_URL ?? 'postgres://perfin:perfin@localhost:5433/perfin';
const skip = process.env.SKIP_DB_TESTS === '1';
let db: Db;
let close: () => Promise<void>;
let userId: number;
let txnId: number;

beforeAll(async () => {
  if (skip) return;
  const created = createDb(url);
  db = created.db;
  close = created.close;
  const [u] = await db.insert(users).values({ email: `agent-ex-${Date.now()}@perfin.dev`, passwordHash: 'x' }).returning();
  userId = u!.id;
  const [t] = await db.insert(transactions).values({
    userId, date: '2026-04-15', description: 'X', rawDescription: 'X', amountCents: -20000, category: 'Other',
  }).returning();
  txnId = t!.id;
});

afterAll(async () => {
  if (skip) return;
  await db.delete(users).where(eq(users.id, userId));
  await close();
});

describe.skipIf(skip)('executeProposal', () => {
  it('applies a transaction.update proposal and writes audit row', async () => {
    const tool = transactionUpdate({ userId, db, threadId: null, currency: 'INR' });
    const proposal = await tool.execute({ id: txnId, category: 'Food' });
    const result = await executeProposal({ db, userId, proposalId: proposal.proposalId });
    expect(result.ok).toBe(true);
    const [t] = await db.select().from(transactions).where(eq(transactions.id, txnId));
    expect(t?.category).toBe('Food');
    const [p] = await db.select().from(agentProposals).where(eq(agentProposals.id, proposal.proposalId));
    expect(p?.status).toBe('confirmed');
    const audit = await db.select().from(agentActions).where(eq(agentActions.userId, userId));
    expect(audit.some((a) => a.tool === 'transaction.update')).toBe(true);
  });

  it('applies a budget.upsert proposal', async () => {
    const tool = budgetUpsert({ userId, db, threadId: null, currency: 'INR' });
    const proposal = await tool.execute({ category: 'Food', amountCents: 50000, period: 'monthly' });
    await executeProposal({ db, userId, proposalId: proposal.proposalId });
    const rows = await db.select().from(budgets).where(eq(budgets.userId, userId));
    expect(rows.find((b) => b.category === 'Food')?.amountCents).toBe(50000);
  });

  it('applies a goal.create proposal', async () => {
    const tool = goalCreate({ userId, db, threadId: null, currency: 'INR' });
    const proposal = await tool.execute({ name: 'Japan trip', targetCents: 500000, deadline: '2026-12-31' });
    await executeProposal({ db, userId, proposalId: proposal.proposalId });
    const rows = await db.select().from(goals).where(eq(goals.userId, userId));
    expect(rows.find((g) => g.name === 'Japan trip')?.targetCents).toBe(500000);
  });
});
```

- [ ] **Step 3: Run test (expect fail)**

Run:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin pnpm --filter @perfin/agent test
```
Expected: fails — `executeProposal` not found.

- [ ] **Step 4: Create `packages/agent/src/execute.ts`**

```ts
import { and, eq } from 'drizzle-orm';
import {
  agentActions, agentProposals, budgets, goals, transactions, type Db,
} from '@perfin/db';

export interface ExecuteInput {
  db: Db;
  userId: number;
  proposalId: number;
}

export interface ExecuteOutput {
  ok: boolean;
  output: unknown;
}

export async function executeProposal({ db, userId, proposalId }: ExecuteInput): Promise<ExecuteOutput> {
  const [proposal] = await db
    .select()
    .from(agentProposals)
    .where(and(eq(agentProposals.id, proposalId), eq(agentProposals.userId, userId)));
  if (!proposal) throw new Error(`proposal ${proposalId} not found`);
  if (proposal.status !== 'pending') throw new Error(`proposal ${proposalId} is ${proposal.status}`);

  let output: unknown;
  switch (proposal.tool) {
    case 'transaction.update':
      output = await applyTransactionUpdate(db, userId, proposal.input as { id: number; category?: string; description?: string });
      break;
    case 'transaction.split':
      output = await applyTransactionSplit(db, userId, proposal.input as { id: number; splits: Array<{ amountCents: number; category: string; description: string }> });
      break;
    case 'budget.upsert':
      output = await applyBudgetUpsert(db, userId, proposal.input as { category: string; amountCents: number; period: 'monthly' | 'quarterly' | 'annual' });
      break;
    case 'goal.create':
      output = await applyGoalCreate(db, userId, proposal.input as { name: string; targetCents: number; deadline?: string });
      break;
    default:
      throw new Error(`unknown tool: ${proposal.tool}`);
  }

  await db.update(agentProposals).set({
    status: 'confirmed',
    confirmedAt: new Date(),
    output: output as Record<string, unknown>,
  }).where(eq(agentProposals.id, proposalId));

  await db.insert(agentActions).values({
    userId,
    tool: proposal.tool,
    input: proposal.input,
    output: output as Record<string, unknown>,
    confirmedBy: userId,
    confirmedAt: new Date(),
  });

  return { ok: true, output };
}

async function applyTransactionUpdate(
  db: Db, userId: number,
  input: { id: number; category?: string; description?: string },
) {
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.category)    patch.category = input.category;
  if (input.description) patch.description = input.description;
  await db.update(transactions).set(patch).where(and(eq(transactions.id, input.id), eq(transactions.userId, userId)));
  return { id: input.id, ...patch };
}

async function applyTransactionSplit(
  db: Db, userId: number,
  input: { id: number; splits: Array<{ amountCents: number; category: string; description: string }> },
) {
  const [parent] = await db.select().from(transactions).where(and(eq(transactions.id, input.id), eq(transactions.userId, userId)));
  if (!parent) throw new Error('parent transaction not found');
  const childIds: number[] = [];
  for (const s of input.splits) {
    const [child] = await db.insert(transactions).values({
      userId,
      accountId: parent.accountId,
      date: parent.date,
      description: s.description,
      rawDescription: parent.rawDescription,
      amountCents: s.amountCents,
      category: s.category,
      sourceFile: parent.sourceFile,
      parentTransactionId: parent.id,
    }).returning({ id: transactions.id });
    if (child) childIds.push(child.id);
  }
  return { parentId: input.id, childIds };
}

async function applyBudgetUpsert(
  db: Db, userId: number,
  input: { category: string; amountCents: number; period: 'monthly' | 'quarterly' | 'annual' },
) {
  await db.insert(budgets)
    .values({ userId, category: input.category, amountCents: input.amountCents, period: input.period })
    .onConflictDoUpdate({
      target: [budgets.userId, budgets.category, budgets.period, budgets.accountId],
      set: { amountCents: input.amountCents, updatedAt: new Date() },
    });
  return { category: input.category, amountCents: input.amountCents, period: input.period };
}

async function applyGoalCreate(
  db: Db, userId: number,
  input: { name: string; targetCents: number; deadline?: string },
) {
  const [row] = await db.insert(goals).values({
    userId, name: input.name, targetCents: input.targetCents, deadline: input.deadline ?? null,
  }).returning();
  return row;
}
```

- [ ] **Step 5: Run test (expect pass)**

Run:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin pnpm --filter @perfin/agent test
```
Expected: 3 new tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/agent
git commit -m "feat(agent): tool registry + executeProposal (atomic write + audit)"
```

---

## Task 11: Web — install AI SDK + react-markdown

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add dependencies**

Edit `apps/web/package.json` — add to `dependencies`:

```json
"@ai-sdk/anthropic": "0.0.55",
"@perfin/agent": "workspace:*",
"ai": "4.0.10",
"react-markdown": "9.0.1"
```

- [ ] **Step 2: Install + commit**

```bash
pnpm install
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add Vercel AI SDK + Anthropic provider + @perfin/agent"
```

---

## Task 12: Web — `POST /api/ask/stream` route

**Files:**
- Create: `apps/web/app/api/ask/stream/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { eq, desc } from 'drizzle-orm';
import { createDb, accounts, chatMessages, chatThreads, transactions } from '@perfin/db';
import { buildSystemPrompt, buildTools } from '@perfin/agent';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return new Response('unauthorized', { status: 401 });
  const userId = Number(userIdStr);

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response('ANTHROPIC_API_KEY not configured', { status: 500 });
  }

  const body = await req.json() as { messages: Array<{ role: string; content: string }>; threadId?: number };

  // Ensure thread exists; create on first message
  let threadId = body.threadId;
  if (!threadId) {
    const title = (body.messages[body.messages.length - 1]?.content ?? 'New chat').slice(0, 60);
    const [t] = await db.insert(chatThreads).values({ userId, title }).returning();
    threadId = t!.id;
  }

  // Persist the latest user message
  const lastUser = [...body.messages].reverse().find((m) => m.role === 'user');
  if (lastUser) {
    await db.insert(chatMessages).values({
      threadId,
      role: 'user',
      content: lastUser.content,
    });
  }

  // Context for the system prompt
  const accs = await db.select({ name: accounts.name, currency: accounts.currency }).from(accounts).where(eq(accounts.userId, userId));
  const currency = accs[0]?.currency ?? 'INR';
  const topCats = await db
    .select({ category: transactions.category })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.date))
    .limit(50);
  const uniqueCats = [...new Set(topCats.map((t) => t.category))].slice(0, 8);

  const systemPrompt = buildSystemPrompt({
    currency,
    topCategories: uniqueCats,
    accountNames: accs.map((a) => a.name),
    todayIso: new Date().toISOString().slice(0, 10),
  });

  const tools = buildTools({ userId, db, threadId, currency });

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: systemPrompt,
    messages: body.messages,
    tools,
    maxSteps: 5,
    onFinish: async ({ text, toolCalls, toolResults }) => {
      await db.insert(chatMessages).values({
        threadId,
        role: 'assistant',
        content: text,
        toolCalls: toolCalls.length ? (toolCalls as unknown as Record<string, unknown>) : null,
        toolResults: toolResults.length ? (toolResults as unknown as Record<string, unknown>) : null,
      });
      await db.update(chatThreads).set({ updatedAt: new Date() }).where(eq(chatThreads.id, threadId));
    },
  });

  return result.toDataStreamResponse({ headers: { 'X-Thread-Id': String(threadId) } });
}
```

- [ ] **Step 2: Typecheck**

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 \
AUTH_URL=http://localhost:3000 \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
  pnpm --filter @perfin/web typecheck
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/ask
git commit -m "feat(web): POST /api/ask/stream (Vercel AI SDK + tools + thread persistence)"
```

---

## Task 13: Web — thread CRUD routes

**Files:**
- Create: `apps/web/app/api/ask/threads/route.ts`
- Create: `apps/web/app/api/ask/threads/[id]/route.ts`

- [ ] **Step 1: Create `apps/web/app/api/ask/threads/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { createDb, chatThreads } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);
  const rows = await db
    .select()
    .from(chatThreads)
    .where(eq(chatThreads.userId, userId))
    .orderBy(desc(chatThreads.updatedAt))
    .limit(20);
  return NextResponse.json({ rows });
}
```

- [ ] **Step 2: Create `apps/web/app/api/ask/threads/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { createDb, chatMessages, chatThreads } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);
  const { id } = await params;
  const threadId = Number(id);

  const [thread] = await db.select().from(chatThreads).where(and(eq(chatThreads.id, threadId), eq(chatThreads.userId, userId)));
  if (!thread) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const messages = await db.select().from(chatMessages).where(eq(chatMessages.threadId, threadId)).orderBy(asc(chatMessages.createdAt));
  return NextResponse.json({ thread, messages });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);
  const { id } = await params;
  await db.delete(chatThreads).where(and(eq(chatThreads.id, Number(id)), eq(chatThreads.userId, userId)));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/ask/threads
git commit -m "feat(web): /api/ask/threads list + thread detail + delete"
```

---

## Task 14: Web — proposal confirm/cancel routes + activity

**Files:**
- Create: `apps/web/app/api/agent/proposals/[id]/confirm/route.ts`
- Create: `apps/web/app/api/agent/proposals/[id]/cancel/route.ts`
- Create: `apps/web/app/api/agent/activity/route.ts`

- [ ] **Step 1: Create confirm route**

`apps/web/app/api/agent/proposals/[id]/confirm/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { createDb } from '@perfin/db';
import { executeProposal } from '@perfin/agent';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);
  const { id } = await params;
  try {
    const out = await executeProposal({ db, userId, proposalId: Number(id) });
    return NextResponse.json(out);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
```

- [ ] **Step 2: Create cancel route**

`apps/web/app/api/agent/proposals/[id]/cancel/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { createDb, agentProposals } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);
  const { id } = await params;
  await db.update(agentProposals).set({
    status: 'cancelled',
    cancelledAt: new Date(),
  }).where(and(eq(agentProposals.id, Number(id)), eq(agentProposals.userId, userId), eq(agentProposals.status, 'pending')));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Create activity route**

`apps/web/app/api/agent/activity/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { createDb, agentActions } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);
  const rows = await db
    .select()
    .from(agentActions)
    .where(eq(agentActions.userId, userId))
    .orderBy(desc(agentActions.createdAt))
    .limit(100);
  return NextResponse.json({ rows });
}
```

- [ ] **Step 4: Typecheck and commit**

```bash
pnpm --filter @perfin/web typecheck
git add apps/web/app/api/agent
git commit -m "feat(web): /api/agent/proposals/{id}/{confirm,cancel} + /api/agent/activity"
```

---

## Task 15: Web — starter prompts + hooks

**Files:**
- Create: `apps/web/lib/starter-prompts.ts`
- Create: `apps/web/hooks/useThreads.ts`
- Create: `apps/web/hooks/useActivity.ts`

- [ ] **Step 1: Create `apps/web/lib/starter-prompts.ts`**

```ts
export const STARTER_PROMPTS: string[] = [
  'How am I doing this month?',
  'What can I cut to save more?',
  'Show me every Amazon over $200.',
  'Find subscriptions I might not need.',
  'Forecast my cash flow for the next 60 days.',
  'Make me a budget for next month.',
];
```

- [ ] **Step 2: Create `apps/web/hooks/useThreads.ts`**

```ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface ThreadRow {
  id: number;
  title: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useThreads() {
  return useQuery<{ rows: ThreadRow[] }>({
    queryKey: ['threads'],
    queryFn: () => apiFetch<{ rows: ThreadRow[] }>('/api/ask/threads'),
  });
}
```

- [ ] **Step 3: Create `apps/web/hooks/useActivity.ts`**

```ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface AgentAction {
  id: number;
  tool: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  createdAt: string;
  confirmedAt: string | null;
}

export function useActivity() {
  return useQuery<{ rows: AgentAction[] }>({
    queryKey: ['agent-activity'],
    queryFn: () => apiFetch<{ rows: AgentAction[] }>('/api/agent/activity'),
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib apps/web/hooks
git commit -m "feat(web): starter prompts + useThreads + useActivity hooks"
```

---

## Task 16: Web — chat UI primitives (ChatBubble, ToolCard, ProposalCard, MessageComposer, StarterPrompts, ThreadList)

**Files:**
- Create: `apps/web/components/ask/ChatBubble.tsx`
- Create: `apps/web/components/ask/ToolCard.tsx`
- Create: `apps/web/components/ask/ProposalCard.tsx`
- Create: `apps/web/components/ask/MessageComposer.tsx`
- Create: `apps/web/components/ask/StarterPrompts.tsx`
- Create: `apps/web/components/ask/ThreadList.tsx`

- [ ] **Step 1: Create `apps/web/components/ask/ChatBubble.tsx`**

```tsx
'use client';

import ReactMarkdown from 'react-markdown';
import { cn } from '@perfin/ui';
import type { ReactNode } from 'react';

export interface ChatBubbleProps {
  role: 'user' | 'assistant';
  children: ReactNode;
}

export function ChatBubble({ role, children }: ChatBubbleProps) {
  const me = role === 'user';
  return (
    <div className={cn('flex gap-3', me ? 'justify-end' : 'justify-start')}>
      {!me && <div className="w-7 h-7 rounded-full bg-accent text-white grid place-items-center text-xs font-semibold">P</div>}
      <div className={cn(
        'max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed',
        me ? 'bg-accent-soft border border-[var(--accent-soft)]' : 'bg-surface-2 border border-border',
      )}>
        {typeof children === 'string'
          ? <ReactMarkdown components={{ p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p> }}>{children}</ReactMarkdown>
          : children}
      </div>
      {me && <div className="w-7 h-7 rounded-full bg-surface-3 text-text grid place-items-center text-xs font-semibold">N</div>}
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/web/components/ask/ToolCard.tsx`**

```tsx
'use client';

import { cn } from '@perfin/ui';

export interface ToolCardProps {
  toolName: string;
  status: 'running' | 'done' | 'error';
  summary?: string;
  ms?: number;
}

export function ToolCard({ toolName, status, summary, ms }: ToolCardProps) {
  const icon = status === 'done' ? '✓' : status === 'error' ? '✕' : '⋯';
  const color = status === 'done' ? 'text-positive' : status === 'error' ? 'text-negative' : 'text-text-muted';
  return (
    <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md font-mono text-xs bg-surface border border-dashed border-border-strong text-text-muted">
      <span className={cn(color, 'font-semibold')}>{icon}</span>
      <span className="text-text">{toolName}</span>
      {summary && <span>· {summary}</span>}
      {typeof ms === 'number' && <span>· {ms}ms</span>}
    </div>
  );
}
```

- [ ] **Step 3: Create `apps/web/components/ask/ProposalCard.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Tile } from '@perfin/ui';
import { apiFetch } from '@/lib/api';

export interface ProposalCardProps {
  proposalId: number;
  tool: string;
  preview: string;
  onConfirmed?: (output: unknown) => void;
}

export function ProposalCard({ proposalId, tool, preview, onConfirmed }: ProposalCardProps) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<'pending' | 'confirmed' | 'cancelled'>('pending');

  if (decision !== 'pending') {
    return (
      <Tile className="text-sm text-text-muted">
        {decision === 'confirmed' ? '✓ Applied' : '✕ Cancelled'} — <span className="font-mono text-xs">{tool}</span>
      </Tile>
    );
  }

  const confirm = async () => {
    setBusy(true);
    try {
      const out = await apiFetch<{ ok: boolean; output: unknown }>(`/api/agent/proposals/${proposalId}/confirm`, { method: 'POST' });
      setDecision('confirmed');
      onConfirmed?.(out.output);
      qc.invalidateQueries(); // refresh transactions, budgets, goals, activity, etc.
    } finally { setBusy(false); }
  };
  const cancel = async () => {
    setBusy(true);
    try {
      await apiFetch<{ ok: boolean }>(`/api/agent/proposals/${proposalId}/cancel`, { method: 'POST' });
      setDecision('cancelled');
    } finally { setBusy(false); }
  };

  return (
    <Tile variant="raised" className="space-y-3">
      <div className="text-xs uppercase tracking-wider font-semibold text-accent">Proposed change</div>
      <div className="text-sm text-text">{preview}</div>
      <div className="text-xs text-text-subtle font-mono">{tool}</div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" variant="primary" onClick={confirm} disabled={busy}>
          {busy ? 'Applying…' : '✓ Confirm'}
        </Button>
        <Button size="sm" variant="ghost" onClick={cancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </Tile>
  );
}
```

- [ ] **Step 4: Create `apps/web/components/ask/MessageComposer.tsx`**

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@perfin/ui';

export function MessageComposer({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  }
  return (
    <form onSubmit={submit} className="sticky bottom-0 bg-bg pt-3 border-t border-border">
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Ask anything about your money…"
          className="flex-1 px-3 py-2 rounded-md bg-surface-2 border border-border-strong text-text resize-none focus:outline-none focus:border-accent focus:shadow-ring"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit(e as unknown as FormEvent);
            }
          }}
        />
        <Button type="submit" disabled={disabled || !text.trim()}>Send</Button>
      </div>
      <div className="text-xs text-text-subtle mt-1">Enter to send · Shift+Enter for newline</div>
    </form>
  );
}
```

- [ ] **Step 5: Create `apps/web/components/ask/StarterPrompts.tsx`**

```tsx
'use client';

import { Tile } from '@perfin/ui';
import { STARTER_PROMPTS } from '@/lib/starter-prompts';

export function StarterPrompts({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {STARTER_PROMPTS.map((p) => (
        <button key={p} type="button" onClick={() => onPick(p)} className="text-left">
          <Tile className="hover:bg-surface-2 transition-colors duration-[120ms]">
            <span className="text-sm">{p}</span>
          </Tile>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Create `apps/web/components/ask/ThreadList.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { useThreads } from '@/hooks/useThreads';
import { cn } from '@perfin/ui';

export function ThreadList({ activeId }: { activeId: number | null }) {
  const { data, isLoading } = useThreads();
  return (
    <aside className="w-60 h-full border-r border-border p-3 space-y-1 overflow-y-auto">
      <Link href="/app/ask" className="block h-9 px-3 rounded-md text-sm font-medium bg-accent text-white grid items-center hover:bg-accent-hover">
        + New chat
      </Link>
      <div className="text-xs uppercase tracking-wider font-semibold text-text-subtle px-2 mt-3">Recent</div>
      {isLoading
        ? <div className="text-xs text-text-muted px-2">Loading…</div>
        : (data?.rows ?? []).map((t) => (
          <Link
            key={t.id}
            href={`/app/ask?thread=${t.id}`}
            className={cn(
              'block px-3 py-2 rounded-md text-sm truncate',
              activeId === t.id ? 'bg-accent-soft text-accent' : 'text-text-muted hover:bg-surface-2 hover:text-text',
            )}
          >
            {t.title}
          </Link>
        ))}
    </aside>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/ask
git commit -m "feat(web): chat UI primitives (ChatBubble, ToolCard, ProposalCard, Composer, ThreadList, StarterPrompts)"
```

---

## Task 17: Web — `useAskChat` hook + Ask page

**Files:**
- Create: `apps/web/hooks/useAskChat.ts`
- Create: `apps/web/app/(app)/ask/page.tsx`

- [ ] **Step 1: Create `apps/web/hooks/useAskChat.ts`**

```ts
'use client';

import { useChat } from 'ai/react';

export function useAskChat(threadId: number | null) {
  return useChat({
    api: '/api/ask/stream',
    body: threadId ? { threadId } : undefined,
    maxSteps: 5,
  });
}
```

- [ ] **Step 2: Create `apps/web/app/(app)/ask/page.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Message } from 'ai';
import { ThreadList } from '@/components/ask/ThreadList';
import { ChatBubble } from '@/components/ask/ChatBubble';
import { ToolCard } from '@/components/ask/ToolCard';
import { ProposalCard } from '@/components/ask/ProposalCard';
import { MessageComposer } from '@/components/ask/MessageComposer';
import { StarterPrompts } from '@/components/ask/StarterPrompts';
import { useAskChat } from '@/hooks/useAskChat';
import { apiFetch } from '@/lib/api';

interface PriorMessage {
  id: number;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  createdAt: string;
}

export default function AskPage() {
  const sp = useSearchParams();
  const queryThread = sp.get('thread');
  const [threadId, setThreadId] = useState<number | null>(queryThread ? Number(queryThread) : null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const { messages, append, isLoading, setMessages } = useAskChat(threadId);

  // Hydrate history when switching threads
  useEffect(() => {
    if (!threadId) { setMessages([]); setHistoryLoaded(true); return; }
    setHistoryLoaded(false);
    apiFetch<{ messages: PriorMessage[] }>(`/api/ask/threads/${threadId}`).then(({ messages: prior }) => {
      const seed: Message[] = prior
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ id: String(m.id), role: m.role as 'user' | 'assistant', content: m.content }));
      setMessages(seed);
      setHistoryLoaded(true);
    });
  }, [threadId, setMessages]);

  return (
    <div className="flex h-screen">
      <ThreadList activeId={threadId} />
      <main className="flex-1 flex flex-col p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Ask Perfin</h1>
        {historyLoaded && messages.length === 0 ? (
          <div className="space-y-4 flex-1">
            <p className="text-text-muted text-sm">Try one of these to get started:</p>
            <StarterPrompts onPick={(p) => append({ role: 'user', content: p })} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4">
            {messages.map((m) => (
              <div key={m.id} className="space-y-2">
                {m.toolInvocations?.map((ti) => {
                  if (ti.state === 'result' && isProposalResult(ti.result)) {
                    const r = ti.result as { proposalId: number; tool: string; preview: string };
                    return <ProposalCard key={ti.toolCallId} proposalId={r.proposalId} tool={r.tool} preview={r.preview} />;
                  }
                  return (
                    <ToolCard
                      key={ti.toolCallId}
                      toolName={ti.toolName}
                      status={ti.state === 'result' ? 'done' : 'running'}
                      summary={ti.state === 'result' ? summarize(ti.result) : undefined}
                    />
                  );
                })}
                {m.content && <ChatBubble role={m.role === 'user' ? 'user' : 'assistant'}>{m.content}</ChatBubble>}
              </div>
            ))}
          </div>
        )}
        <MessageComposer
          onSend={(text) => append({ role: 'user', content: text })}
          disabled={isLoading}
        />
      </main>
    </div>
  );

  // helpers ----------------------------------------------------------------
  function isProposalResult(v: unknown): boolean {
    return !!v && typeof v === 'object' && (v as { kind?: string }).kind === 'proposal';
  }
  function summarize(result: unknown): string | undefined {
    if (!result || typeof result !== 'object') return undefined;
    const r = result as Record<string, unknown>;
    if (typeof r.count === 'number')   return `${r.count} rows`;
    if (typeof r.merchant === 'string') return r.merchant as string;
    return undefined;
  }
}
```

- [ ] **Step 3: Add `ANTHROPIC_API_KEY` to web env**

Edit `apps/web/lib/env.ts` — add to schema:

```diff
   WORKER_URL: z.string().url().default('http://localhost:8001'),
   WORKER_HMAC_SECRET: z.string().min(8),
+  ANTHROPIC_API_KEY: z.string().optional(),
 });

 export const env = schema.parse({
   ...
   WORKER_HMAC_SECRET: process.env.WORKER_HMAC_SECRET,
+  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
 });
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
git commit -m "feat(web): Ask page (chat, tools, proposals, threads, starter prompts)"
```

---

## Task 18: Web — Settings layout + Activity page

**Files:**
- Create: `apps/web/app/(app)/settings/layout.tsx`
- Create: `apps/web/app/(app)/settings/activity/page.tsx`

- [ ] **Step 1: Create `apps/web/app/(app)/settings/layout.tsx`**

```tsx
import type { ReactNode } from 'react';
import Link from 'next/link';

const tabs = [
  { href: '/app/settings/activity', label: 'Activity' },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="p-8 max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <nav className="flex gap-2 border-b border-border">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className="h-9 px-4 text-sm font-medium text-text-muted hover:text-text">
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/web/app/(app)/settings/activity/page.tsx`**

```tsx
'use client';

import { Tile, Skeleton, Badge } from '@perfin/ui';
import { useActivity } from '@/hooks/useActivity';

export default function ActivityPage() {
  const { data, isLoading } = useActivity();
  if (isLoading) return <Skeleton variant="tile" />;
  if (!data?.rows.length) {
    return <Tile className="text-text-muted text-sm">No agent actions yet. Ask Perfin to do something to see it appear here.</Tile>;
  }
  return (
    <div className="space-y-3">
      {data.rows.map((a) => (
        <Tile key={a.id} className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="accent">{a.tool}</Badge>
            <span className="text-xs text-text-subtle">{new Date(a.createdAt).toLocaleString()}</span>
          </div>
          <pre className="text-xs font-mono bg-surface-2 p-2 rounded-md overflow-x-auto">{JSON.stringify(a.input, null, 2)}</pre>
          {a.output != null && (
            <details className="text-xs">
              <summary className="cursor-pointer text-text-muted">Output</summary>
              <pre className="font-mono bg-surface-2 p-2 rounded-md overflow-x-auto mt-1">{JSON.stringify(a.output, null, 2)}</pre>
            </details>
          )}
        </Tile>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(app\)/settings
git commit -m "feat(web): Settings layout + Activity audit page"
```

---

## Task 19: Wire `Ask` and `Settings` into the sidebar

**Files:**
- Modify: `apps/web/components/Sidebar.tsx` (already lists `/app/ask`; add Settings link in footer)

- [ ] **Step 1: Edit footer of `apps/web/components/Sidebar.tsx`**

Replace the existing `<footer>` block with:

```tsx
      <footer className="p-3 border-t border-border space-y-2">
        <Link
          href="/app/upload"
          className="flex items-center gap-2 h-9 px-3 rounded-md text-sm font-medium bg-accent text-white hover:bg-accent-hover"
        >
          <Upload className="w-4 h-4" /> Upload statement
        </Link>
        <Link
          href="/app/settings/activity"
          className="flex items-center gap-2 h-9 px-3 rounded-md text-sm font-medium text-text-muted hover:bg-surface-2 hover:text-text"
        >
          Settings
        </Link>
        <p className="text-xs text-text-subtle px-3">v0.4 · Phase 3</p>
      </footer>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/Sidebar.tsx
git commit -m "feat(web): sidebar footer adds Settings link, bumps version label"
```

---

## Task 20: Playwright e2e — ask flow

**Files:**
- Create: `apps/web/tests/e2e/ask-flow.spec.ts`

- [ ] **Step 1: Create the test**

```ts
import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';

test.describe('Ask page', () => {
  test('shows starter prompts on empty thread', async ({ page }) => {
    const stamp = Date.now();
    const email = `e2e-ask-${stamp}@perfin.dev`;
    const password = 'password12345';

    await page.goto('/signup');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /create account/i }).click();
    await page.waitForURL('**/onboarding/welcome');
    await page.getByRole('link', { name: /get started/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('link', { name: /skip for now/i }).click();
    await page.waitForURL('**/app');

    await page.goto('/app/ask');
    await expect(page.getByRole('heading', { name: 'Ask Perfin' })).toBeVisible();
    await expect(page.getByText('How am I doing this month?')).toBeVisible();
  });

  test('with API key set: ask a question and stream a tool call', async ({ page }) => {
    test.skip(!process.env.ANTHROPIC_API_KEY, 'requires ANTHROPIC_API_KEY');
    const stamp = Date.now();
    const email = `e2e-ask-live-${stamp}@perfin.dev`;
    const password = 'password12345';

    await page.goto('/signup');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /create account/i }).click();
    await page.waitForURL('**/onboarding/welcome');
    await page.getByRole('link', { name: /get started/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('link', { name: /upload a statement/i }).click();
    await page.waitForURL('**/upload');
    await page.locator('input[type="file"]').setInputFiles(resolve(__dirname, '../../../../data/seeds/60-day-sample.csv'));
    await page.waitForURL('**/app/transactions', { timeout: 30_000 });

    await page.goto('/app/ask');
    await page.locator('textarea').fill('How much did I spend on Food this month?');
    await page.getByRole('button', { name: 'Send' }).click();

    // ToolCard with ledgerQuery or analyticsSummary should appear
    await expect(page.getByText(/ledgerQuery|analyticsSummary/).first()).toBeVisible({ timeout: 30_000 });
    // Reply mentioning a money figure
    await expect(page.locator('text=/[₹$€£]\\s?[0-9]/').first()).toBeVisible({ timeout: 30_000 });
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/tests
git commit -m "test(web): e2e for Ask page (starter prompts + live API path gated by env)"
```

---

## Task 21: Phase 3 acceptance — full sweep

- [ ] **Step 1: Typecheck**

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 \
AUTH_URL=http://localhost:3000 \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
  pnpm typecheck
```
Expected: clean.

- [ ] **Step 2: Tests**

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 \
AUTH_URL=http://localhost:3000 \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
  pnpm test
```
Expected: ≥ 158 tests pass (≥ 30 new in `@perfin/agent`).

- [ ] **Step 3: Build**

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 \
AUTH_URL=http://localhost:3000 \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
  pnpm build
```
Expected: web (≥ 31 routes) + worker both build.

- [ ] **Step 4: e2e (no API key path)**

```bash
docker compose up -d
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin pnpm db:migrate

DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 \
AUTH_URL=http://localhost:3000 \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
CRON_DISABLED=1 \
  pnpm --filter @perfin/web test:e2e
```
Expected: 4-5 e2e tests pass (the live-API ask test is auto-skipped without `ANTHROPIC_API_KEY`).

- [ ] **Step 5: Manual smoke (with API key set)**

Set `ANTHROPIC_API_KEY` in `.env`, restart dev servers, sign up fresh, upload `data/seeds/60-day-sample.csv`, open `/app/ask`. Try:
1. *"How much did I spend on Food this month?"* — confirm a `ToolCard` for `ledgerQuery` or `analyticsSummary` renders, then a Claude reply with a money figure.
2. *"Set me a $400/mo dining budget."* — confirm a `ProposalCard` appears for `budget.upsert`, click Confirm, then visit `/app/budgets` to see the new entry.
3. *"Cancel that"* — start another proposal, click Cancel, verify nothing is created.
4. Visit `/app/settings/activity` — see the confirmed proposal logged.

- [ ] **Step 6: Tag + push + PHASES update**

```bash
git tag v0.4.0-phase3
git push origin main
git push origin v0.4.0-phase3
```

Edit `docs/PHASES.md`: move Phase 3 to ✅ Done, add a completion-notes section. Commit:

```bash
git add docs/PHASES.md
git commit -m "docs(phases): mark Phase 3 as done"
git push origin main
```

---

## Phase 3 — Definition of done

- [ ] All 21 tasks committed
- [ ] `pnpm typecheck` clean across all packages (now 7: db, ui, core, extractors, agent, web, worker)
- [ ] `pnpm test` passes — ≥ 158 unit tests
- [ ] `pnpm build` succeeds — web routes ≥ 31
- [ ] Playwright e2e: at least the starter-prompts test passes; the live-API test passes when `ANTHROPIC_API_KEY` is set
- [ ] Manual smoke: 4-step flow above succeeds
- [ ] Tag `v0.4.0-phase3` on `main`, pushed
- [ ] `docs/PHASES.md` updated

---

## Self-review notes

**Spec coverage check.** The design spec's Phase 3 calls for: Ask page (Tasks 16-17), Vercel AI SDK + Claude streaming (Task 12), 9 agent tools (Tasks 4-9), write-confirm flow (Tasks 8-9 propose; Task 14 confirms), `agent_actions` audit log (Task 10 writes; Task 14 + 18 surfaces). All covered. The "Settings → Activity" page (Task 18) is the audit surface.

**Type-consistency check.** `ToolContext` is the same shape passed everywhere. `ProposalResult` is returned by every write tool and recognized in `apps/web/app/(app)/ask/page.tsx` via `isProposalResult`. The DB schema columns referenced from `executeProposal` (`agentProposals.input`, `.status`, `.confirmedAt`, `.cancelledAt`) match the `agentProposals` table definition (Task 1). The `agent_actions` insert uses fields that match the existing schema from Phase 0 (`tool`, `input`, `output`, `confirmedBy`, `confirmedAt`).

**Out of scope — deferred.** Phase 4: Plaid Link, Postmark inbound email, Connections page, scheduled syncs. Phase 5: marketing site, Stripe billing, PWA push. Multi-step agent dialog enhancements (long-running tools, follow-up clarifications, multi-modal attachments) are explicit non-goals for v1.

**Risk notes.**
- *AI SDK version drift.* `ai` 4.0.x and `@ai-sdk/anthropic` 0.0.5x APIs are stable enough for our use, but the `streamText` / `tool` surface evolves between minor versions. Pinning exact versions in `package.json` is intentional. If the install yields a different shape, the route in Task 12 may need a small adjustment.
- *Cost.* Each chat turn costs roughly the sum of system prompt + history + tool roundtrips × Sonnet pricing. Prompt caching is enabled in the system message. Even so, **set a Anthropic spend limit** before going live with public users. The Phase 3 tests don't make live calls.
- *Concurrency on confirm.* `executeProposal` reads-then-writes without explicit transactions for the simpler tools. Drizzle's batched inserts are atomic per-statement; for `transaction.split` there's a small window where partial inserts could land if the process crashes mid-loop. v1 accepts this risk; Phase 4 will wrap it in a Drizzle `db.transaction(...)` block when we add Plaid (which has stricter idempotency requirements).
- *Tool schema vs UI rendering.* Read-tool results are pretty-printed by the model in its reply; the `ToolCard` only shows count/merchant. Write-tool results render as `ProposalCard` because `kind === 'proposal'` is checked client-side. If we ever add a tool whose `execute` returns the same shape but isn't a proposal, this routing breaks. Mitigation: `kind: 'proposal'` is only set inside the four proposal tools and `executeProposal` overwrites the row's `output` with a different shape on confirm.
