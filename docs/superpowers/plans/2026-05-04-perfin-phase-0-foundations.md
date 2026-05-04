# Perfin — Phase 0: Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the new Perfin monorepo with a running Next.js 15 web app, Fastify worker skeleton, Postgres database with the full Drizzle schema, working Auth.js signup/login, the `packages/ui` design-system primitives in dark-first tokens, and a one-shot import script that pulls existing SQLite data into Postgres.

**Architecture:** Turborepo monorepo with `apps/web` (Next.js 15 App Router for marketing + app surfaces), `apps/worker` (Fastify long-running service skeleton — endpoints land in Phase 1), `packages/db` (Drizzle schema + migrations), `packages/ui` (shadcn-style primitives over Tailwind v4 with token-based theme), `packages/config` (shared eslint/tsconfig/tailwind preset). Database is Postgres via docker-compose locally and Neon serverless in deploy. Auth is Auth.js v5 with credentials + Google OAuth, JWT sessions in httpOnly cookies.

**Tech Stack:** pnpm 9 · Turborepo 2 · TypeScript 5.6 · Next.js 15 · React 19 · Tailwind CSS v4 · Drizzle ORM 0.36 · Postgres 16 · better-sqlite3 (read-only, import only) · Auth.js v5 (next-auth@5) · Fastify 5 · Vitest 2 · Playwright 1.48 · Radix UI primitives.

**Phase 0 acceptance:** A new user can `pnpm install`, `docker compose up`, `pnpm db:migrate`, `pnpm dev` — visit `localhost:3000`, sign up, land on `/app` with the dark sidebar shell visible, and the `/health` endpoint on the worker returns `200`. All packages typecheck. The Playwright happy-path test passes.

---

## File Structure

Files created in this phase:

```
perfin/
├── .env.example                          # Documented env vars
├── .gitignore                            # Node + Next + DB
├── docker-compose.yml                    # Postgres for local dev
├── package.json                          # Root: workspaces, scripts
├── pnpm-workspace.yaml                   # Workspaces declaration
├── turbo.json                            # Turborepo pipeline
│
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── layout.tsx                # Root: tokens.css import, fonts
│   │   │   ├── page.tsx                  # Landing placeholder
│   │   │   ├── (auth)/
│   │   │   │   ├── layout.tsx            # Auth shell (centered)
│   │   │   │   ├── login/page.tsx
│   │   │   │   ├── login/actions.ts      # Server action
│   │   │   │   ├── signup/page.tsx
│   │   │   │   └── signup/actions.ts
│   │   │   ├── (app)/
│   │   │   │   ├── layout.tsx            # Sidebar shell
│   │   │   │   └── app/page.tsx          # Empty home
│   │   │   └── api/auth/[...nextauth]/route.ts
│   │   ├── components/
│   │   │   └── Sidebar.tsx
│   │   ├── lib/
│   │   │   ├── auth.ts                   # Auth.js config
│   │   │   ├── env.ts                    # Validated env (zod)
│   │   │   └── password.ts               # bcrypt helpers
│   │   ├── middleware.ts                 # Route protection
│   │   ├── tests/e2e/
│   │   │   └── happy-path.spec.ts        # Playwright
│   │   ├── next.config.ts
│   │   ├── playwright.config.ts
│   │   ├── postcss.config.mjs
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── worker/
│       ├── src/
│       │   ├── server.ts                 # Fastify bootstrap
│       │   ├── env.ts
│       │   └── routes/health.ts
│       ├── tests/
│       │   └── health.test.ts            # Vitest
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   ├── db/
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   │   ├── users.ts
│   │   │   │   ├── sessions.ts
│   │   │   │   ├── connections.ts
│   │   │   │   ├── accounts.ts
│   │   │   │   ├── transactions.ts
│   │   │   │   ├── budgets.ts
│   │   │   │   ├── goals.ts
│   │   │   │   ├── categoryRules.ts
│   │   │   │   ├── recurringSeries.ts
│   │   │   │   ├── anomalies.ts
│   │   │   │   ├── insights.ts
│   │   │   │   ├── agentActions.ts
│   │   │   │   ├── inboundEmails.ts
│   │   │   │   ├── uploadJobs.ts
│   │   │   │   └── index.ts              # Re-exports
│   │   │   ├── client.ts                 # createDb()
│   │   │   ├── enums.ts                  # pgEnums
│   │   │   └── index.ts
│   │   ├── tests/
│   │   │   ├── schema.test.ts            # Static checks
│   │   │   └── client.test.ts            # Integration
│   │   ├── drizzle.config.ts
│   │   ├── migrations/                   # Generated
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── ui/
│   │   ├── src/
│   │   │   ├── tokens.css                # CSS variables
│   │   │   ├── tailwind.preset.ts        # Tailwind preset using vars
│   │   │   ├── lib/cn.ts
│   │   │   ├── components/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Tile.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── Skeleton.tsx
│   │   │   │   ├── Toast.tsx
│   │   │   │   └── Modal.tsx
│   │   │   └── index.ts
│   │   ├── tests/
│   │   │   ├── Button.test.tsx
│   │   │   ├── Tile.test.tsx
│   │   │   ├── Input.test.tsx
│   │   │   ├── Badge.test.tsx
│   │   │   ├── Skeleton.test.tsx
│   │   │   ├── Toast.test.tsx
│   │   │   └── Modal.test.tsx
│   │   ├── vitest.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── config/
│       ├── eslint-preset.js
│       ├── tsconfig.base.json
│       └── package.json
│
└── scripts/
    └── import-sqlite.ts                  # Existing SQLite → Postgres
```

Each schema file owns one table. Each component file owns one component. The `packages/db/src/schema/index.ts` re-exports everything so callers do `import { users, transactions } from '@perfin/db'`.

---

## Task 1: Initialize Turborepo monorepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Confirm pnpm and Node versions**

Run:
```bash
node --version    # expect >= 20.11
pnpm --version    # expect >= 9.0; install via `npm i -g pnpm@9` if missing
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "perfin",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=20.11" },
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "db:migrate": "pnpm --filter @perfin/db migrate",
    "db:studio": "pnpm --filter @perfin/db studio",
    "db:generate": "pnpm --filter @perfin/db generate",
    "import:sqlite": "tsx scripts/import-sqlite.ts"
  },
  "devDependencies": {
    "turbo": "2.3.0",
    "typescript": "5.6.3",
    "tsx": "4.19.1"
  }
}
```

- [ ] **Step 3: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 4: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**", "!.next/cache/**"]
    },
    "dev": { "cache": false, "persistent": true },
    "lint": { "outputs": [] },
    "typecheck": { "dependsOn": ["^build"], "outputs": [] },
    "test": { "dependsOn": ["^build"], "outputs": [] }
  }
}
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
.next/
dist/
.turbo/
.env
.env.local
.env.*.local
*.log
.DS_Store
playwright-report/
test-results/
.superpowers/
```

- [ ] **Step 6: Create `.env.example`**

```bash
# Database
DATABASE_URL=postgres://perfin:perfin@localhost:5432/perfin

# Auth
AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32
AUTH_URL=http://localhost:3000

# OAuth (Phase 0: optional; placeholder values are fine in dev)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Worker
WORKER_PORT=8001
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod

# Anthropic (Phase 1+)
ANTHROPIC_API_KEY=
```

- [ ] **Step 7: Install root dev deps**

Run:
```bash
pnpm install
```
Expected: pnpm creates `pnpm-lock.yaml`, no errors.

- [ ] **Step 8: Verify turbo runs**

Run:
```bash
pnpm turbo --version
```
Expected: prints `2.3.0`.

- [ ] **Step 9: Commit**

```bash
git init
git add package.json pnpm-workspace.yaml turbo.json .gitignore .env.example pnpm-lock.yaml
git commit -m "chore: scaffold Turborepo monorepo with pnpm workspaces"
```

---

## Task 2: Shared config package

**Files:**
- Create: `packages/config/package.json`
- Create: `packages/config/tsconfig.base.json`
- Create: `packages/config/eslint-preset.js`

- [ ] **Step 1: Create `packages/config/package.json`**

```json
{
  "name": "@perfin/config",
  "version": "0.0.0",
  "private": true,
  "main": "./eslint-preset.js",
  "files": ["tsconfig.base.json", "eslint-preset.js"],
  "devDependencies": {
    "@eslint/js": "9.14.0",
    "eslint": "9.14.0",
    "typescript-eslint": "8.13.0"
  },
  "peerDependencies": {
    "eslint": "^9.0.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create `packages/config/tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "allowSyntheticDefaultImports": true,
    "jsx": "preserve",
    "incremental": true
  }
}
```

- [ ] **Step 3: Create `packages/config/eslint-preset.js`**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  { ignores: ['dist/**', '.next/**', 'node_modules/**', 'migrations/**'] },
];
```

- [ ] **Step 4: Install**

Run:
```bash
pnpm install
```
Expected: `@perfin/config` is recognized as a workspace.

- [ ] **Step 5: Commit**

```bash
git add packages/config pnpm-lock.yaml
git commit -m "chore(config): add shared tsconfig and eslint preset"
```

---

## Task 3: Database package skeleton + Drizzle setup

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/src/index.ts`

- [ ] **Step 1: Create `packages/db/package.json`**

```json
{
  "name": "@perfin/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema/index.ts",
    "./client": "./src/client.ts"
  },
  "scripts": {
    "generate": "drizzle-kit generate",
    "migrate": "drizzle-kit migrate",
    "studio": "drizzle-kit studio",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "drizzle-orm": "0.36.0",
    "postgres": "3.4.4"
  },
  "devDependencies": {
    "@perfin/config": "workspace:*",
    "@types/node": "22.9.0",
    "drizzle-kit": "0.28.0",
    "typescript": "5.6.3",
    "vitest": "2.1.4"
  }
}
```

- [ ] **Step 2: Create `packages/db/tsconfig.json`**

```json
{
  "extends": "@perfin/config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "noEmit": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*", "tests/**/*", "drizzle.config.ts"]
}
```

- [ ] **Step 3: Create `packages/db/drizzle.config.ts`**

```ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://perfin:perfin@localhost:5432/perfin',
  },
  strict: true,
  verbose: true,
} satisfies Config;
```

- [ ] **Step 4: Create `packages/db/src/index.ts`**

```ts
export * from './schema/index.js';
export { createDb, type Db } from './client.js';
```

- [ ] **Step 5: Install**

Run:
```bash
pnpm install
```
Expected: `drizzle-orm`, `drizzle-kit`, `postgres`, `vitest` installed.

- [ ] **Step 6: Commit**

```bash
git add packages/db pnpm-lock.yaml
git commit -m "chore(db): scaffold @perfin/db package with Drizzle"
```

---

## Task 4: Local Postgres via docker-compose

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: perfin
      POSTGRES_PASSWORD: perfin
      POSTGRES_DB: perfin
    ports:
      - '5432:5432'
    volumes:
      - perfin_pg:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U perfin']
      interval: 2s
      timeout: 2s
      retries: 30

volumes:
  perfin_pg:
```

- [ ] **Step 2: Bring it up**

Run:
```bash
docker compose up -d
docker compose ps
```
Expected: `postgres` shows `(healthy)` within ~10s.

- [ ] **Step 3: Verify connectivity**

Run:
```bash
docker exec -it $(docker compose ps -q postgres) psql -U perfin -d perfin -c '\dt'
```
Expected: `Did not find any relations.` (database exists, no tables yet).

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: add docker-compose for local Postgres 16"
```

---

## Task 5: Schema — enums + users + sessions

**Files:**
- Create: `packages/db/src/enums.ts`
- Create: `packages/db/src/schema/users.ts`
- Create: `packages/db/src/schema/sessions.ts`
- Create: `packages/db/src/schema/index.ts`
- Create: `packages/db/tests/schema.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/db/tests/schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { users, sessions, planEnum } from '../src/schema/index.js';

describe('users schema', () => {
  it('has the expected columns', () => {
    expect(users.id).toBeDefined();
    expect(users.email).toBeDefined();
    expect(users.passwordHash).toBeDefined();
    expect(users.plan).toBeDefined();
    expect(users.createdAt).toBeDefined();
  });

  it('plan enum has free/plus/pro', () => {
    expect(planEnum.enumValues).toEqual(['free', 'plus', 'pro']);
  });
});

describe('sessions schema', () => {
  it('has the expected columns', () => {
    expect(sessions.id).toBeDefined();
    expect(sessions.userId).toBeDefined();
    expect(sessions.tokenHash).toBeDefined();
    expect(sessions.expiresAt).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm --filter @perfin/db test
```
Expected: fails with `Cannot find module '../src/schema/index.js'`.

- [ ] **Step 3: Create `packages/db/src/enums.ts`**

```ts
import { pgEnum } from 'drizzle-orm/pg-core';

export const planEnum = pgEnum('plan', ['free', 'plus', 'pro']);

export const connectionStatusEnum = pgEnum('connection_status', [
  'active', 'error', 'disconnected',
]);

export const anomalyStatusEnum = pgEnum('anomaly_status', [
  'open', 'confirmed', 'dismissed',
]);

export const insightSurfaceEnum = pgEnum('insight_surface', ['home', 'insights']);

export const uploadStatusEnum = pgEnum('upload_status', [
  'queued', 'extracting', 'categorizing', 'done', 'failed',
]);

export const recurringStatusEnum = pgEnum('recurring_status', [
  'active', 'cancelled', 'paused',
]);

export const goalStatusEnum = pgEnum('goal_status', [
  'active', 'reached', 'archived',
]);

export const inboundEmailStatusEnum = pgEnum('inbound_email_status', [
  'received', 'parsed', 'failed',
]);
```

- [ ] **Step 4: Create `packages/db/src/schema/users.ts`**

```ts
import { pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { planEnum } from '../enums.js';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    plan: planEnum('plan').notNull().default('free'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailUnique: uniqueIndex('users_email_unique').on(t.email),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

- [ ] **Step 5: Create `packages/db/src/schema/sessions.ts`**

```ts
import { pgTable, serial, integer, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const sessions = pgTable(
  'sessions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('sessions_user_idx').on(t.userId),
    tokenIdx: index('sessions_token_idx').on(t.tokenHash),
  }),
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
```

- [ ] **Step 6: Create `packages/db/src/schema/index.ts`**

```ts
export * from '../enums.js';
export * from './users.js';
export * from './sessions.js';
```

- [ ] **Step 7: Run test to verify it passes**

Run:
```bash
pnpm --filter @perfin/db test
```
Expected: 2 tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/db
git commit -m "feat(db): add users + sessions schema with plan enum"
```

---

## Task 6: Schema — connections + accounts

**Files:**
- Create: `packages/db/src/schema/connections.ts`
- Create: `packages/db/src/schema/accounts.ts`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/tests/schema.test.ts`

- [ ] **Step 1: Add failing test**

Append to `packages/db/tests/schema.test.ts`:

```ts
import { connections, accounts, connectionStatusEnum } from '../src/schema/index.js';

describe('connections schema', () => {
  it('has expected columns', () => {
    expect(connections.id).toBeDefined();
    expect(connections.userId).toBeDefined();
    expect(connections.provider).toBeDefined();
    expect(connections.accessTokenEnc).toBeDefined();
    expect(connections.cursor).toBeDefined();
    expect(connections.status).toBeDefined();
  });
});

describe('accounts schema', () => {
  it('has expected columns', () => {
    expect(accounts.id).toBeDefined();
    expect(accounts.userId).toBeDefined();
    expect(accounts.connectionId).toBeDefined();
    expect(accounts.balanceCents).toBeDefined();
    expect(accounts.currency).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm --filter @perfin/db test
```
Expected: fails — `connections` and `accounts` do not exist.

- [ ] **Step 3: Create `packages/db/src/schema/connections.ts`**

```ts
import { pgTable, serial, integer, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { connectionStatusEnum } from '../enums.js';

export const connections = pgTable(
  'connections',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),                   // 'plaid' | 'csv' | 'pdf' | 'email'
    providerAccountId: text('provider_account_id'),         // plaid item_id
    accessTokenEnc: text('access_token_enc'),               // AES-GCM ciphertext, null for non-plaid
    cursor: text('cursor'),                                 // plaid sync cursor
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    status: connectionStatusEnum('status').notNull().default('active'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('connections_user_idx').on(t.userId),
  }),
);

export type Connection = typeof connections.$inferSelect;
export type NewConnection = typeof connections.$inferInsert;
```

- [ ] **Step 4: Create `packages/db/src/schema/accounts.ts`**

```ts
import {
  pgTable, serial, integer, text, bigint, timestamp, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { connections } from './connections.js';

export const accounts = pgTable(
  'accounts',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    connectionId: integer('connection_id').references(() => connections.id, { onDelete: 'set null' }),
    plaidAccountId: text('plaid_account_id'),
    name: text('name').notNull(),
    bank: text('bank').notNull().default(''),
    type: text('type').notNull().default('checking'),       // checking | savings | credit | cash | investment
    currency: text('currency').notNull().default('INR'),
    color: text('color').notNull().default('#6366f1'),
    balanceCents: bigint('balance_cents', { mode: 'number' }).notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('accounts_user_idx').on(t.userId),
    nameUnique: uniqueIndex('accounts_user_name_unique').on(t.userId, t.name),
  }),
);

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
```

- [ ] **Step 5: Update `packages/db/src/schema/index.ts`**

```ts
export * from '../enums.js';
export * from './users.js';
export * from './sessions.js';
export * from './connections.js';
export * from './accounts.js';
```

- [ ] **Step 6: Run test to verify it passes**

Run:
```bash
pnpm --filter @perfin/db test
```
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/db
git commit -m "feat(db): add connections + accounts schema"
```

---

## Task 7: Schema — transactions + budgets + goals

**Files:**
- Create: `packages/db/src/schema/transactions.ts`
- Create: `packages/db/src/schema/budgets.ts`
- Create: `packages/db/src/schema/goals.ts`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/tests/schema.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `packages/db/tests/schema.test.ts`:

```ts
import { transactions, budgets, goals, goalStatusEnum } from '../src/schema/index.js';

describe('transactions schema', () => {
  it('has expected columns including parent for splits', () => {
    expect(transactions.id).toBeDefined();
    expect(transactions.amountCents).toBeDefined();
    expect(transactions.parentTransactionId).toBeDefined();
    expect(transactions.tags).toBeDefined();
    expect(transactions.pending).toBeDefined();
  });
});

describe('budgets schema', () => {
  it('has period column', () => {
    expect(budgets.period).toBeDefined();
    expect(budgets.amountCents).toBeDefined();
  });
});

describe('goals schema', () => {
  it('has target/saved cents and status', () => {
    expect(goals.targetCents).toBeDefined();
    expect(goals.savedCents).toBeDefined();
    expect(goalStatusEnum.enumValues).toEqual(['active', 'reached', 'archived']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm --filter @perfin/db test
```
Expected: fails — symbols don't exist.

- [ ] **Step 3: Create `packages/db/src/schema/transactions.ts`**

```ts
import {
  pgTable, serial, integer, text, bigint, boolean, date, timestamp, index, uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { accounts } from './accounts.js';

export const transactions = pgTable(
  'transactions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    accountId: integer('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    date: date('date').notNull(),                             // ISO 8601 yyyy-mm-dd
    description: text('description').notNull(),               // cleaned/normalized
    rawDescription: text('raw_description').notNull(),        // exactly as ingested
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    category: text('category').notNull().default('Needs Review'),
    subcategory: text('subcategory'),
    tags: text('tags').array().notNull().default([]),
    sourceFile: text('source_file'),
    sourceEmailId: integer('source_email_id'),                // FK added in Task 9 to avoid cycle
    plaidTxnId: text('plaid_txn_id'),
    parentTransactionId: integer('parent_transaction_id').references((): AnyPgColumn => transactions.id, { onDelete: 'cascade' }),
    pending: boolean('pending').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
  },
  (t) => ({
    userDateIdx: index('transactions_user_date_idx').on(t.userId, t.date),
    userCategoryIdx: index('transactions_user_category_idx').on(t.userId, t.category),
    userAccountIdx: index('transactions_user_account_idx').on(t.userId, t.accountId),
    descIdx: index('transactions_desc_idx').on(t.description),
    plaidIdUnique: uniqueIndex('transactions_plaid_unique').on(t.plaidTxnId),
    dedupeUnique: uniqueIndex('transactions_dedupe_unique').on(
      t.userId, t.date, t.description, t.amountCents, t.sourceFile,
    ),
  }),
);

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
```

- [ ] **Step 4: Create `packages/db/src/schema/budgets.ts`**

```ts
import {
  pgTable, serial, integer, text, bigint, timestamp, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { accounts } from './accounts.js';

export const budgets = pgTable(
  'budgets',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    period: text('period').notNull().default('monthly'),      // monthly | quarterly | annual
    accountId: integer('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex('budgets_user_cat_period_account_unique').on(
      t.userId, t.category, t.period, t.accountId,
    ),
  }),
);

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
```

- [ ] **Step 5: Create `packages/db/src/schema/goals.ts`**

```ts
import {
  pgTable, serial, integer, text, bigint, date, timestamp, index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { accounts } from './accounts.js';
import { goalStatusEnum } from '../enums.js';

export const goals = pgTable(
  'goals',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    targetCents: bigint('target_cents', { mode: 'number' }).notNull(),
    savedCents: bigint('saved_cents', { mode: 'number' }).notNull().default(0),
    deadline: date('deadline'),
    sourceAccountId: integer('source_account_id').references(() => accounts.id, { onDelete: 'set null' }),
    status: goalStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('goals_user_idx').on(t.userId),
  }),
);

export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
```

- [ ] **Step 6: Update `packages/db/src/schema/index.ts`**

```ts
export * from '../enums.js';
export * from './users.js';
export * from './sessions.js';
export * from './connections.js';
export * from './accounts.js';
export * from './transactions.js';
export * from './budgets.js';
export * from './goals.js';
```

- [ ] **Step 7: Run test to verify it passes**

Run:
```bash
pnpm --filter @perfin/db test
```
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/db
git commit -m "feat(db): add transactions, budgets, goals schema"
```

---

## Task 8: Schema — category_rules + recurring_series + anomalies

**Files:**
- Create: `packages/db/src/schema/categoryRules.ts`
- Create: `packages/db/src/schema/recurringSeries.ts`
- Create: `packages/db/src/schema/anomalies.ts`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/tests/schema.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `packages/db/tests/schema.test.ts`:

```ts
import {
  categoryRules, recurringSeries, anomalies,
  recurringStatusEnum, anomalyStatusEnum,
} from '../src/schema/index.js';

describe('categoryRules schema', () => {
  it('has priority and pattern', () => {
    expect(categoryRules.priority).toBeDefined();
    expect(categoryRules.pattern).toBeDefined();
    expect(categoryRules.matchType).toBeDefined();
  });
});

describe('recurringSeries schema', () => {
  it('has cadence + confidence + status', () => {
    expect(recurringSeries.cadence).toBeDefined();
    expect(recurringSeries.confidence).toBeDefined();
    expect(recurringStatusEnum.enumValues).toEqual(['active', 'cancelled', 'paused']);
  });
});

describe('anomalies schema', () => {
  it('has score, kind, status', () => {
    expect(anomalies.score).toBeDefined();
    expect(anomalies.kind).toBeDefined();
    expect(anomalyStatusEnum.enumValues).toEqual(['open', 'confirmed', 'dismissed']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm --filter @perfin/db test
```
Expected: fails — schemas don't exist.

- [ ] **Step 3: Create `packages/db/src/schema/categoryRules.ts`**

```ts
import {
  pgTable, serial, integer, text, timestamp, index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const categoryRules = pgTable(
  'category_rules',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    priority: integer('priority').notNull().default(5),       // 1-10, higher checked first
    matchType: text('match_type').notNull(),                  // 'contains' | 'exact' | 'regex'
    pattern: text('pattern').notNull(),
    category: text('category').notNull(),
    createdBy: text('created_by').notNull().default('user'),  // 'user' | 'seed' | 'agent'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userPriorityIdx: index('category_rules_user_priority_idx').on(t.userId, t.priority),
  }),
);

export type CategoryRule = typeof categoryRules.$inferSelect;
export type NewCategoryRule = typeof categoryRules.$inferInsert;
```

- [ ] **Step 4: Create `packages/db/src/schema/recurringSeries.ts`**

```ts
import {
  pgTable, serial, integer, text, bigint, real, date, timestamp, index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { recurringStatusEnum } from '../enums.js';

export const recurringSeries = pgTable(
  'recurring_series',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    merchant: text('merchant').notNull(),
    category: text('category').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    cadence: text('cadence').notNull(),                       // 'weekly' | 'monthly' | 'quarterly' | 'annual'
    nextExpectedAt: date('next_expected_at'),
    confidence: real('confidence').notNull(),                 // 0..1
    firstSeen: date('first_seen').notNull(),
    lastSeen: date('last_seen').notNull(),
    status: recurringStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('recurring_series_user_idx').on(t.userId),
  }),
);

export type RecurringSeries = typeof recurringSeries.$inferSelect;
export type NewRecurringSeries = typeof recurringSeries.$inferInsert;
```

- [ ] **Step 5: Create `packages/db/src/schema/anomalies.ts`**

```ts
import {
  pgTable, serial, integer, text, real, timestamp, index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { transactions } from './transactions.js';
import { anomalyStatusEnum } from '../enums.js';

export const anomalies = pgTable(
  'anomalies',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    transactionId: integer('transaction_id').notNull().references(() => transactions.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),                             // 'large_amount' | 'unusual_merchant' | 'duplicate_suspect' | 'category_outlier'
    score: real('score').notNull(),                           // 0..1
    reason: text('reason').notNull(),
    status: anomalyStatusEnum('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userStatusIdx: index('anomalies_user_status_idx').on(t.userId, t.status),
  }),
);

export type Anomaly = typeof anomalies.$inferSelect;
export type NewAnomaly = typeof anomalies.$inferInsert;
```

- [ ] **Step 6: Update `packages/db/src/schema/index.ts`**

```ts
export * from '../enums.js';
export * from './users.js';
export * from './sessions.js';
export * from './connections.js';
export * from './accounts.js';
export * from './transactions.js';
export * from './budgets.js';
export * from './goals.js';
export * from './categoryRules.js';
export * from './recurringSeries.js';
export * from './anomalies.js';
```

- [ ] **Step 7: Run test**

Run:
```bash
pnpm --filter @perfin/db test
```
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/db
git commit -m "feat(db): add category_rules, recurring_series, anomalies schema"
```

---

## Task 9: Schema — insights + agent_actions + inbound_emails + upload_jobs

**Files:**
- Create: `packages/db/src/schema/insights.ts`
- Create: `packages/db/src/schema/agentActions.ts`
- Create: `packages/db/src/schema/inboundEmails.ts`
- Create: `packages/db/src/schema/uploadJobs.ts`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/tests/schema.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `packages/db/tests/schema.test.ts`:

```ts
import {
  insights, agentActions, inboundEmails, uploadJobs,
  insightSurfaceEnum, uploadStatusEnum, inboundEmailStatusEnum,
} from '../src/schema/index.js';

describe('insights schema', () => {
  it('has surface enum and confidence', () => {
    expect(insights.surface).toBeDefined();
    expect(insights.confidence).toBeDefined();
    expect(insightSurfaceEnum.enumValues).toEqual(['home', 'insights']);
  });
});

describe('agentActions schema', () => {
  it('has tool, input/output JSONB, audit fields', () => {
    expect(agentActions.tool).toBeDefined();
    expect(agentActions.input).toBeDefined();
    expect(agentActions.output).toBeDefined();
    expect(agentActions.confirmedAt).toBeDefined();
    expect(agentActions.undoneAt).toBeDefined();
  });
});

describe('uploadJobs schema', () => {
  it('has status enum', () => {
    expect(uploadStatusEnum.enumValues)
      .toEqual(['queued', 'extracting', 'categorizing', 'done', 'failed']);
  });
});

describe('inboundEmails schema', () => {
  it('has status enum', () => {
    expect(inboundEmailStatusEnum.enumValues)
      .toEqual(['received', 'parsed', 'failed']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm --filter @perfin/db test
```
Expected: fails.

- [ ] **Step 3: Create `packages/db/src/schema/insights.ts`**

```ts
import {
  pgTable, serial, integer, text, real, jsonb, boolean, timestamp, index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { insightSurfaceEnum } from '../enums.js';

export const insights = pgTable(
  'insights',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),                             // 'anomaly' | 'recurring' | 'sub_rising' | 'category_drift' | 'forecast' | 'savings' | 'narrative'
    headline: text('headline').notNull(),
    body: text('body').notNull(),
    payload: jsonb('payload').notNull().default({}),          // typed per kind
    confidence: real('confidence').notNull(),                 // 0..1
    surface: insightSurfaceEnum('surface').notNull().default('insights'),
    actionTaken: boolean('action_taken').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => ({
    userKindIdx: index('insights_user_kind_idx').on(t.userId, t.kind),
    surfaceIdx: index('insights_surface_idx').on(t.userId, t.surface),
  }),
);

export type Insight = typeof insights.$inferSelect;
export type NewInsight = typeof insights.$inferInsert;
```

- [ ] **Step 4: Create `packages/db/src/schema/agentActions.ts`**

```ts
import {
  pgTable, serial, integer, text, jsonb, timestamp, index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const agentActions = pgTable(
  'agent_actions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tool: text('tool').notNull(),                             // e.g. 'transaction.update'
    input: jsonb('input').notNull(),
    output: jsonb('output'),
    confirmedBy: integer('confirmed_by').references(() => users.id),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    undoneAt: timestamp('undone_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('agent_actions_user_idx').on(t.userId),
  }),
);

export type AgentAction = typeof agentActions.$inferSelect;
export type NewAgentAction = typeof agentActions.$inferInsert;
```

- [ ] **Step 5: Create `packages/db/src/schema/inboundEmails.ts`**

```ts
import {
  pgTable, serial, integer, text, timestamp, index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { transactions } from './transactions.js';
import { inboundEmailStatusEnum } from '../enums.js';

export const inboundEmails = pgTable(
  'inbound_emails',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    from: text('from').notNull(),
    subject: text('subject').notNull().default(''),
    bodyHash: text('body_hash').notNull(),
    parsedTxnId: integer('parsed_txn_id').references(() => transactions.id, { onDelete: 'set null' }),
    status: inboundEmailStatusEnum('status').notNull().default('received'),
    error: text('error'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('inbound_emails_user_idx').on(t.userId),
  }),
);

export type InboundEmail = typeof inboundEmails.$inferSelect;
export type NewInboundEmail = typeof inboundEmails.$inferInsert;
```

- [ ] **Step 6: Create `packages/db/src/schema/uploadJobs.ts`**

```ts
import {
  pgTable, serial, integer, text, bigint, timestamp, index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { uploadStatusEnum } from '../enums.js';

export const uploadJobs = pgTable(
  'upload_jobs',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    mime: text('mime').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    status: uploadStatusEnum('status').notNull().default('queued'),
    extractedCount: integer('extracted_count').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userStatusIdx: index('upload_jobs_user_status_idx').on(t.userId, t.status),
  }),
);

export type UploadJob = typeof uploadJobs.$inferSelect;
export type NewUploadJob = typeof uploadJobs.$inferInsert;
```

- [ ] **Step 7: Update `packages/db/src/schema/index.ts`**

```ts
export * from '../enums.js';
export * from './users.js';
export * from './sessions.js';
export * from './connections.js';
export * from './accounts.js';
export * from './transactions.js';
export * from './budgets.js';
export * from './goals.js';
export * from './categoryRules.js';
export * from './recurringSeries.js';
export * from './anomalies.js';
export * from './insights.js';
export * from './agentActions.js';
export * from './inboundEmails.js';
export * from './uploadJobs.js';
```

- [ ] **Step 8: Run test**

Run:
```bash
pnpm --filter @perfin/db test
```
Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add packages/db
git commit -m "feat(db): add insights, agent_actions, inbound_emails, upload_jobs schema"
```

---

## Task 10: Generate + apply first migration

**Files:**
- Create: `packages/db/migrations/0000_*.sql` (generated)

- [ ] **Step 1: Generate migration**

Run from repo root:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5432/perfin \
  pnpm db:generate
```
Expected: `packages/db/migrations/0000_<random_name>.sql` and a `meta/` folder are created.

- [ ] **Step 2: Inspect the generated SQL**

Run:
```bash
ls packages/db/migrations/
cat packages/db/migrations/0000_*.sql | head -80
```
Expected: SQL contains `CREATE TYPE "public"."plan"`, `CREATE TABLE "users"`, `CREATE TABLE "transactions"`, etc. for all 15 tables and 8 enums.

- [ ] **Step 3: Apply the migration**

Run:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5432/perfin \
  pnpm db:migrate
```
Expected: `[migrate] applying 1 migration` and exit 0.

- [ ] **Step 4: Verify tables in Postgres**

Run:
```bash
docker exec -i $(docker compose ps -q postgres) psql -U perfin -d perfin -c '\dt'
```
Expected: 15 tables listed (users, sessions, connections, accounts, transactions, budgets, goals, category_rules, recurring_series, anomalies, insights, agent_actions, inbound_emails, upload_jobs, plus drizzle's `__drizzle_migrations`).

- [ ] **Step 5: Commit**

```bash
git add packages/db/migrations
git commit -m "feat(db): generate initial migration with 14 application tables"
```

---

## Task 11: DB client + integration smoke test

**Files:**
- Create: `packages/db/src/client.ts`
- Create: `packages/db/tests/client.test.ts`

- [ ] **Step 1: Write failing integration test**

Create `packages/db/tests/client.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb, type Db } from '../src/client.js';
import { users } from '../src/schema/index.js';

const url = process.env.DATABASE_URL ?? 'postgres://perfin:perfin@localhost:5432/perfin';
let db: Db;
let closeDb: () => Promise<void>;

beforeAll(async () => {
  const created = createDb(url);
  db = created.db;
  closeDb = created.close;
});

afterAll(async () => {
  await db.delete(users).where(eq(users.email, 'smoke@perfin.dev'));
  await closeDb();
});

describe('db client', () => {
  it('inserts and selects a user', async () => {
    const [inserted] = await db
      .insert(users)
      .values({ email: 'smoke@perfin.dev', passwordHash: 'x' })
      .returning();
    expect(inserted?.id).toBeGreaterThan(0);
    expect(inserted?.plan).toBe('free');

    const [found] = await db.select().from(users).where(eq(users.email, 'smoke@perfin.dev'));
    expect(found?.id).toBe(inserted?.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm --filter @perfin/db test
```
Expected: fails — `createDb` does not exist.

- [ ] **Step 3: Create `packages/db/src/client.ts`**

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export function createDb(url: string): { db: Db; close: () => Promise<void> } {
  const client = postgres(url, { max: 10, prepare: false });
  const db = drizzle(client, { schema });
  return {
    db,
    close: async () => { await client.end(); },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5432/perfin \
  pnpm --filter @perfin/db test
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/db
git commit -m "feat(db): add createDb client and integration smoke test"
```

---

## Task 12: SQLite → Postgres import script

**Files:**
- Create: `scripts/import-sqlite.ts`
- Create: `scripts/package.json` (small workspace just for this script's deps)
- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: Add `scripts` to workspaces**

Edit `pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'scripts'
```

- [ ] **Step 2: Create `scripts/package.json`**

```json
{
  "name": "@perfin/scripts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "import-sqlite": "tsx import-sqlite.ts"
  },
  "dependencies": {
    "@perfin/db": "workspace:*",
    "better-sqlite3": "11.3.0",
    "tsx": "4.19.1"
  },
  "devDependencies": {
    "@types/better-sqlite3": "7.6.11",
    "typescript": "5.6.3"
  }
}
```

- [ ] **Step 3: Create `scripts/import-sqlite.ts`**

```ts
/**
 * One-shot import: existing SQLite ledger → new Postgres schema.
 *
 * Usage:
 *   DATABASE_URL=postgres://... \
 *   SQLITE_PATH=/Users/.../ai_accountant/database/ledger.db \
 *   USER_EMAIL=you@example.com \
 *   pnpm --filter @perfin/scripts import-sqlite
 */
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { createDb, users, accounts, transactions, budgets } from '@perfin/db';

const dbUrl = required('DATABASE_URL');
const sqlitePath = required('SQLITE_PATH');
const userEmail = required('USER_EMAIL');

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

interface SqliteAccount {
  name: string; bank: string; account_type: string;
  currency: string; color: string; created_at: string;
}
interface SqliteTxn {
  date: string; description: string; amount_cents: number;
  category: string; account: string; source_file: string | null;
  created_at: string; updated_at: string | null;
}
interface SqliteBudget {
  category: string; amount_cents: number; period: string;
  account: string; created_at: string; updated_at: string;
}

async function main() {
  const sqlite = new Database(sqlitePath, { readonly: true });
  const { db, close } = createDb(dbUrl);

  // 1. User
  const [user] = await db
    .insert(users)
    .values({ email: userEmail, passwordHash: 'imported-set-password-via-reset' })
    .onConflictDoUpdate({ target: users.email, set: { email: userEmail } })
    .returning();
  if (!user) throw new Error('User upsert failed');
  console.log(`User: id=${user.id} email=${user.email}`);

  // 2. Accounts
  const sqliteAccounts = sqlite.prepare(
    `SELECT name, bank, account_type, currency, color, created_at FROM accounts`,
  ).all() as SqliteAccount[];

  const accountIdByName = new Map<string, number>();
  for (const a of sqliteAccounts) {
    const [row] = await db
      .insert(accounts)
      .values({
        userId: user.id,
        name: a.name,
        bank: a.bank ?? '',
        type: a.account_type ?? 'checking',
        currency: a.currency ?? 'INR',
        color: a.color ?? '#6366f1',
      })
      .onConflictDoNothing()
      .returning();
    if (row) accountIdByName.set(a.name, row.id);
    else {
      const [existing] = await db.select().from(accounts).where(eq(accounts.name, a.name));
      if (existing) accountIdByName.set(a.name, existing.id);
    }
  }
  console.log(`Accounts imported: ${accountIdByName.size}`);

  // 3. Transactions
  const sqliteTxns = sqlite.prepare(
    `SELECT date, description, amount_cents, category, account, source_file,
            created_at, updated_at
     FROM transactions
     ORDER BY date`,
  ).all() as SqliteTxn[];

  const BATCH = 500;
  let imported = 0;
  for (let i = 0; i < sqliteTxns.length; i += BATCH) {
    const slice = sqliteTxns.slice(i, i + BATCH);
    const values = slice.map((t) => ({
      userId: user.id,
      accountId: accountIdByName.get(t.account) ?? null,
      date: t.date,
      description: t.description,
      rawDescription: t.description,
      amountCents: t.amount_cents,
      category: t.category ?? 'Needs Review',
      sourceFile: t.source_file,
    }));
    const inserted = await db.insert(transactions).values(values).onConflictDoNothing().returning({ id: transactions.id });
    imported += inserted.length;
  }
  console.log(`Transactions imported: ${imported} / ${sqliteTxns.length}`);

  // 4. Budgets
  const sqliteBudgets = sqlite.prepare(
    `SELECT category, amount_cents, period, account FROM budgets`,
  ).all() as SqliteBudget[];

  for (const b of sqliteBudgets) {
    await db.insert(budgets).values({
      userId: user.id,
      category: b.category,
      amountCents: b.amount_cents,
      period: b.period ?? 'monthly',
      accountId: accountIdByName.get(b.account) ?? null,
    }).onConflictDoNothing();
  }
  console.log(`Budgets imported: ${sqliteBudgets.length}`);

  sqlite.close();
  await close();
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 4: Install**

Run:
```bash
pnpm install
```

- [ ] **Step 5: Smoke-test the script (only if SQLite ledger exists)**

Check whether the existing SQLite DB exists:
```bash
ls /Users/nagashankar/pythonScripts/perfin/ai_accountant/database/ledger.db 2>&1
```

If it exists, run:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5432/perfin \
SQLITE_PATH=/Users/nagashankar/pythonScripts/perfin/ai_accountant/database/ledger.db \
USER_EMAIL=local@perfin.dev \
pnpm --filter @perfin/scripts import-sqlite
```
Expected: prints `User: id=1`, account count, transaction count, budget count.

If the ledger doesn't exist, skip the smoke test (the script will be exercised when there's data to import).

- [ ] **Step 6: Commit**

```bash
git add pnpm-workspace.yaml scripts pnpm-lock.yaml
git commit -m "feat(scripts): add SQLite to Postgres import script"
```

---

## Task 13: UI package — design tokens + Tailwind preset

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/vitest.config.ts`
- Create: `packages/ui/src/tokens.css`
- Create: `packages/ui/src/tailwind.preset.ts`
- Create: `packages/ui/src/index.ts`

- [ ] **Step 1: Create `packages/ui/package.json`**

```json
{
  "name": "@perfin/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./tokens.css": "./src/tokens.css",
    "./tailwind.preset": "./src/tailwind.preset.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "eslint src tests"
  },
  "dependencies": {
    "@radix-ui/react-dialog": "1.1.2",
    "clsx": "2.1.1",
    "tailwind-merge": "2.5.4"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@perfin/config": "workspace:*",
    "@testing-library/jest-dom": "6.6.3",
    "@testing-library/react": "16.0.1",
    "@types/react": "19.0.0",
    "@types/react-dom": "19.0.0",
    "happy-dom": "15.11.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "tailwindcss": "4.0.0-beta.4",
    "typescript": "5.6.3",
    "vitest": "2.1.4"
  }
}
```

- [ ] **Step 2: Create `packages/ui/tsconfig.json`**

```json
{
  "extends": "@perfin/config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["node", "vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Create `packages/ui/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
});
```

- [ ] **Step 4: Create `packages/ui/tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Create `packages/ui/src/tokens.css`**

```css
:root {
  --bg: #08080B;
  --surface: #101015;
  --surface-2: #16161D;
  --surface-3: #1C1C25;
  --surface-hover: #20202A;
  --border: #26262F;
  --border-strong: #34343F;

  --text: #F4F4F5;
  --text-muted: #A1A1AA;
  --text-subtle: #71717A;
  --text-inverse: #0A0A0A;

  --accent: #6366F1;
  --accent-soft: rgba(99,102,241,.14);
  --accent-hover: #7C7EF1;

  --positive: #34D399;
  --positive-soft: rgba(52,211,153,.14);
  --negative: #FB7185;
  --negative-soft: rgba(251,113,133,.14);
  --warning: #FBBF24;
  --warning-soft: rgba(251,191,36,.14);
  --info: #60A5FA;
  --info-soft: rgba(96,165,250,.14);

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --radius-full: 999px;

  --shadow-1: 0 1px 2px rgba(0,0,0,.6), 0 1px 1px rgba(0,0,0,.3);
  --shadow-2: 0 8px 24px rgba(0,0,0,.5), 0 2px 4px rgba(0,0,0,.3);
  --ring: 0 0 0 3px rgba(99,102,241,.3);

  --font-sans: 'Inter Variable', 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
}

html, body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  font-feature-settings: "ss01", "cv11", "tnum";
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.tabular { font-variant-numeric: tabular-nums; }
```

- [ ] **Step 6: Create `packages/ui/src/tailwind.preset.ts`**

```ts
import type { Config } from 'tailwindcss';

const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: { DEFAULT: 'var(--surface)', '2': 'var(--surface-2)', '3': 'var(--surface-3)' },
        border: { DEFAULT: 'var(--border)', strong: 'var(--border-strong)' },
        text: { DEFAULT: 'var(--text)', muted: 'var(--text-muted)', subtle: 'var(--text-subtle)' },
        accent: { DEFAULT: 'var(--accent)', soft: 'var(--accent-soft)', hover: 'var(--accent-hover)' },
        positive: { DEFAULT: 'var(--positive)', soft: 'var(--positive-soft)' },
        negative: { DEFAULT: 'var(--negative)', soft: 'var(--negative-soft)' },
        warning: { DEFAULT: 'var(--warning)', soft: 'var(--warning-soft)' },
        info: { DEFAULT: 'var(--info)', soft: 'var(--info-soft)' },
      },
      borderRadius: {
        sm: 'var(--radius-sm)', md: 'var(--radius-md)',
        lg: 'var(--radius-lg)', xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        1: 'var(--shadow-1)', 2: 'var(--shadow-2)', ring: 'var(--ring)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
};

export default preset;
```

- [ ] **Step 7: Create `packages/ui/src/lib/cn.ts`**

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 8: Create `packages/ui/src/index.ts` (placeholder)**

```ts
export { cn } from './lib/cn.js';
```

- [ ] **Step 9: Install + typecheck**

Run:
```bash
pnpm install
pnpm --filter @perfin/ui typecheck
```
Expected: clean.

- [ ] **Step 10: Commit**

```bash
git add packages/ui pnpm-lock.yaml
git commit -m "feat(ui): scaffold @perfin/ui with tokens + tailwind preset + cn"
```

---

## Task 14: UI — Button component

**Files:**
- Create: `packages/ui/src/components/Button.tsx`
- Create: `packages/ui/tests/Button.test.tsx`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: Write failing test**

Create `packages/ui/tests/Button.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '../src/components/Button.js';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('applies primary variant by default', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-accent');
  });

  it('applies secondary variant when set', () => {
    render(<Button variant="secondary">Go</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-surface-2');
  });

  it('applies size classes', () => {
    render(<Button size="lg">Go</Button>);
    expect(screen.getByRole('button')).toHaveClass('h-12');
  });

  it('forwards extra className', () => {
    render(<Button className="custom-x">Go</Button>);
    expect(screen.getByRole('button')).toHaveClass('custom-x');
  });

  it('respects disabled state', () => {
    render(<Button disabled>Go</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm --filter @perfin/ui test
```
Expected: fails — component does not exist.

- [ ] **Step 3: Create `packages/ui/src/components/Button.tsx`**

```tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClass: Record<ButtonVariant, string> = {
  primary:   'bg-accent text-white hover:bg-accent-hover',
  secondary: 'bg-surface-2 border border-border-strong text-text hover:bg-[var(--surface-hover)]',
  ghost:     'text-text-muted hover:bg-surface-2 hover:text-text',
  danger:    'bg-negative text-text-inverse hover:opacity-90',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm rounded-md',
  md: 'h-10 px-4 text-sm rounded-md',
  lg: 'h-12 px-5 text-base rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium',
        'transition-colors duration-[120ms]',
        'focus-visible:outline-none focus-visible:shadow-ring',
        'disabled:opacity-50 disabled:pointer-events-none',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    />
  ),
);
Button.displayName = 'Button';
```

- [ ] **Step 4: Update `packages/ui/src/index.ts`**

```ts
export { cn } from './lib/cn.js';
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './components/Button.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run:
```bash
pnpm --filter @perfin/ui test
```
Expected: 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/ui
git commit -m "feat(ui): add Button component with variants and sizes"
```

---

## Task 15: UI — Tile component

**Files:**
- Create: `packages/ui/src/components/Tile.tsx`
- Create: `packages/ui/tests/Tile.test.tsx`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: Write failing test**

Create `packages/ui/tests/Tile.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tile } from '../src/components/Tile.js';

describe('Tile', () => {
  it('renders children', () => {
    render(<Tile>hello</Tile>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('uses surface bg by default', () => {
    render(<Tile data-testid="t">x</Tile>);
    expect(screen.getByTestId('t')).toHaveClass('bg-surface');
  });

  it('hero variant uses larger padding', () => {
    render(<Tile data-testid="t" variant="hero">x</Tile>);
    expect(screen.getByTestId('t')).toHaveClass('p-6');
  });

  it('raised variant has surface-2 bg and shadow', () => {
    render(<Tile data-testid="t" variant="raised">x</Tile>);
    expect(screen.getByTestId('t')).toHaveClass('bg-surface-2');
    expect(screen.getByTestId('t')).toHaveClass('shadow-1');
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/ui test -- Tile
```
Expected: fails.

- [ ] **Step 3: Create `packages/ui/src/components/Tile.tsx`**

```tsx
import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export type TileVariant = 'default' | 'raised' | 'hero';

export interface TileProps extends HTMLAttributes<HTMLDivElement> {
  variant?: TileVariant;
}

const variantClass: Record<TileVariant, string> = {
  default: 'bg-surface border border-border p-4',
  raised:  'bg-surface-2 border border-border-strong shadow-1 p-4',
  hero:    'bg-surface border border-border-strong p-6',
};

export const Tile = forwardRef<HTMLDivElement, TileProps>(
  ({ variant = 'default', className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-lg', variantClass[variant], className)}
      {...rest}
    />
  ),
);
Tile.displayName = 'Tile';
```

- [ ] **Step 4: Update `packages/ui/src/index.ts`**

```ts
export { cn } from './lib/cn.js';
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './components/Button.js';
export { Tile, type TileProps, type TileVariant } from './components/Tile.js';
```

- [ ] **Step 5: Run test (expect pass)**

Run:
```bash
pnpm --filter @perfin/ui test
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/ui
git commit -m "feat(ui): add Tile component with default/raised/hero variants"
```

---

## Task 16: UI — Input component

**Files:**
- Create: `packages/ui/src/components/Input.tsx`
- Create: `packages/ui/tests/Input.test.tsx`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: Write failing test**

Create `packages/ui/tests/Input.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input, Field } from '../src/components/Input.js';

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input placeholder="Email" />);
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
  });

  it('exposes h-10 token class', () => {
    render(<Input data-testid="i" />);
    expect(screen.getByTestId('i')).toHaveClass('h-10');
  });
});

describe('Field', () => {
  it('renders label and hint', () => {
    render(
      <Field label="Email" hint="We'll never share it">
        <Input data-testid="i" />
      </Field>,
    );
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText("We'll never share it")).toBeInTheDocument();
  });

  it('renders error in place of hint', () => {
    render(
      <Field label="Email" hint="hint" error="bad email">
        <Input data-testid="i" />
      </Field>,
    );
    expect(screen.getByText('bad email')).toBeInTheDocument();
    expect(screen.queryByText('hint')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/ui test -- Input
```
Expected: fails.

- [ ] **Step 3: Create `packages/ui/src/components/Input.tsx`**

```tsx
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...rest }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full px-3 rounded-md',
        'bg-surface-2 border border-border-strong',
        'text-text placeholder:text-text-subtle',
        'transition-colors duration-[120ms]',
        'focus:outline-none focus:border-accent focus:shadow-ring',
        'disabled:opacity-50',
        className,
      )}
      {...rest}
    />
  ),
);
Input.displayName = 'Input';

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, htmlFor, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-text-muted">
        {label}
      </label>
      {children}
      {error
        ? <p className="text-xs text-negative">{error}</p>
        : hint
          ? <p className="text-xs text-text-subtle">{hint}</p>
          : null}
    </div>
  );
}
```

- [ ] **Step 4: Update `packages/ui/src/index.ts`**

```ts
export { cn } from './lib/cn.js';
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './components/Button.js';
export { Tile, type TileProps, type TileVariant } from './components/Tile.js';
export { Input, Field, type InputProps, type FieldProps } from './components/Input.js';
```

- [ ] **Step 5: Run test (expect pass)**

Run:
```bash
pnpm --filter @perfin/ui test
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/ui
git commit -m "feat(ui): add Input + Field with label/hint/error states"
```

---

## Task 17: UI — Badge component

**Files:**
- Create: `packages/ui/src/components/Badge.tsx`
- Create: `packages/ui/tests/Badge.test.tsx`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: Write failing test**

Create `packages/ui/tests/Badge.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from '../src/components/Badge.js';

describe('Badge', () => {
  it('renders text', () => {
    render(<Badge>Income</Badge>);
    expect(screen.getByText('Income')).toBeInTheDocument();
  });

  it('income variant uses positive-soft bg', () => {
    render(<Badge variant="income">x</Badge>);
    expect(screen.getByText('x')).toHaveClass('bg-positive-soft');
  });

  it('expense variant uses negative-soft bg', () => {
    render(<Badge variant="expense">x</Badge>);
    expect(screen.getByText('x')).toHaveClass('bg-negative-soft');
  });

  it('warning, info, accent, neutral all render', () => {
    render(<Badge variant="warning">w</Badge>);
    render(<Badge variant="info">i</Badge>);
    render(<Badge variant="accent">a</Badge>);
    render(<Badge variant="neutral">n</Badge>);
    expect(screen.getByText('w')).toHaveClass('bg-warning-soft');
    expect(screen.getByText('i')).toHaveClass('bg-info-soft');
    expect(screen.getByText('a')).toHaveClass('bg-accent-soft');
    expect(screen.getByText('n')).toHaveClass('bg-surface-3');
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/ui test -- Badge
```
Expected: fails.

- [ ] **Step 3: Create `packages/ui/src/components/Badge.tsx`**

```tsx
import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export type BadgeVariant = 'income' | 'expense' | 'warning' | 'info' | 'accent' | 'neutral';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClass: Record<BadgeVariant, string> = {
  income:  'bg-positive-soft text-positive',
  expense: 'bg-negative-soft text-negative',
  warning: 'bg-warning-soft text-warning',
  info:    'bg-info-soft text-info',
  accent:  'bg-accent-soft text-accent',
  neutral: 'bg-surface-3 text-text-muted',
};

export function Badge({ variant = 'neutral', className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 h-6 px-2 rounded-full',
        'text-xs font-semibold',
        variantClass[variant],
        className,
      )}
      {...rest}
    />
  );
}
```

- [ ] **Step 4: Update `packages/ui/src/index.ts`**

```ts
export { cn } from './lib/cn.js';
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './components/Button.js';
export { Tile, type TileProps, type TileVariant } from './components/Tile.js';
export { Input, Field, type InputProps, type FieldProps } from './components/Input.js';
export { Badge, type BadgeProps, type BadgeVariant } from './components/Badge.js';
```

- [ ] **Step 5: Run test (expect pass)**

Run:
```bash
pnpm --filter @perfin/ui test
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/ui
git commit -m "feat(ui): add Badge component with 6 semantic variants"
```

---

## Task 18: UI — Skeleton + Toast components

**Files:**
- Create: `packages/ui/src/components/Skeleton.tsx`
- Create: `packages/ui/src/components/Toast.tsx`
- Create: `packages/ui/tests/Skeleton.test.tsx`
- Create: `packages/ui/tests/Toast.test.tsx`
- Modify: `packages/ui/src/tokens.css`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/ui/tests/Skeleton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Skeleton } from '../src/components/Skeleton.js';

describe('Skeleton', () => {
  it('renders with skeleton class for animation', () => {
    render(<Skeleton data-testid="s" />);
    expect(screen.getByTestId('s')).toHaveClass('skeleton');
  });

  it('row variant default sizing', () => {
    render(<Skeleton data-testid="s" variant="row" />);
    expect(screen.getByTestId('s')).toHaveClass('h-4');
  });

  it('tile variant is taller', () => {
    render(<Skeleton data-testid="s" variant="tile" />);
    expect(screen.getByTestId('s')).toHaveClass('h-32');
  });
});
```

Create `packages/ui/tests/Toast.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Toast } from '../src/components/Toast.js';

describe('Toast', () => {
  it('renders title and description', () => {
    render(<Toast title="Saved" description="All good" />);
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('uses positive stripe by default (info)', () => {
    render(<Toast data-testid="t" title="x" />);
    expect(screen.getByTestId('t')).toHaveClass('border-l-info');
  });

  it('error tone uses negative stripe', () => {
    render(<Toast data-testid="t" title="x" tone="error" />);
    expect(screen.getByTestId('t')).toHaveClass('border-l-negative');
  });
});
```

- [ ] **Step 2: Run tests (expect fail)**

Run:
```bash
pnpm --filter @perfin/ui test
```
Expected: Skeleton + Toast tests fail.

- [ ] **Step 3: Add `skeleton` keyframes to `packages/ui/src/tokens.css`**

Append to the file:

```css
@keyframes pulse-soft {
  0%, 100% { background-color: var(--surface-2); }
  50%      { background-color: var(--surface-hover); }
}

.skeleton {
  animation: pulse-soft 1.6s ease-in-out infinite;
  border-radius: var(--radius-sm);
}
```

- [ ] **Step 4: Create `packages/ui/src/components/Skeleton.tsx`**

```tsx
import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export type SkeletonVariant = 'row' | 'tile' | 'kpi' | 'chart';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
}

const variantClass: Record<SkeletonVariant, string> = {
  row:   'h-4 w-full',
  tile:  'h-32 w-full',
  kpi:   'h-20 w-32',
  chart: 'h-64 w-full',
};

export function Skeleton({ variant = 'row', className, ...rest }: SkeletonProps) {
  return <div className={cn('skeleton', variantClass[variant], className)} {...rest} />;
}
```

- [ ] **Step 5: Create `packages/ui/src/components/Toast.tsx`**

```tsx
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: ReactNode;
  tone?: ToastTone;
}

const toneClass: Record<ToastTone, string> = {
  info:    'border-l-info',
  success: 'border-l-positive',
  warning: 'border-l-warning',
  error:   'border-l-negative',
};

export function Toast({ title, description, tone = 'info', className, ...rest }: ToastProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col gap-1 p-3 pl-4 rounded-md',
        'bg-surface border border-border border-l-4',
        'shadow-2 max-w-sm',
        toneClass[tone],
        className,
      )}
      {...rest}
    >
      <div className="text-sm font-semibold text-text">{title}</div>
      {description ? <div className="text-xs text-text-muted">{description}</div> : null}
    </div>
  );
}
```

- [ ] **Step 6: Update `packages/ui/src/index.ts`**

```ts
export { cn } from './lib/cn.js';
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './components/Button.js';
export { Tile, type TileProps, type TileVariant } from './components/Tile.js';
export { Input, Field, type InputProps, type FieldProps } from './components/Input.js';
export { Badge, type BadgeProps, type BadgeVariant } from './components/Badge.js';
export { Skeleton, type SkeletonProps, type SkeletonVariant } from './components/Skeleton.js';
export { Toast, type ToastProps, type ToastTone } from './components/Toast.js';
```

- [ ] **Step 7: Run tests (expect pass)**

Run:
```bash
pnpm --filter @perfin/ui test
```
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/ui
git commit -m "feat(ui): add Skeleton and Toast components"
```

---

## Task 19: UI — Modal component

**Files:**
- Create: `packages/ui/src/components/Modal.tsx`
- Create: `packages/ui/tests/Modal.test.tsx`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: Write failing test**

Create `packages/ui/tests/Modal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Modal } from '../src/components/Modal.js';

describe('Modal', () => {
  it('renders content when open', () => {
    render(
      <Modal open onOpenChange={() => undefined} title="Hi">
        <p>body content</p>
      </Modal>,
    );
    expect(screen.getByText('Hi')).toBeInTheDocument();
    expect(screen.getByText('body content')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    render(
      <Modal open={false} onOpenChange={() => undefined} title="Hi">
        <p>body content</p>
      </Modal>,
    );
    expect(screen.queryByText('body content')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/ui test -- Modal
```
Expected: fails.

- [ ] **Step 3: Create `packages/ui/src/components/Modal.tsx`**

```tsx
import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  size?: ModalSize;
  children: ReactNode;
}

const sizeClass: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export function Modal({ open, onOpenChange, title, description, size = 'md', children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
          )}
        />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full',
            'bg-surface border border-border-strong rounded-xl shadow-2 p-6',
            sizeClass[size],
          )}
        >
          <Dialog.Title className="text-lg font-semibold text-text">{title}</Dialog.Title>
          {description ? (
            <Dialog.Description className="text-sm text-text-muted mt-1">
              {description}
            </Dialog.Description>
          ) : null}
          <div className="mt-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 4: Update `packages/ui/src/index.ts`**

```ts
export { cn } from './lib/cn.js';
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './components/Button.js';
export { Tile, type TileProps, type TileVariant } from './components/Tile.js';
export { Input, Field, type InputProps, type FieldProps } from './components/Input.js';
export { Badge, type BadgeProps, type BadgeVariant } from './components/Badge.js';
export { Skeleton, type SkeletonProps, type SkeletonVariant } from './components/Skeleton.js';
export { Toast, type ToastProps, type ToastTone } from './components/Toast.js';
export { Modal, type ModalProps, type ModalSize } from './components/Modal.js';
```

- [ ] **Step 5: Run test (expect pass)**

Run:
```bash
pnpm --filter @perfin/ui test
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/ui
git commit -m "feat(ui): add Modal component using Radix Dialog"
```

---

## Task 20: Web app — Next.js scaffold

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/globals.css`
- Create: `apps/web/lib/env.ts`

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@perfin/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start --port 3000",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@auth/core": "0.37.4",
    "@perfin/db": "workspace:*",
    "@perfin/ui": "workspace:*",
    "@fontsource-variable/inter": "5.2.5",
    "@fontsource-variable/jetbrains-mono": "5.2.5",
    "bcryptjs": "3.0.2",
    "next": "15.0.3",
    "next-auth": "5.0.0-beta.25",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "zod": "3.23.8"
  },
  "devDependencies": {
    "@perfin/config": "workspace:*",
    "@playwright/test": "1.48.2",
    "@tailwindcss/postcss": "4.0.0-beta.4",
    "@types/bcryptjs": "2.4.6",
    "@types/node": "22.9.0",
    "@types/react": "19.0.0",
    "@types/react-dom": "19.0.0",
    "tailwindcss": "4.0.0-beta.4",
    "typescript": "5.6.3"
  }
}
```

- [ ] **Step 2: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "@perfin/config/tsconfig.base.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "noEmit": true,
    "incremental": true,
    "paths": { "@/*": ["./*"] },
    "types": ["node", "next"]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `apps/web/next.config.ts`**

```ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@perfin/ui', '@perfin/db'],
  experimental: { typedRoutes: true },
};

export default config;
```

- [ ] **Step 4: Create `apps/web/postcss.config.mjs`**

```js
export default {
  plugins: { '@tailwindcss/postcss': {} },
};
```

- [ ] **Step 5: Create `apps/web/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';
import preset from '@perfin/ui/tailwind.preset';

const config: Config = {
  presets: [preset as Config],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
};

export default config;
```

- [ ] **Step 6: Create `apps/web/app/globals.css`**

```css
@import 'tailwindcss';
@import '@perfin/ui/tokens.css';
```

- [ ] **Step 7: Create `apps/web/lib/env.ts`**

```ts
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(16),
  AUTH_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_URL: process.env.AUTH_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
});
```

- [ ] **Step 8: Create `apps/web/app/layout.tsx`**

```tsx
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Perfin — your money, finally explained',
  description: 'AI-powered personal finance.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 9: Create `apps/web/app/page.tsx`**

```tsx
import { Button } from '@perfin/ui';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-semibold tracking-tight">
        Your money, finally explained.
      </h1>
      <p className="text-text-muted text-center max-w-md">
        Coming soon. Phase 0 placeholder.
      </p>
      <div className="flex gap-3">
        <Button asChild={false} variant="primary">
          <Link href="/signup">Sign up</Link>
        </Button>
        <Button variant="secondary">
          <Link href="/login">Log in</Link>
        </Button>
      </div>
    </main>
  );
}
```

- [ ] **Step 10: Install + boot**

Run:
```bash
pnpm install
cp .env.example .env
pnpm --filter @perfin/web dev
```
Open `http://localhost:3000` in a browser. Expected: dark page with "Your money, finally explained." centered. Stop the server (Ctrl-C).

- [ ] **Step 11: Typecheck**

Run:
```bash
pnpm --filter @perfin/web typecheck
```
Expected: clean.

- [ ] **Step 12: Commit**

```bash
git add apps/web .env pnpm-lock.yaml
git commit -m "feat(web): scaffold Next.js 15 app with tokens, fonts, landing placeholder"
```

---

## Task 21: Web — Auth.js v5 setup

**Files:**
- Create: `apps/web/lib/auth.ts`
- Create: `apps/web/lib/password.ts`
- Create: `apps/web/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Create `apps/web/lib/password.ts`**

```ts
import bcrypt from 'bcryptjs';

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 2: Create `apps/web/lib/auth.ts`**

```ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { eq } from 'drizzle-orm';
import { createDb, users } from '@perfin/db';
import { env } from './env.js';
import { verifyPassword } from './password.js';

const { db } = createDb(env.DATABASE_URL);

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.AUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(creds) {
        const email = String(creds?.email ?? '').toLowerCase().trim();
        const password = String(creds?.password ?? '');
        if (!email || !password) return null;

        const [user] = await db.select().from(users).where(eq(users.email, email));
        if (!user) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        return { id: String(user.id), email: user.email };
      },
    }),
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? [Google({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET })]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) (session.user as { id?: string }).id = String(token.id);
      return session;
    },
  },
});
```

- [ ] **Step 3: Create `apps/web/app/api/auth/[...nextauth]/route.ts`**

```ts
export { GET, POST } from '@/lib/auth';

// Provided by next-auth handlers; alias the named exports to satisfy Next route convention.
```

Wait — that's wrong; let me correct it. The proper export shape:

Replace with:

```ts
import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
```

- [ ] **Step 4: Verify Auth.js handler responds**

Run dev server:
```bash
pnpm --filter @perfin/web dev
```
In another shell:
```bash
curl -s http://localhost:3000/api/auth/csrf | head
```
Expected: JSON with `csrfToken` field. Stop the server.

- [ ] **Step 5: Typecheck**

Run:
```bash
pnpm --filter @perfin/web typecheck
```
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib apps/web/app/api
git commit -m "feat(web): add Auth.js v5 with credentials and optional Google"
```

---

## Task 22: Web — Signup page + server action

**Files:**
- Create: `apps/web/app/(auth)/layout.tsx`
- Create: `apps/web/app/(auth)/signup/page.tsx`
- Create: `apps/web/app/(auth)/signup/actions.ts`

- [ ] **Step 1: Create `apps/web/app/(auth)/layout.tsx`**

```tsx
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
```

- [ ] **Step 2: Create `apps/web/app/(auth)/signup/actions.ts`**

```ts
'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createDb, users } from '@perfin/db';
import { env } from '@/lib/env';
import { hashPassword } from '@/lib/password';
import { signIn } from '@/lib/auth';

const schema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

const { db } = createDb(env.DATABASE_URL);

export type SignupState = { error?: string };

export async function signupAction(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = schema.safeParse({
    email: String(formData.get('email') ?? '').toLowerCase().trim(),
    password: String(formData.get('password') ?? ''),
  });
  if (!parsed.success) return { error: 'Enter a valid email and an 8+ character password.' };

  const { email, password } = parsed.data;

  try {
    const passwordHash = await hashPassword(password);
    await db.insert(users).values({ email, passwordHash });
  } catch (err) {
    if (err instanceof Error && err.message.includes('users_email_unique')) {
      return { error: 'That email is already registered. Try logging in.' };
    }
    throw err;
  }

  await signIn('credentials', { email, password, redirect: false });
  redirect('/app');
}
```

- [ ] **Step 3: Create `apps/web/app/(auth)/signup/page.tsx`**

```tsx
'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button, Tile, Field, Input } from '@perfin/ui';
import { signupAction, type SignupState } from './actions.js';

const initial: SignupState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" size="lg" disabled={pending}>
      {pending ? 'Creating account…' : 'Create account'}
    </Button>
  );
}

export default function SignupPage() {
  const [state, action] = useFormState(signupAction, initial);

  return (
    <Tile variant="hero" className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Create your Perfin account</h1>
        <p className="text-sm text-text-muted">It's free. No card required.</p>
      </header>
      <form action={action} className="space-y-4">
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          hint="At least 8 characters."
          error={state.error}
        >
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
        </Field>
        <SubmitButton />
      </form>
      <p className="text-sm text-text-muted text-center">
        Already have an account? <Link className="text-accent" href="/login">Log in</Link>
      </p>
    </Tile>
  );
}
```

- [ ] **Step 4: Smoke test**

Run dev server:
```bash
pnpm --filter @perfin/web dev
```
Open `http://localhost:3000/signup`. Submit `test@perfin.dev` / `password123`. Expected: redirected to `/app` (which 404s — fixed in Task 24). Confirm row in DB:
```bash
docker exec -i $(docker compose ps -q postgres) psql -U perfin -d perfin -c "SELECT id, email FROM users;"
```
Expected: a row with the new email. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(auth\)
git commit -m "feat(web): add signup page with server action"
```

---

## Task 23: Web — Login page + server action

**Files:**
- Create: `apps/web/app/(auth)/login/page.tsx`
- Create: `apps/web/app/(auth)/login/actions.ts`

- [ ] **Step 1: Create `apps/web/app/(auth)/login/actions.ts`**

```ts
'use server';

import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { z } from 'zod';
import { signIn } from '@/lib/auth';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: String(formData.get('email') ?? '').toLowerCase().trim(),
    password: String(formData.get('password') ?? ''),
  });
  if (!parsed.success) return { error: 'Enter a valid email and password.' };

  try {
    await signIn('credentials', { ...parsed.data, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) return { error: 'Wrong email or password.' };
    throw err;
  }

  redirect('/app');
}
```

- [ ] **Step 2: Create `apps/web/app/(auth)/login/page.tsx`**

```tsx
'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button, Tile, Field, Input } from '@perfin/ui';
import { loginAction, type LoginState } from './actions.js';

const initial: LoginState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" size="lg" disabled={pending}>
      {pending ? 'Logging in…' : 'Log in'}
    </Button>
  );
}

export default function LoginPage() {
  const [state, action] = useFormState(loginAction, initial);

  return (
    <Tile variant="hero" className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Welcome back</h1>
        <p className="text-sm text-text-muted">Log in to continue.</p>
      </header>
      <form action={action} className="space-y-4">
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" htmlFor="password" error={state.error}>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <SubmitButton />
      </form>
      <p className="text-sm text-text-muted text-center">
        New here? <Link className="text-accent" href="/signup">Create an account</Link>
      </p>
    </Tile>
  );
}
```

- [ ] **Step 3: Smoke test**

Run dev server, open `http://localhost:3000/login`, log in with the user from Task 22. Expected: redirected to `/app` (still 404).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(auth\)/login
git commit -m "feat(web): add login page with server action"
```

---

## Task 24: Web — Middleware + protected (app) route group + Sidebar

**Files:**
- Create: `apps/web/middleware.ts`
- Create: `apps/web/app/(app)/layout.tsx`
- Create: `apps/web/app/(app)/app/page.tsx`
- Create: `apps/web/components/Sidebar.tsx`

- [ ] **Step 1: Create `apps/web/middleware.ts`**

```ts
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const path = req.nextUrl.pathname;

  if (path.startsWith('/app') && !isLoggedIn) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if ((path === '/login' || path === '/signup') && isLoggedIn) {
    const url = req.nextUrl.clone();
    url.pathname = '/app';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/app/:path*', '/login', '/signup'],
};
```

- [ ] **Step 2: Create `apps/web/components/Sidebar.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@perfin/ui';

const items = [
  { href: '/app',              label: 'Home',           icon: '◆' },
  { href: '/app/transactions', label: 'Transactions',   icon: '≡' },
  { href: '/app/insights',     label: 'Insights',       icon: '✨' },
  { href: '/app/ask',          label: 'Ask',            icon: '✦' },
  { href: '/app/accounts',     label: 'Accounts',       icon: '⌂' },
  { href: '/app/budgets',      label: 'Budgets & Goals',icon: '◎' },
  { href: '/app/reports',      label: 'Reports',        icon: '▤' },
  { href: '/app/inbox',        label: 'Inbox',          icon: '✉' },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-60 h-screen bg-surface border-r border-border flex flex-col">
      <header className="h-16 px-5 flex items-center border-b border-border">
        <span className="text-text font-semibold">Perfin</span>
      </header>
      <nav className="flex-1 p-3 space-y-0.5" aria-label="Primary">
        {items.map((it) => {
          const active = path === it.href || (it.href !== '/app' && path.startsWith(it.href));
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                'flex items-center gap-2 h-9 px-3 rounded-md text-sm font-medium transition-colors duration-[120ms]',
                active
                  ? 'bg-accent-soft text-accent'
                  : 'text-text-muted hover:bg-surface-2 hover:text-text',
              )}
            >
              <span aria-hidden className="w-4 text-center">{it.icon}</span>
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>
      <footer className="p-3 border-t border-border text-xs text-text-subtle">
        v0.1 · Phase 0
      </footer>
    </aside>
  );
}
```

- [ ] **Step 3: Create `apps/web/app/(app)/layout.tsx`**

```tsx
import type { ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Create `apps/web/app/(app)/app/page.tsx`**

```tsx
import { Tile } from '@perfin/ui';

export default function HomePage() {
  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-2xl font-semibold mb-6">Welcome.</h1>
      <Tile variant="hero">
        <p className="text-text-muted">
          Your dashboard will appear here once you've added some transactions.
          For now, this is the Phase 0 shell — sidebar, theme, auth all working.
        </p>
      </Tile>
    </div>
  );
}
```

- [ ] **Step 5: Smoke test**

Run dev server, log in, expect `/app` to render the dark sidebar shell with "Welcome." headline. Click sidebar items — they 404 (expected — pages land in later phases). Try visiting `/app` while logged out — expect redirect to `/login`.

- [ ] **Step 6: Typecheck**

Run:
```bash
pnpm --filter @perfin/web typecheck
```
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): protect /app routes, add sidebar shell and home placeholder"
```

---

## Task 25: Worker app — Fastify skeleton with /health

**Files:**
- Create: `apps/worker/package.json`
- Create: `apps/worker/tsconfig.json`
- Create: `apps/worker/src/env.ts`
- Create: `apps/worker/src/server.ts`
- Create: `apps/worker/src/routes/health.ts`
- Create: `apps/worker/tests/health.test.ts`

- [ ] **Step 1: Create `apps/worker/package.json`**

```json
{
  "name": "@perfin/worker",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "tsx src/server.ts",
    "build": "tsc -p .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@perfin/db": "workspace:*",
    "fastify": "5.1.0",
    "zod": "3.23.8"
  },
  "devDependencies": {
    "@perfin/config": "workspace:*",
    "@types/node": "22.9.0",
    "tsx": "4.19.1",
    "typescript": "5.6.3",
    "vitest": "2.1.4"
  }
}
```

- [ ] **Step 2: Create `apps/worker/tsconfig.json`**

```json
{
  "extends": "@perfin/config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "noEmit": false,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Create `apps/worker/src/env.ts`**

```ts
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  WORKER_PORT: z.coerce.number().int().positive().default(8001),
  WORKER_HMAC_SECRET: z.string().min(8),
});

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  WORKER_PORT: process.env.WORKER_PORT,
  WORKER_HMAC_SECRET: process.env.WORKER_HMAC_SECRET,
});
```

- [ ] **Step 4: Create `apps/worker/src/routes/health.ts`**

```ts
import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }));
}
```

- [ ] **Step 5: Create `apps/worker/src/server.ts`**

```ts
import Fastify from 'fastify';
import { env } from './env.js';
import { healthRoutes } from './routes/health.js';

export async function buildServer() {
  const app = Fastify({ logger: true });
  await app.register(healthRoutes);
  return app;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  buildServer()
    .then((app) => app.listen({ port: env.WORKER_PORT, host: '0.0.0.0' }))
    .catch((err) => { console.error(err); process.exit(1); });
}
```

- [ ] **Step 6: Write failing test**

Create `apps/worker/tests/health.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../src/server.js';

describe('GET /health', () => {
  it('returns ok:true', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.ts).toBe('string');
    await app.close();
  });
});
```

- [ ] **Step 7: Install + run test**

Run:
```bash
pnpm install
DATABASE_URL=postgres://perfin:perfin@localhost:5432/perfin \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
  pnpm --filter @perfin/worker test
```
Expected: 1 test passes.

- [ ] **Step 8: Boot worker and curl**

Run:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5432/perfin \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
  pnpm --filter @perfin/worker dev
```
In another shell:
```bash
curl -s http://localhost:8001/health
```
Expected: `{"ok":true,"ts":"..."}`. Stop the worker.

- [ ] **Step 9: Commit**

```bash
git add apps/worker pnpm-lock.yaml
git commit -m "feat(worker): scaffold Fastify worker with /health endpoint"
```

---

## Task 26: Phase 0 acceptance — Playwright happy path + build

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/tests/e2e/happy-path.spec.ts`

- [ ] **Step 1: Create `apps/web/playwright.config.ts`**

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
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
});
```

- [ ] **Step 2: Install Playwright browsers**

Run:
```bash
pnpm --filter @perfin/web exec playwright install chromium
```
Expected: chromium installed (one-time download).

- [ ] **Step 3: Create `apps/web/tests/e2e/happy-path.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('signup → land on /app → sidebar visible', async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e-${stamp}@perfin.dev`;
  const password = 'password12345';

  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /create account/i }).click();

  await page.waitForURL('**/app', { timeout: 10_000 });
  await expect(page.getByText('Welcome.')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Insights' })).toBeVisible();
});

test('logout redirect: /app while logged out goes to /login', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/app');
  await page.waitForURL('**/login');
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
});
```

- [ ] **Step 4: Run e2e test**

Ensure docker Postgres is running, env vars are set in `.env`, then run:
```bash
pnpm --filter @perfin/web test:e2e
```
Expected: both tests pass. (Playwright will boot the dev server automatically.)

- [ ] **Step 5: Run full repo typecheck and tests**

Run:
```bash
pnpm typecheck
pnpm test
```
Expected: every package typechecks; every package's tests pass.

- [ ] **Step 6: Run production build**

Run:
```bash
pnpm build
```
Expected: each app builds without errors. `apps/web/.next` and `apps/worker/dist` populated.

- [ ] **Step 7: Commit**

```bash
git add apps/web/playwright.config.ts apps/web/tests
git commit -m "test(web): add Playwright e2e happy-path covering signup and route protection"
```

- [ ] **Step 8: Tag the milestone**

```bash
git tag v0.1.0-phase0
```

---

## Phase 0 — Definition of done checklist

- [ ] `pnpm install` from a clean clone succeeds
- [ ] `docker compose up -d` boots Postgres healthy
- [ ] `pnpm db:migrate` applies migrations cleanly to a fresh DB
- [ ] `pnpm dev` boots web (3000) and worker (8001) without errors
- [ ] `pnpm typecheck` is clean across the whole repo
- [ ] `pnpm test` passes for `@perfin/db`, `@perfin/ui`, `@perfin/worker`
- [ ] `pnpm --filter @perfin/web test:e2e` happy-path passes
- [ ] `pnpm build` succeeds for all apps
- [ ] Manual visit: signup → land on `/app` → see sidebar + theme tokens applied → log out → `/app` redirects to `/login`
- [ ] Worker `curl http://localhost:8001/health` returns `{ "ok": true }`
- [ ] `scripts/import-sqlite.ts` executes without error against the existing `ai_accountant/database/ledger.db` (or skips cleanly if not present)
- [ ] Tag `v0.1.0-phase0` exists on `main`

---

## Self-review notes

**Spec coverage check.** This plan covers everything in the design spec's **Phase 0** definition: monorepo init (Tasks 1-2), Drizzle schema + migrations covering every table from §6.2 of the spec (Tasks 3-10), Auth.js with credentials + Google scaffolding (Tasks 21-23), Next.js shell with sidebar containing all 8 nav items from §3 (Task 24), design-system primitives Button/Tile/Input/Badge/Skeleton/Toast/Modal (Tasks 14-19), and the SQLite-to-Postgres import script (Task 12). The Fastify worker is scaffolded with `/health` (Task 25); ingestion endpoints land in Phase 1.

**Out of scope for this plan (correctly deferred to Phases 1-5):** PDF/CSV/Excel extractors, categorization (rules + LLM), upload flow, transactions/accounts/budgets pages, recurring/anomaly detectors, insights generation, Home bento, Inbox, Ask page + agent, Plaid + Postmark integrations, marketing site, billing, PWA push.

**Type-consistency check.** Schema field names used in Task 12 (import script) — `passwordHash`, `accountId`, `amountCents`, `sourceFile`, `rawDescription` — match the schema definitions in Tasks 5-9. Component prop types (`ButtonProps.variant`, `TileProps.variant`, `BadgeProps.variant`, `ModalProps.size`, `ToastProps.tone`, `SkeletonProps.variant`) are stable across the index re-exports. The `auth()` middleware import in Task 24 matches the export in Task 21.

**Note on Task 21 Step 3.** The first version of the route file was wrong; the corrected version (using `handlers` from the auth lib) is what should be committed. Engineers executing should use the second snippet only.
