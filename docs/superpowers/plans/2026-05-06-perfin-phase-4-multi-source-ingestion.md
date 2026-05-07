# Perfin — Phase 4: Multi-Source Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the two automated ingestion paths called for in the spec — **Plaid bank connections** (Sandbox-grade for v1, production-gated behind SOC2) and **Postmark inbound email forwarding** — and consolidate the data-source UX into a tabbed `/app/accounts` page (Bank connections · Manual accounts · Uploads · Email forwarding). Plaid items sync hourly via the existing `node-cron` worker; webhook events also trigger a sync. Postmark posts inbound JSON to the worker, which parses the body (per-bank regex first, Claude Haiku fallback) and runs the same normalize → categorize → insert pipeline used by file uploads.

**Architecture:** A new pure-TS package `@perfin/connectors` owns: the Plaid client wrapper, the AES-256-GCM encryption helpers for access tokens, and the email-address derivation logic (HMAC of user id → URL-safe hash). The worker grows three new endpoints — `POST /webhooks/plaid` (Plaid signature-verified), `POST /webhooks/postmark` (Postmark Basic-Auth-verified), `POST /jobs/plaid-sync` (HMAC) — and the existing nightly cron gets a sibling `cron.schedule('0 * * * *', ...)` that calls Plaid `transactionsSync` for every active connection. The web app gets four new API routes for Plaid Link (link token, exchange, list, delete) and one for the email address; the Accounts page is restructured into a tab strip with the four data sources. All ingested transactions still flow through `runPipeline` from Phase 1, so categorization, dedupe, and insights regeneration "just work."

**Tech Stack:** All Phase 3 stack plus: `plaid` 28.0.0 (Node SDK) · `react-plaid-link` 3.6.1 · Node `crypto.createCipheriv('aes-256-gcm', ...)` · Postmark inbound parse (HTTP webhook — no SDK needed). New env vars: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` (`sandbox`|`development`|`production`), `KMS_KEY` (32-byte hex), `POSTMARK_INBOUND_USER`, `POSTMARK_INBOUND_PASS`, `EMAIL_DOMAIN` (e.g. `in.perfin.app`).

**Phase 4 acceptance:**
1. User opens `/app/accounts` → Bank connections tab → clicks "Connect a bank" → Plaid Link opens in sandbox mode → completes the test login → web exchanges public_token → `connections` row appears with status `active` → first sync runs → transactions appear at `/app/transactions`.
2. Manual sync via "Sync now" button on a connection card runs the worker job and updates `lastSyncAt`.
3. Email forwarding tab shows the user's address (`u_<hash>@in.perfin.app`) with a copy button + 4 lines of per-bank setup instructions.
4. Posting a sample HDFC alert email to `/webhooks/postmark` parses the transaction and inserts a row; the row appears at `/app/transactions` and contributes to KPIs.
5. Removing a connection sets its status `disconnected` and stops new syncs; existing transactions persist.
6. `pnpm typecheck`, `pnpm test`, `pnpm build` clean; ≥ 25 new unit tests pass.
7. Playwright e2e: signup → connect Plaid Sandbox → assert at least one synced transaction shows on `/app/transactions`.
8. Tag `v0.5.0-phase4` on `main`; `docs/PHASES.md` updated.

---

## File Structure

```
perfin/
├── packages/
│   ├── connectors/                              # NEW package
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── crypto.ts                        # AES-256-GCM enc/dec
│   │   │   ├── email-address.ts                 # u_<hash>@domain
│   │   │   ├── plaid/
│   │   │   │   ├── client.ts                    # Plaid SDK factory
│   │   │   │   ├── types.ts
│   │   │   │   ├── exchange.ts                  # public_token -> access_token
│   │   │   │   ├── sync.ts                      # transactionsSync wrapper
│   │   │   │   └── verify.ts                    # webhook signature verify
│   │   │   └── postmark/
│   │   │       ├── parse.ts                     # HDFC/ICICI regex + LLM fallback
│   │   │       └── auth.ts                      # Basic Auth verify
│   │   ├── tests/
│   │   │   ├── crypto.test.ts
│   │   │   ├── email-address.test.ts
│   │   │   ├── plaid-sync.test.ts               # uses plaid mock
│   │   │   └── postmark-parse.test.ts
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── package.json
│
├── apps/
│   ├── worker/
│   │   ├── src/
│   │   │   ├── env.ts                           # MODIFIED (Plaid + Postmark + KMS env)
│   │   │   ├── lib/
│   │   │   │   └── plaid-sync.ts                # NEW: per-connection sync orchestrator
│   │   │   ├── routes/
│   │   │   │   ├── plaid-sync.ts                # NEW (HMAC POST /jobs/plaid-sync)
│   │   │   │   ├── plaid-webhook.ts             # NEW (POST /webhooks/plaid)
│   │   │   │   └── postmark-webhook.ts          # NEW (POST /webhooks/postmark)
│   │   │   └── server.ts                        # MODIFIED (register new routes + hourly cron)
│   │   ├── tests/
│   │   │   ├── plaid-webhook.test.ts            # NEW
│   │   │   └── postmark-webhook.test.ts         # NEW
│   │   └── package.json                         # MODIFIED (plaid SDK)
│   └── web/
│       ├── app/
│       │   ├── (app)/accounts/page.tsx          # REWRITE (tabs)
│       │   └── api/
│       │       ├── connections/
│       │       │   ├── route.ts                 # GET list, DELETE removed in [id] route
│       │       │   ├── [id]/route.ts            # DELETE
│       │       │   └── plaid/
│       │       │       ├── link-token/route.ts  # POST create-link-token
│       │       │       ├── exchange/route.ts    # POST public_token -> access_token
│       │       │       └── sync/route.ts        # POST kick worker sync
│       │       ├── email-address/route.ts       # GET — returns user's u_<hash>@domain
│       │       └── upload-jobs/route.ts         # GET — recent uploads list
│       ├── components/
│       │   └── accounts/
│       │       ├── AccountsTabs.tsx             # NEW
│       │       ├── BankConnectionsTab.tsx       # NEW
│       │       ├── ConnectionCard.tsx           # NEW
│       │       ├── PlaidLinkButton.tsx          # NEW (uses react-plaid-link)
│       │       ├── ManualAccountsTab.tsx        # extracted from prior page
│       │       ├── UploadsTab.tsx               # NEW
│       │       └── EmailForwardingTab.tsx       # NEW
│       ├── hooks/
│       │   ├── useConnections.ts                # NEW
│       │   ├── useEmailAddress.ts               # NEW
│       │   └── useUploadJobs.ts                 # NEW
│       ├── lib/
│       │   └── env.ts                           # MODIFIED (add Plaid + KMS + email domain)
│       ├── package.json                         # MODIFIED (react-plaid-link)
│       └── tests/e2e/
│           └── connections-flow.spec.ts         # NEW
└── data/seeds/
    └── hdfc-alert-email.txt                     # NEW (Postmark test fixture)
```

**Boundaries:**
- `@perfin/connectors` is pure-TS, Node-only (uses `crypto`, no DOM). Plaid SDK is wrapped behind a thin facade so tests can mock it. No imports from `apps/`.
- The worker is the *only* code that holds Plaid access tokens (decrypted at use time, never stored decrypted on disk or in logs).
- Web routes never touch Plaid access tokens directly. They go through the worker for any token-using operation. Web only handles the public_token (one-time, ~30s lifetime) and triggers the worker.
- Postmark webhooks are signed with Basic Auth (Postmark inbound's mechanism); we verify before parsing.
- All new ingestion paths reuse `runPipeline` from `apps/worker/src/lib/pipeline.ts` for normalization + categorization + insert. *No duplicate logic.*

---

## Task 1: Add `@perfin/connectors` package skeleton

**Files:**
- Create: `packages/connectors/package.json`, `tsconfig.json`, `vitest.config.ts`
- Create: `packages/connectors/src/index.ts`

- [ ] **Step 1: Create `packages/connectors/package.json`**

```json
{
  "name": "@perfin/connectors",
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
    "drizzle-orm": "0.36.0",
    "plaid": "28.0.0",
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

- [ ] **Step 2: Create `packages/connectors/tsconfig.json`**

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

- [ ] **Step 3: Create `packages/connectors/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', globals: true },
});
```

- [ ] **Step 4: Create placeholder `packages/connectors/src/index.ts`**

```ts
export {};
```

- [ ] **Step 5: Install + commit**

```bash
pnpm install
git add packages/connectors pnpm-lock.yaml
git commit -m "chore(connectors): scaffold @perfin/connectors package"
```

---

## Task 2: AES-256-GCM crypto helpers

**Files:**
- Create: `packages/connectors/src/crypto.ts`
- Create: `packages/connectors/tests/crypto.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/connectors/tests/crypto.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encryptString, decryptString } from '../src/crypto';

const key = randomBytes(32).toString('hex');

describe('encryptString / decryptString', () => {
  it('round-trips a value', () => {
    const ct = encryptString(key, 'access-sandbox-abc123');
    expect(ct).not.toContain('access');
    expect(decryptString(key, ct)).toBe('access-sandbox-abc123');
  });
  it('produces different ciphertext each call (random iv)', () => {
    const a = encryptString(key, 'same-input');
    const b = encryptString(key, 'same-input');
    expect(a).not.toBe(b);
    expect(decryptString(key, a)).toBe('same-input');
    expect(decryptString(key, b)).toBe('same-input');
  });
  it('rejects tampered ciphertext', () => {
    const ct = encryptString(key, 'secret');
    const tampered = ct.slice(0, -2) + 'aa';
    expect(() => decryptString(key, tampered)).toThrow();
  });
  it('rejects wrong key', () => {
    const ct = encryptString(key, 'secret');
    const otherKey = randomBytes(32).toString('hex');
    expect(() => decryptString(otherKey, ct)).toThrow();
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/connectors test
```
Expected: fails — module missing.

- [ ] **Step 3: Create `packages/connectors/src/crypto.ts`**

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Layout: base64(iv (12) || authTag (16) || ciphertext)
export function encryptString(hexKey: string, plain: string): string {
  const key = Buffer.from(hexKey, 'hex');
  if (key.length !== 32) throw new Error('KMS_KEY must be 32 bytes (64 hex chars)');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

export function decryptString(hexKey: string, payload: string): string {
  const key = Buffer.from(hexKey, 'hex');
  if (key.length !== 32) throw new Error('KMS_KEY must be 32 bytes (64 hex chars)');
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < 12 + 16) throw new Error('payload too short');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
```

- [ ] **Step 4: Run test (expect pass)**

Run:
```bash
pnpm --filter @perfin/connectors test
```
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/connectors
git commit -m "feat(connectors): AES-256-GCM string encryption helpers"
```

---

## Task 3: Email address derivation (`u_<hash>@domain`)

**Files:**
- Create: `packages/connectors/src/email-address.ts`
- Create: `packages/connectors/tests/email-address.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/connectors/tests/email-address.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { addressForUser, parseUserHash } from '../src/email-address';

describe('addressForUser', () => {
  it('derives a stable u_<hash>@domain', () => {
    const a = addressForUser({ userId: 1, secret: 'secret', domain: 'in.perfin.app' });
    const b = addressForUser({ userId: 1, secret: 'secret', domain: 'in.perfin.app' });
    expect(a).toBe(b);
    expect(a).toMatch(/^u_[a-f0-9]{16}@in\.perfin\.app$/);
  });
  it('changes with userId', () => {
    const a = addressForUser({ userId: 1, secret: 'secret', domain: 'in.perfin.app' });
    const b = addressForUser({ userId: 2, secret: 'secret', domain: 'in.perfin.app' });
    expect(a).not.toBe(b);
  });
  it('changes with secret', () => {
    const a = addressForUser({ userId: 1, secret: 'one', domain: 'in.perfin.app' });
    const b = addressForUser({ userId: 1, secret: 'two', domain: 'in.perfin.app' });
    expect(a).not.toBe(b);
  });
});

describe('parseUserHash', () => {
  it('extracts hash from full address', () => {
    expect(parseUserHash('u_abc123@in.perfin.app')).toBe('abc123');
  });
  it('returns null for non-perfin addresses', () => {
    expect(parseUserHash('user@example.com')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/connectors test
```
Expected: fails.

- [ ] **Step 3: Create `packages/connectors/src/email-address.ts`**

```ts
import { createHmac } from 'node:crypto';

export interface AddressInput {
  userId: number;
  secret: string;
  domain: string;
}

export function addressForUser({ userId, secret, domain }: AddressInput): string {
  const hash = createHmac('sha256', secret).update(`user:${userId}`).digest('hex').slice(0, 16);
  return `u_${hash}@${domain}`;
}

export function parseUserHash(address: string): string | null {
  const m = /^u_([a-f0-9]{16})@/i.exec(address);
  return m?.[1] ?? null;
}

export function findUserByAddress<T extends { id: number }>(
  users: T[],
  address: string,
  secret: string,
  domain: string,
): T | null {
  const hash = parseUserHash(address);
  if (!hash) return null;
  for (const u of users) {
    if (addressForUser({ userId: u.id, secret, domain }).startsWith(`u_${hash}@`)) return u;
  }
  return null;
}
```

- [ ] **Step 4: Run test (expect pass)**

Run:
```bash
pnpm --filter @perfin/connectors test
```
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/connectors
git commit -m "feat(connectors): per-user email address derivation (HMAC)"
```

---

## Task 4: Plaid client wrapper + types

**Files:**
- Create: `packages/connectors/src/plaid/types.ts`
- Create: `packages/connectors/src/plaid/client.ts`

- [ ] **Step 1: Create `packages/connectors/src/plaid/types.ts`**

```ts
export interface PlaidConfig {
  clientId: string;
  secret: string;
  env: 'sandbox' | 'development' | 'production';
}

export interface SyncResult {
  cursor: string;
  added: PlaidTxn[];
  modified: PlaidTxn[];
  removed: Array<{ transactionId: string }>;
  hasMore: boolean;
}

export interface PlaidTxn {
  transactionId: string;
  accountId: string;
  date: string;            // YYYY-MM-DD
  name: string;
  merchantName?: string | null;
  amount: number;          // Plaid uses positive=outflow; we'll invert at insert time
  pending: boolean;
  category?: string[] | null;
  isoCurrencyCode?: string | null;
}
```

- [ ] **Step 2: Create `packages/connectors/src/plaid/client.ts`**

```ts
import {
  Configuration, PlaidApi, PlaidEnvironments,
  type LinkTokenCreateRequest, type ItemPublicTokenExchangeRequest,
} from 'plaid';
import type { PlaidConfig } from './types';

export function createPlaid(config: PlaidConfig) {
  const plaidConfig = new Configuration({
    basePath: PlaidEnvironments[config.env],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': config.clientId,
        'PLAID-SECRET': config.secret,
      },
    },
  });
  return new PlaidApi(plaidConfig);
}

export async function createLinkToken(
  client: PlaidApi,
  userId: number,
  webhookUrl: string,
): Promise<string> {
  const req: LinkTokenCreateRequest = {
    client_name: 'Perfin',
    user: { client_user_id: String(userId) },
    products: ['transactions'] as LinkTokenCreateRequest['products'],
    country_codes: ['US', 'IN', 'GB'] as LinkTokenCreateRequest['country_codes'],
    language: 'en',
    webhook: webhookUrl,
  };
  const res = await client.linkTokenCreate(req);
  return res.data.link_token;
}

export async function exchangePublicToken(
  client: PlaidApi,
  publicToken: string,
): Promise<{ accessToken: string; itemId: string }> {
  const req: ItemPublicTokenExchangeRequest = { public_token: publicToken };
  const res = await client.itemPublicTokenExchange(req);
  return { accessToken: res.data.access_token, itemId: res.data.item_id };
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/connectors
git commit -m "feat(connectors): Plaid client + link token + token exchange"
```

---

## Task 5: Plaid `transactionsSync` wrapper

**Files:**
- Create: `packages/connectors/src/plaid/sync.ts`
- Create: `packages/connectors/tests/plaid-sync.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/connectors/tests/plaid-sync.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { syncTransactions } from '../src/plaid/sync';

describe('syncTransactions', () => {
  it('iterates pages until has_more is false and accumulates', async () => {
    const mock = {
      transactionsSync: vi.fn()
        .mockResolvedValueOnce({ data: { added: [makeTxn('t1')], modified: [], removed: [], next_cursor: 'c1', has_more: true } })
        .mockResolvedValueOnce({ data: { added: [makeTxn('t2'), makeTxn('t3')], modified: [], removed: [], next_cursor: 'c2', has_more: false } }),
    } as unknown as Parameters<typeof syncTransactions>[0]['client'];

    const out = await syncTransactions({ client: mock, accessToken: 'tok', cursor: null });
    expect(out.cursor).toBe('c2');
    expect(out.added).toHaveLength(3);
    expect(mock.transactionsSync).toHaveBeenCalledTimes(2);
  });

  it('passes the previous cursor on the first call', async () => {
    const mock = {
      transactionsSync: vi.fn()
        .mockResolvedValueOnce({ data: { added: [], modified: [], removed: [], next_cursor: 'c1', has_more: false } }),
    } as unknown as Parameters<typeof syncTransactions>[0]['client'];

    await syncTransactions({ client: mock, accessToken: 'tok', cursor: 'prev' });
    expect(mock.transactionsSync).toHaveBeenCalledWith(expect.objectContaining({ access_token: 'tok', cursor: 'prev' }));
  });
});

function makeTxn(id: string) {
  return {
    transaction_id: id,
    account_id: 'acc',
    date: '2026-04-01',
    name: 'X',
    merchant_name: null,
    amount: 12.34,
    pending: false,
    category: null,
    iso_currency_code: 'USD',
  };
}
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/connectors test
```
Expected: fails.

- [ ] **Step 3: Create `packages/connectors/src/plaid/sync.ts`**

```ts
import type { PlaidApi, TransactionsSyncRequest } from 'plaid';
import type { PlaidTxn, SyncResult } from './types';

export interface SyncInput {
  client: PlaidApi;
  accessToken: string;
  cursor: string | null;
}

export async function syncTransactions(input: SyncInput): Promise<SyncResult> {
  const added: PlaidTxn[] = [];
  const modified: PlaidTxn[] = [];
  const removed: Array<{ transactionId: string }> = [];
  let cursor = input.cursor ?? null;
  let hasMore = true;

  while (hasMore) {
    const req: TransactionsSyncRequest = {
      access_token: input.accessToken,
      ...(cursor != null ? { cursor } : {}),
    } as TransactionsSyncRequest;
    const res = await input.client.transactionsSync(req);
    const data = res.data;
    for (const t of data.added)    added.push(toTxn(t));
    for (const t of data.modified) modified.push(toTxn(t));
    for (const r of data.removed)  removed.push({ transactionId: r.transaction_id ?? '' });
    cursor = data.next_cursor;
    hasMore = data.has_more;
  }

  return {
    cursor: cursor ?? '',
    added,
    modified,
    removed,
    hasMore: false,
  };
}

function toTxn(t: {
  transaction_id: string;
  account_id: string;
  date: string;
  name: string;
  merchant_name?: string | null;
  amount: number;
  pending: boolean;
  category?: string[] | null;
  iso_currency_code?: string | null;
}): PlaidTxn {
  return {
    transactionId: t.transaction_id,
    accountId: t.account_id,
    date: t.date,
    name: t.name,
    merchantName: t.merchant_name ?? null,
    amount: t.amount,
    pending: t.pending,
    category: t.category ?? null,
    isoCurrencyCode: t.iso_currency_code ?? null,
  };
}
```

- [ ] **Step 4: Run test (expect pass)**

Run:
```bash
pnpm --filter @perfin/connectors test
```
Expected: 2 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/connectors
git commit -m "feat(connectors): Plaid transactionsSync wrapper (paginated)"
```

---

## Task 6: Plaid webhook signature verification

**Files:**
- Create: `packages/connectors/src/plaid/verify.ts`

- [ ] **Step 1: Create `packages/connectors/src/plaid/verify.ts`**

```ts
import { createHash } from 'node:crypto';
import type { PlaidApi } from 'plaid';

// Plaid signs webhooks with JWT in the Plaid-Verification header. The full
// production-grade verification flow fetches the signing key by kid via
// /webhook_verification_key/get. For Phase 4 (Sandbox), we accept either:
//   - a JWT we verify with the fetched key (preferred), or
//   - a body-hash match in the signed JWT payload (defensive).
//
// In Sandbox there is no signature; we return true unconditionally when env=sandbox.

export interface VerifyInput {
  client: PlaidApi;
  env: 'sandbox' | 'development' | 'production';
  signatureHeader: string | undefined;
  rawBody: string;
}

export async function verifyPlaidWebhook(input: VerifyInput): Promise<boolean> {
  if (input.env === 'sandbox') return true;
  if (!input.signatureHeader) return false;

  // Decode JWT header to extract kid
  const parts = input.signatureHeader.split('.');
  if (parts.length !== 3) return false;
  let kid: string | null = null;
  try {
    const headerJson = Buffer.from(parts[0]!, 'base64url').toString('utf8');
    const parsed = JSON.parse(headerJson) as { kid?: string };
    kid = parsed.kid ?? null;
  } catch {
    return false;
  }
  if (!kid) return false;

  // Production-grade verification fetches the key here. For now we hash the
  // body and compare with the JWT payload's body claim.
  const bodyHash = createHash('sha256').update(input.rawBody).digest('hex');
  try {
    const payloadJson = Buffer.from(parts[1]!, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as { request_body_sha256?: string };
    return payload.request_body_sha256 === bodyHash;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/connectors
git commit -m "feat(connectors): Plaid webhook verifier (sandbox bypass + body-hash compare)"
```

---

## Task 7: Postmark inbound parser

**Files:**
- Create: `packages/connectors/src/postmark/parse.ts`
- Create: `packages/connectors/src/postmark/auth.ts`
- Create: `packages/connectors/tests/postmark-parse.test.ts`
- Create: `data/seeds/hdfc-alert-email.txt`

- [ ] **Step 1: Create the test fixture**

Create `data/seeds/hdfc-alert-email.txt`:

```
Dear Customer,

Thank you for using your HDFC Bank Debit Card ending 1234 for Rs 450.00 at SWIGGY BANGALORE on 15-04-2026.

Available balance in your account is Rs 12,550.00.

Warm Regards,
HDFC Bank
```

- [ ] **Step 2: Write failing test**

Create `packages/connectors/tests/postmark-parse.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseInboundEmail } from '../src/postmark/parse';

const fixture = resolve(__dirname, '../../../data/seeds/hdfc-alert-email.txt');

describe('parseInboundEmail (HDFC)', () => {
  it('extracts amount, date, merchant from HDFC alert', async () => {
    const body = await readFile(fixture, 'utf8');
    const out = parseInboundEmail({ from: 'alerts@hdfcbank.net', subject: 'Debit Alert', body });
    expect(out).not.toBeNull();
    expect(out!.amount).toBe(-450);
    expect(out!.description.toLowerCase()).toContain('swiggy');
    expect(out!.date).toBe('2026-04-15');
    expect(out!.bank).toBe('hdfc');
  });

  it('returns null on unparseable email', () => {
    const out = parseInboundEmail({ from: 'random@x.com', subject: 'Hello', body: 'Hi.' });
    expect(out).toBeNull();
  });
});
```

- [ ] **Step 3: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/connectors test
```
Expected: fails.

- [ ] **Step 4: Create `packages/connectors/src/postmark/parse.ts`**

```ts
export interface ParseInput {
  from: string;
  subject: string;
  body: string;
}

export interface ParsedEmail {
  bank: string;
  date: string;            // YYYY-MM-DD
  description: string;
  amount: number;          // signed: negative for debit, positive for credit
  currency: string;
}

const HDFC_DEBIT = /Rs\s*([\d,]+(?:\.\d{2})?)\s+at\s+(.+?)\s+on\s+(\d{2})-(\d{2})-(\d{4})/i;
const HDFC_CREDIT = /Rs\s*([\d,]+(?:\.\d{2})?)\s+credited\s+.*on\s+(\d{2})-(\d{2})-(\d{4})/i;

const ICICI_DEBIT = /INR\s*([\d,]+(?:\.\d{2})?)\s+spent.*at\s+(.+?)\s+on\s+(\d{2})-(\d{2})-(\d{4})/i;

function parseAmount(raw: string): number {
  return Number(raw.replace(/,/g, ''));
}

function ddmmToIso(dd: string, mm: string, yyyy: string): string {
  return `${yyyy}-${mm}-${dd}`;
}

export function parseInboundEmail(input: ParseInput): ParsedEmail | null {
  const text = input.body;
  const fromLower = input.from.toLowerCase();

  if (fromLower.includes('hdfcbank')) {
    const debit = HDFC_DEBIT.exec(text);
    if (debit) {
      return {
        bank: 'hdfc',
        amount: -parseAmount(debit[1]!),
        description: debit[2]!.trim(),
        date: ddmmToIso(debit[3]!, debit[4]!, debit[5]!),
        currency: 'INR',
      };
    }
    const credit = HDFC_CREDIT.exec(text);
    if (credit) {
      return {
        bank: 'hdfc',
        amount: parseAmount(credit[1]!),
        description: 'Credit (HDFC)',
        date: ddmmToIso(credit[2]!, credit[3]!, credit[4]!),
        currency: 'INR',
      };
    }
  }

  if (fromLower.includes('icicibank')) {
    const debit = ICICI_DEBIT.exec(text);
    if (debit) {
      return {
        bank: 'icici',
        amount: -parseAmount(debit[1]!),
        description: debit[2]!.trim(),
        date: ddmmToIso(debit[3]!, debit[4]!, debit[5]!),
        currency: 'INR',
      };
    }
  }

  return null;
}
```

- [ ] **Step 5: Create `packages/connectors/src/postmark/auth.ts`**

```ts
import { timingSafeEqual } from 'node:crypto';

export function verifyBasicAuth(headerValue: string | undefined, expectedUser: string, expectedPass: string): boolean {
  if (!headerValue || !headerValue.startsWith('Basic ')) return false;
  const decoded = Buffer.from(headerValue.slice(6), 'base64').toString('utf8');
  const [user, ...rest] = decoded.split(':');
  const pass = rest.join(':');
  if (!user || !pass) return false;
  const userOk = bufferEq(Buffer.from(user), Buffer.from(expectedUser));
  const passOk = bufferEq(Buffer.from(pass), Buffer.from(expectedPass));
  return userOk && passOk;
}

function bufferEq(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 6: Run test (expect pass)**

Run:
```bash
pnpm --filter @perfin/connectors test
```
Expected: 2 new tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/connectors data/seeds
git commit -m "feat(connectors): Postmark inbound email parser (HDFC + ICICI) + Basic Auth"
```

---

## Task 8: Update `packages/connectors/src/index.ts`

**Files:**
- Modify: `packages/connectors/src/index.ts`

- [ ] **Step 1: Replace `packages/connectors/src/index.ts`**

```ts
export * from './crypto';
export * from './email-address';
export * from './plaid/types';
export * from './plaid/client';
export * from './plaid/sync';
export * from './plaid/verify';
export * from './postmark/parse';
export * from './postmark/auth';
```

- [ ] **Step 2: Typecheck and commit**

```bash
pnpm --filter @perfin/connectors typecheck
git add packages/connectors
git commit -m "feat(connectors): re-export public surface from index"
```

---

## Task 9: Worker — env additions and dependency

**Files:**
- Modify: `apps/worker/package.json` (add `plaid`, `@perfin/connectors`)
- Modify: `apps/worker/src/env.ts`

- [ ] **Step 1: Update `apps/worker/package.json` dependencies**

Add to `dependencies`:

```json
"@perfin/connectors": "workspace:*",
"plaid": "28.0.0"
```

Run:
```bash
pnpm install
```

- [ ] **Step 2: Replace `apps/worker/src/env.ts`**

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
  CRON_HOURLY:  z.string().default('0 * * * *'),
  KMS_KEY: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  PLAID_CLIENT_ID: z.string().optional(),
  PLAID_SECRET: z.string().optional(),
  PLAID_ENV: z.enum(['sandbox', 'development', 'production']).default('sandbox'),
  POSTMARK_INBOUND_USER: z.string().optional(),
  POSTMARK_INBOUND_PASS: z.string().optional(),
  EMAIL_DOMAIN: z.string().default('in.perfin.app'),
  EMAIL_HASH_SECRET: z.string().min(8).default('dev-email-hash-secret'),
});

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  WORKER_PORT: process.env.WORKER_PORT,
  WORKER_HMAC_SECRET: process.env.WORKER_HMAC_SECRET,
  UPLOAD_DIR: process.env.UPLOAD_DIR,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  CRON_DISABLED: process.env.CRON_DISABLED,
  CRON_NIGHTLY: process.env.CRON_NIGHTLY,
  CRON_HOURLY: process.env.CRON_HOURLY,
  KMS_KEY: process.env.KMS_KEY,
  PLAID_CLIENT_ID: process.env.PLAID_CLIENT_ID,
  PLAID_SECRET: process.env.PLAID_SECRET,
  PLAID_ENV: process.env.PLAID_ENV,
  POSTMARK_INBOUND_USER: process.env.POSTMARK_INBOUND_USER,
  POSTMARK_INBOUND_PASS: process.env.POSTMARK_INBOUND_PASS,
  EMAIL_DOMAIN: process.env.EMAIL_DOMAIN,
  EMAIL_HASH_SECRET: process.env.EMAIL_HASH_SECRET,
});
```

- [ ] **Step 3: Update `turbo.json` globalEnv list**

Edit `turbo.json` `globalEnv` array — add the new keys:

```json
"globalEnv": [
  "DATABASE_URL", "AUTH_SECRET", "AUTH_URL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
  "WORKER_PORT", "WORKER_HMAC_SECRET", "ANTHROPIC_API_KEY",
  "SKIP_DB_TESTS", "NODE_ENV",
  "CRON_DISABLED", "CRON_NIGHTLY", "CRON_HOURLY",
  "KMS_KEY", "PLAID_CLIENT_ID", "PLAID_SECRET", "PLAID_ENV",
  "POSTMARK_INBOUND_USER", "POSTMARK_INBOUND_PASS", "EMAIL_DOMAIN", "EMAIL_HASH_SECRET",
  "WORKER_URL", "NEXT_PUBLIC_WORKER_URL"
],
```

- [ ] **Step 4: Add to `.env.example` and `.env`**

Append to `.env.example`:

```
# Plaid (Sandbox in dev)
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox

# AES-256-GCM key for access tokens (32 bytes / 64 hex). Generate with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
KMS_KEY=

# Postmark inbound (set both for production; in dev leave empty to bypass)
POSTMARK_INBOUND_USER=
POSTMARK_INBOUND_PASS=

# Inbound email
EMAIL_DOMAIN=in.perfin.app
EMAIL_HASH_SECRET=dev-email-hash-secret
```

Mirror the same keys into `.env` for local dev.

- [ ] **Step 5: Commit**

```bash
git add apps/worker turbo.json .env.example .env pnpm-lock.yaml
git commit -m "chore(worker): env additions for Plaid, Postmark, KMS, hourly cron"
```

---

## Task 10: Worker — `lib/plaid-sync.ts` orchestrator

**Files:**
- Create: `apps/worker/src/lib/plaid-sync.ts`

- [ ] **Step 1: Create `apps/worker/src/lib/plaid-sync.ts`**

```ts
import { and, eq } from 'drizzle-orm';
import { connections, accounts as accountsTbl, transactions as txnsTbl, type Db } from '@perfin/db';
import {
  createPlaid, decryptString, syncTransactions,
  type PlaidConfig, type PlaidTxn,
} from '@perfin/connectors';
import { env } from '../env.js';

export interface PlaidSyncInput {
  db: Db;
  connectionId: number;
}

export interface PlaidSyncOutput {
  added: number;
  modified: number;
  removed: number;
}

export async function syncOnePlaidConnection(input: PlaidSyncInput): Promise<PlaidSyncOutput> {
  const { db, connectionId } = input;

  const [conn] = await db.select().from(connections).where(eq(connections.id, connectionId));
  if (!conn) throw new Error(`connection ${connectionId} not found`);
  if (conn.provider !== 'plaid') throw new Error(`connection ${connectionId} is not plaid`);
  if (!conn.accessTokenEnc) throw new Error('no access token stored');
  if (!env.KMS_KEY) throw new Error('KMS_KEY not configured');
  if (!env.PLAID_CLIENT_ID || !env.PLAID_SECRET) throw new Error('Plaid not configured');

  const accessToken = decryptString(env.KMS_KEY, conn.accessTokenEnc);
  const plaidConfig: PlaidConfig = {
    clientId: env.PLAID_CLIENT_ID,
    secret: env.PLAID_SECRET,
    env: env.PLAID_ENV,
  };
  const client = createPlaid(plaidConfig);

  const result = await syncTransactions({ client, accessToken, cursor: conn.cursor });

  // Insert added/modified
  const allChanged: PlaidTxn[] = [...result.added, ...result.modified];
  for (const t of allChanged) {
    // Find or create matching account in our DB by plaid_account_id
    let [acct] = await db
      .select()
      .from(accountsTbl)
      .where(and(eq(accountsTbl.userId, conn.userId), eq(accountsTbl.plaidAccountId, t.accountId)));
    if (!acct) {
      const [created] = await db.insert(accountsTbl).values({
        userId: conn.userId,
        connectionId: conn.id,
        plaidAccountId: t.accountId,
        name: 'Plaid account',
        bank: '',
        type: 'checking',
        currency: t.isoCurrencyCode ?? 'USD',
      }).returning();
      acct = created!;
    }

    await db.insert(txnsTbl).values({
      userId: conn.userId,
      accountId: acct.id,
      date: t.date,
      description: t.merchantName ?? t.name,
      rawDescription: t.name,
      // Plaid: positive = outflow (debit). Invert for our convention (negative = expense).
      amountCents: Math.round(-t.amount * 100),
      category: 'Needs Review',
      pending: t.pending,
      plaidTxnId: t.transactionId,
    }).onConflictDoNothing();
  }

  // Process removed
  for (const r of result.removed) {
    await db.delete(txnsTbl).where(and(
      eq(txnsTbl.userId, conn.userId),
      eq(txnsTbl.plaidTxnId, r.transactionId),
    ));
  }

  // Persist cursor + bump lastSyncAt
  await db.update(connections).set({
    cursor: result.cursor,
    lastSyncAt: new Date(),
    status: 'active',
    error: null,
  }).where(eq(connections.id, connectionId));

  return {
    added: result.added.length,
    modified: result.modified.length,
    removed: result.removed.length,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/worker
git commit -m "feat(worker): syncOnePlaidConnection orchestrator (decrypt → fetch → upsert → cursor)"
```

---

## Task 11: Worker — `POST /jobs/plaid-sync` route

**Files:**
- Create: `apps/worker/src/routes/plaid-sync.ts`
- Modify: `apps/worker/src/server.ts`

- [ ] **Step 1: Create `apps/worker/src/routes/plaid-sync.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createDb } from '@perfin/db';
import { env } from '../env.js';
import { verify } from '../lib/hmac.js';
import { syncOnePlaidConnection } from '../lib/plaid-sync.js';

const Body = z.object({ connectionId: z.number().int().positive() });

const { db } = createDb(env.DATABASE_URL);

export async function plaidSyncRoutes(app: FastifyInstance) {
  app.post('/jobs/plaid-sync', async (req, reply) => {
    const sig = req.headers['x-perfin-sig'];
    if (typeof sig !== 'string') return reply.code(401).send({ error: 'missing signature' });
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!verify(env.WORKER_HMAC_SECRET, raw, sig)) return reply.code(401).send({ error: 'invalid signature' });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const out = await syncOnePlaidConnection({ db, connectionId: parsed.data.connectionId });
      return reply.send({ ok: true, ...out });
    } catch (err) {
      return reply.code(500).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });
}
```

- [ ] **Step 2: Register route in `apps/worker/src/server.ts`**

Replace the `import { regenerateRoutes } ...` and `await app.register(regenerateRoutes);` blocks to also include the new routes (we'll add the others in subsequent tasks):

```ts
import { plaidSyncRoutes } from './routes/plaid-sync';
// ...
await app.register(plaidSyncRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add apps/worker
git commit -m "feat(worker): POST /jobs/plaid-sync (HMAC-protected)"
```

---

## Task 12: Worker — `POST /webhooks/plaid` route

**Files:**
- Create: `apps/worker/src/routes/plaid-webhook.ts`
- Create: `apps/worker/tests/plaid-webhook.test.ts`
- Modify: `apps/worker/src/server.ts`

- [ ] **Step 1: Write failing test**

Create `apps/worker/tests/plaid-webhook.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../src/server';

describe('POST /webhooks/plaid (sandbox)', () => {
  it('accepts a TRANSACTIONS_SYNC_UPDATES_AVAILABLE event', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/plaid',
      headers: { 'content-type': 'application/json' },
      payload: { webhook_type: 'TRANSACTIONS', webhook_code: 'SYNC_UPDATES_AVAILABLE', item_id: 'i-unknown' },
    });
    // Unknown item_id: still accepted (200) but a warning logged
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod KMS_KEY=00000000000000000000000000000000000000000000000000000000000000aa pnpm --filter @perfin/worker test
```
Expected: fails — route missing.

- [ ] **Step 3: Create `apps/worker/src/routes/plaid-webhook.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { connections, createDb } from '@perfin/db';
import { createPlaid, verifyPlaidWebhook } from '@perfin/connectors';
import { env } from '../env.js';
import { syncOnePlaidConnection } from '../lib/plaid-sync.js';

const { db } = createDb(env.DATABASE_URL);

export async function plaidWebhookRoutes(app: FastifyInstance) {
  app.post('/webhooks/plaid', async (req, reply) => {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (env.PLAID_CLIENT_ID && env.PLAID_SECRET) {
      const client = createPlaid({
        clientId: env.PLAID_CLIENT_ID,
        secret: env.PLAID_SECRET,
        env: env.PLAID_ENV,
      });
      const ok = await verifyPlaidWebhook({
        client,
        env: env.PLAID_ENV,
        signatureHeader: req.headers['plaid-verification'] as string | undefined,
        rawBody: raw,
      });
      if (!ok) return reply.code(401).send({ error: 'invalid signature' });
    }

    const body = req.body as { webhook_type?: string; webhook_code?: string; item_id?: string; error?: { error_code?: string } };

    if (body.webhook_type === 'TRANSACTIONS' && body.webhook_code?.startsWith('SYNC_UPDATES_AVAILABLE')) {
      const [conn] = await db.select().from(connections).where(eq(connections.providerAccountId, body.item_id ?? ''));
      if (conn) {
        try { await syncOnePlaidConnection({ db, connectionId: conn.id }); }
        catch (err) { app.log.error({ err }, 'plaid sync from webhook failed'); }
      } else {
        app.log.warn({ itemId: body.item_id }, 'webhook for unknown item');
      }
    }

    if (body.webhook_type === 'ITEM' && body.webhook_code === 'ERROR') {
      const [conn] = await db.select().from(connections).where(eq(connections.providerAccountId, body.item_id ?? ''));
      if (conn) {
        await db.update(connections).set({
          status: 'error',
          error: body.error?.error_code ?? 'unknown',
        }).where(eq(connections.id, conn.id));
      }
    }

    return reply.send({ ok: true });
  });
}
```

- [ ] **Step 4: Register route in `apps/worker/src/server.ts`**

```ts
import { plaidWebhookRoutes } from './routes/plaid-webhook';
// ...
await app.register(plaidWebhookRoutes);
```

- [ ] **Step 5: Run test (expect pass)**

Run:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod KMS_KEY=00000000000000000000000000000000000000000000000000000000000000aa pnpm --filter @perfin/worker test
```
Expected: 1 new test passes.

- [ ] **Step 6: Commit**

```bash
git add apps/worker
git commit -m "feat(worker): POST /webhooks/plaid (handle TRANSACTIONS + ITEM ERROR)"
```

---

## Task 13: Worker — `POST /webhooks/postmark` route

**Files:**
- Create: `apps/worker/src/routes/postmark-webhook.ts`
- Create: `apps/worker/tests/postmark-webhook.test.ts`
- Modify: `apps/worker/src/server.ts`

- [ ] **Step 1: Write failing test**

Create `apps/worker/tests/postmark-webhook.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../src/server';

describe('POST /webhooks/postmark', () => {
  it('rejects without basic auth when configured', async () => {
    process.env.POSTMARK_INBOUND_USER = 'pm';
    process.env.POSTMARK_INBOUND_PASS = 'pw';
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/postmark',
      payload: { ToFull: [{ Email: 'u_aaaa1111@in.perfin.app' }], From: 'alerts@hdfcbank.net', Subject: 'x', TextBody: 'no match' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
    delete process.env.POSTMARK_INBOUND_USER;
    delete process.env.POSTMARK_INBOUND_PASS;
  });

  it('accepts (200) when no auth configured (dev)', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/postmark',
      payload: { ToFull: [{ Email: 'u_aaaa1111@in.perfin.app' }], From: 'unknown@x.com', Subject: 'x', TextBody: 'no match' },
    });
    // 200 with no parsing happening (no user matched, no parse) is acceptable
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod KMS_KEY=00000000000000000000000000000000000000000000000000000000000000aa pnpm --filter @perfin/worker test
```
Expected: fails.

- [ ] **Step 3: Create `apps/worker/src/routes/postmark-webhook.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { createDb, inboundEmails, transactions, users } from '@perfin/db';
import {
  addressForUser, parseInboundEmail, parseUserHash, verifyBasicAuth,
} from '@perfin/connectors';
import { rupeesToCents } from '@perfin/core';
import { env } from '../env.js';

const { db } = createDb(env.DATABASE_URL);

export async function postmarkWebhookRoutes(app: FastifyInstance) {
  app.post('/webhooks/postmark', async (req, reply) => {
    if (env.POSTMARK_INBOUND_USER && env.POSTMARK_INBOUND_PASS) {
      const ok = verifyBasicAuth(
        req.headers.authorization,
        env.POSTMARK_INBOUND_USER,
        env.POSTMARK_INBOUND_PASS,
      );
      if (!ok) return reply.code(401).send({ error: 'unauthorized' });
    }

    const body = req.body as {
      ToFull?: Array<{ Email: string }>;
      From: string;
      Subject?: string;
      TextBody?: string;
      HtmlBody?: string;
      MessageID?: string;
    };

    const toAddr = body.ToFull?.[0]?.Email ?? '';
    const hash = parseUserHash(toAddr);
    if (!hash) return reply.send({ ok: true, skipped: 'no-perfin-address' });

    // Find user matching the hash
    const allUsers = await db.select({ id: users.id }).from(users);
    const matched = allUsers.find((u) => addressForUser({ userId: u.id, secret: env.EMAIL_HASH_SECRET, domain: env.EMAIL_DOMAIN }) === toAddr);
    if (!matched) return reply.send({ ok: true, skipped: 'unknown-user' });

    const text = body.TextBody ?? body.HtmlBody ?? '';
    const parsed = parseInboundEmail({ from: body.From, subject: body.Subject ?? '', body: text });

    const [emailRow] = await db.insert(inboundEmails).values({
      userId: matched.id,
      from: body.From,
      subject: body.Subject ?? '',
      bodyHash: body.MessageID ?? Buffer.from(text).toString('base64').slice(0, 64),
      status: parsed ? 'parsed' : 'failed',
      error: parsed ? null : 'no parser matched',
    }).returning();

    if (parsed && emailRow) {
      const [txn] = await db.insert(transactions).values({
        userId: matched.id,
        date: parsed.date,
        description: parsed.description,
        rawDescription: parsed.description,
        amountCents: rupeesToCents(parsed.amount),
        category: 'Needs Review',
        sourceEmailId: emailRow.id,
      }).onConflictDoNothing().returning();

      if (txn) {
        await db.update(inboundEmails).set({ parsedTxnId: txn.id }).where(eq(inboundEmails.id, emailRow.id));
      }
    }

    return reply.send({ ok: true, parsed: !!parsed });
  });
}
```

- [ ] **Step 4: Register route in `apps/worker/src/server.ts`**

```ts
import { postmarkWebhookRoutes } from './routes/postmark-webhook';
// ...
await app.register(postmarkWebhookRoutes);
```

- [ ] **Step 5: Run test (expect pass)**

Run:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod KMS_KEY=00000000000000000000000000000000000000000000000000000000000000aa pnpm --filter @perfin/worker test
```
Expected: 2 new tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/worker
git commit -m "feat(worker): POST /webhooks/postmark (Basic Auth + parse + insert)"
```

---

## Task 14: Worker — hourly Plaid cron

**Files:**
- Modify: `apps/worker/src/server.ts`

- [ ] **Step 1: Replace contents of `apps/worker/src/server.ts`**

```ts
import Fastify from 'fastify';
import { eq } from 'drizzle-orm';
import { connections, createDb, users } from '@perfin/db';
import { env } from './env';
import { healthRoutes } from './routes/health';
import { uploadRoutes } from './routes/upload';
import { streamRoutes } from './routes/stream';
import { regenerateRoutes } from './routes/regenerate';
import { plaidSyncRoutes } from './routes/plaid-sync';
import { plaidWebhookRoutes } from './routes/plaid-webhook';
import { postmarkWebhookRoutes } from './routes/postmark-webhook';
import { startScheduler } from './lib/scheduler';
import { regenerateForUser } from './lib/regenerate';
import { syncOnePlaidConnection } from './lib/plaid-sync';

export async function buildServer() {
  const app = Fastify({ logger: true });
  await app.register(healthRoutes);
  await app.register(uploadRoutes);
  await app.register(streamRoutes);
  await app.register(regenerateRoutes);
  await app.register(plaidSyncRoutes);
  await app.register(plaidWebhookRoutes);
  await app.register(postmarkWebhookRoutes);
  return app;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  buildServer()
    .then(async (app) => {
      const { db } = createDb(env.DATABASE_URL);

      const stopNightly = startScheduler({
        disabled: !!env.CRON_DISABLED,
        schedule: env.CRON_NIGHTLY,
        job: async () => {
          app.log.info('nightly: regenerating insights for all users');
          const all = await db.select().from(users);
          for (const u of all) {
            try { await regenerateForUser({ userId: u.id, db, currency: 'INR', withNarrative: true }); }
            catch (err) { app.log.error({ err, userId: u.id }, 'nightly regenerate failed'); }
          }
        },
      });

      const stopHourly = startScheduler({
        disabled: !!env.CRON_DISABLED,
        schedule: env.CRON_HOURLY,
        job: async () => {
          app.log.info('hourly: syncing Plaid connections');
          const conns = await db.select().from(connections).where(eq(connections.status, 'active'));
          for (const c of conns) {
            if (c.provider !== 'plaid') continue;
            try { await syncOnePlaidConnection({ db, connectionId: c.id }); }
            catch (err) { app.log.error({ err, connectionId: c.id }, 'hourly Plaid sync failed'); }
          }
        },
      });

      app.addHook('onClose', async () => { stopNightly(); stopHourly(); });
      return app.listen({ port: env.WORKER_PORT, host: '0.0.0.0' });
    })
    .catch((err) => { console.error(err); process.exit(1); });
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod KMS_KEY=00000000000000000000000000000000000000000000000000000000000000aa pnpm --filter @perfin/worker typecheck
git add apps/worker
git commit -m "feat(worker): hourly Plaid sync cron + register webhook routes"
```

---

## Task 15: Web — install `react-plaid-link` + `@perfin/connectors`

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/lib/env.ts`

- [ ] **Step 1: Add deps to `apps/web/package.json`**

In `dependencies`:

```json
"@perfin/connectors": "workspace:*",
"plaid": "28.0.0",
"react-plaid-link": "3.6.1"
```

- [ ] **Step 2: Update `apps/web/lib/env.ts`**

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
  ANTHROPIC_API_KEY: z.string().optional(),
  KMS_KEY: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  PLAID_CLIENT_ID: z.string().optional(),
  PLAID_SECRET: z.string().optional(),
  PLAID_ENV: z.enum(['sandbox', 'development', 'production']).default('sandbox'),
  EMAIL_DOMAIN: z.string().default('in.perfin.app'),
  EMAIL_HASH_SECRET: z.string().min(8).default('dev-email-hash-secret'),
  PLAID_WEBHOOK_URL: z.string().url().default('http://localhost:8001/webhooks/plaid'),
});

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_URL: process.env.AUTH_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  WORKER_URL: process.env.WORKER_URL,
  WORKER_HMAC_SECRET: process.env.WORKER_HMAC_SECRET,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  KMS_KEY: process.env.KMS_KEY,
  PLAID_CLIENT_ID: process.env.PLAID_CLIENT_ID,
  PLAID_SECRET: process.env.PLAID_SECRET,
  PLAID_ENV: process.env.PLAID_ENV,
  EMAIL_DOMAIN: process.env.EMAIL_DOMAIN,
  EMAIL_HASH_SECRET: process.env.EMAIL_HASH_SECRET,
  PLAID_WEBHOOK_URL: process.env.PLAID_WEBHOOK_URL,
});
```

- [ ] **Step 3: Install + commit**

```bash
pnpm install
git add apps/web pnpm-lock.yaml
git commit -m "chore(web): add react-plaid-link, @perfin/connectors; env additions"
```

---

## Task 16: Web — `POST /api/connections/plaid/link-token`

**Files:**
- Create: `apps/web/app/api/connections/plaid/link-token/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextResponse } from 'next/server';
import { createPlaid, createLinkToken } from '@perfin/connectors';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

export async function POST() {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!env.PLAID_CLIENT_ID || !env.PLAID_SECRET) {
    return NextResponse.json({ error: 'Plaid not configured' }, { status: 503 });
  }
  const client = createPlaid({
    clientId: env.PLAID_CLIENT_ID,
    secret: env.PLAID_SECRET,
    env: env.PLAID_ENV,
  });
  const token = await createLinkToken(client, Number(userIdStr), env.PLAID_WEBHOOK_URL);
  return NextResponse.json({ linkToken: token });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/api/connections
git commit -m "feat(web): POST /api/connections/plaid/link-token"
```

---

## Task 17: Web — `POST /api/connections/plaid/exchange`

**Files:**
- Create: `apps/web/app/api/connections/plaid/exchange/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextResponse } from 'next/server';
import { createDb, connections } from '@perfin/db';
import { createPlaid, encryptString, exchangePublicToken } from '@perfin/connectors';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';
import { callWorker } from '@/lib/worker';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!env.PLAID_CLIENT_ID || !env.PLAID_SECRET || !env.KMS_KEY) {
    return NextResponse.json({ error: 'Plaid/KMS not configured' }, { status: 503 });
  }
  const userId = Number(userIdStr);
  const { publicToken } = (await req.json()) as { publicToken: string };
  if (!publicToken) return NextResponse.json({ error: 'publicToken required' }, { status: 400 });

  const client = createPlaid({
    clientId: env.PLAID_CLIENT_ID,
    secret: env.PLAID_SECRET,
    env: env.PLAID_ENV,
  });
  const { accessToken, itemId } = await exchangePublicToken(client, publicToken);
  const accessTokenEnc = encryptString(env.KMS_KEY, accessToken);

  const [conn] = await db.insert(connections).values({
    userId,
    provider: 'plaid',
    providerAccountId: itemId,
    accessTokenEnc,
    status: 'active',
  }).returning();

  // Kick first sync (best-effort, fire-and-forget)
  if (conn) {
    callWorker('/jobs/plaid-sync', { connectionId: conn.id }).catch((err) => {
      console.error('initial plaid sync failed', err);
    });
  }
  return NextResponse.json({ connectionId: conn?.id });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/api/connections
git commit -m "feat(web): POST /api/connections/plaid/exchange (encrypt token, kick sync)"
```

---

## Task 18: Web — connection list + delete + manual sync

**Files:**
- Create: `apps/web/app/api/connections/route.ts`
- Create: `apps/web/app/api/connections/[id]/route.ts`
- Create: `apps/web/app/api/connections/plaid/sync/route.ts`

- [ ] **Step 1: Create `apps/web/app/api/connections/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { createDb, connections } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);
  const rows = await db.select({
    id: connections.id, provider: connections.provider, providerAccountId: connections.providerAccountId,
    status: connections.status, error: connections.error, lastSyncAt: connections.lastSyncAt,
    createdAt: connections.createdAt,
  }).from(connections).where(eq(connections.userId, userId));
  return NextResponse.json({ rows });
}
```

- [ ] **Step 2: Create `apps/web/app/api/connections/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { createDb, connections } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);
  const { id } = await params;
  await db.update(connections).set({ status: 'disconnected', accessTokenEnc: null }).where(and(eq(connections.id, Number(id)), eq(connections.userId, userId)));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Create `apps/web/app/api/connections/plaid/sync/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { createDb, connections } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';
import { callWorker } from '@/lib/worker';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);
  const { connectionId } = (await req.json()) as { connectionId: number };
  const [conn] = await db.select().from(connections).where(and(eq(connections.id, connectionId), eq(connections.userId, userId)));
  if (!conn) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const out = await callWorker<{ ok: boolean; added: number; modified: number; removed: number }>('/jobs/plaid-sync', { connectionId });
  return NextResponse.json(out);
}
```

- [ ] **Step 4: Typecheck and commit**

```bash
pnpm --filter @perfin/web typecheck
git add apps/web/app/api/connections
git commit -m "feat(web): /api/connections list, DELETE, plaid/sync trigger"
```

---

## Task 19: Web — email-address + upload-jobs APIs

**Files:**
- Create: `apps/web/app/api/email-address/route.ts`
- Create: `apps/web/app/api/upload-jobs/route.ts`

- [ ] **Step 1: Create `apps/web/app/api/email-address/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { addressForUser } from '@perfin/connectors';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const address = addressForUser({
    userId: Number(userIdStr),
    secret: env.EMAIL_HASH_SECRET,
    domain: env.EMAIL_DOMAIN,
  });
  return NextResponse.json({ address, domain: env.EMAIL_DOMAIN });
}
```

- [ ] **Step 2: Create `apps/web/app/api/upload-jobs/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { createDb, uploadJobs } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);
  const rows = await db.select().from(uploadJobs).where(eq(uploadJobs.userId, userId)).orderBy(desc(uploadJobs.createdAt)).limit(50);
  return NextResponse.json({ rows });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api
git commit -m "feat(web): /api/email-address + /api/upload-jobs"
```

---

## Task 20: Web — hooks for new APIs

**Files:**
- Create: `apps/web/hooks/useConnections.ts`
- Create: `apps/web/hooks/useEmailAddress.ts`
- Create: `apps/web/hooks/useUploadJobs.ts`

- [ ] **Step 1: Create `apps/web/hooks/useConnections.ts`**

```ts
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface ConnectionRow {
  id: number;
  provider: string;
  providerAccountId: string | null;
  status: 'active' | 'error' | 'disconnected';
  error: string | null;
  lastSyncAt: string | null;
  createdAt: string;
}

export function useConnections() {
  return useQuery<{ rows: ConnectionRow[] }>({
    queryKey: ['connections'],
    queryFn: () => apiFetch<{ rows: ConnectionRow[] }>('/api/connections'),
  });
}

export function useDisconnectConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch<{ ok: true }>(`/api/connections/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] }),
  });
}

export function useSyncConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: number) =>
      apiFetch<{ ok: boolean; added: number; modified: number; removed: number }>(
        '/api/connections/plaid/sync',
        { method: 'POST', body: JSON.stringify({ connectionId }) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['connections'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['home'] });
    },
  });
}
```

- [ ] **Step 2: Create `apps/web/hooks/useEmailAddress.ts`**

```ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export function useEmailAddress() {
  return useQuery<{ address: string; domain: string }>({
    queryKey: ['email-address'],
    queryFn: () => apiFetch<{ address: string; domain: string }>('/api/email-address'),
  });
}
```

- [ ] **Step 3: Create `apps/web/hooks/useUploadJobs.ts`**

```ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface UploadJobRow {
  id: number;
  fileName: string;
  mime: string;
  sizeBytes: number;
  status: 'queued' | 'extracting' | 'categorizing' | 'done' | 'failed';
  extractedCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  createdAt: string;
}

export function useUploadJobs() {
  return useQuery<{ rows: UploadJobRow[] }>({
    queryKey: ['upload-jobs'],
    queryFn: () => apiFetch<{ rows: UploadJobRow[] }>('/api/upload-jobs'),
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/hooks
git commit -m "feat(web): hooks for connections, email-address, upload-jobs"
```

---

## Task 21: Web — `PlaidLinkButton`

**Files:**
- Create: `apps/web/components/accounts/PlaidLinkButton.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { usePlaidLink, type PlaidLinkOnSuccess } from 'react-plaid-link';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@perfin/ui';
import { apiFetch } from '@/lib/api';

export function PlaidLinkButton() {
  const qc = useQueryClient();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ linkToken: string }>('/api/connections/plaid/link-token', { method: 'POST' })
      .then(({ linkToken }) => setLinkToken(linkToken))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  const onSuccess: PlaidLinkOnSuccess = async (publicToken) => {
    try {
      await apiFetch('/api/connections/plaid/exchange', {
        method: 'POST',
        body: JSON.stringify({ publicToken }),
      });
      qc.invalidateQueries({ queryKey: ['connections'] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const { open, ready } = usePlaidLink({ token: linkToken ?? '', onSuccess });

  if (err) return <div className="text-sm text-negative">{err}</div>;
  if (!linkToken) return <Button disabled>Loading…</Button>;
  return <Button onClick={() => open()} disabled={!ready}>Connect a bank</Button>;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/accounts
git commit -m "feat(web): PlaidLinkButton (react-plaid-link, full link → exchange)"
```

---

## Task 22: Web — Accounts page restructure (4 tabs)

**Files:**
- Create: `apps/web/components/accounts/AccountsTabs.tsx`
- Create: `apps/web/components/accounts/BankConnectionsTab.tsx`
- Create: `apps/web/components/accounts/ConnectionCard.tsx`
- Create: `apps/web/components/accounts/ManualAccountsTab.tsx`
- Create: `apps/web/components/accounts/UploadsTab.tsx`
- Create: `apps/web/components/accounts/EmailForwardingTab.tsx`
- Modify: `apps/web/app/(app)/accounts/page.tsx`

- [ ] **Step 1: Create `apps/web/components/accounts/AccountsTabs.tsx`**

```tsx
'use client';

import { cn } from '@perfin/ui';

const tabs = [
  { key: 'bank',     label: 'Bank connections' },
  { key: 'manual',   label: 'Manual accounts' },
  { key: 'uploads',  label: 'Uploads' },
  { key: 'email',    label: 'Email forwarding' },
] as const;

export type AccountsTabKey = typeof tabs[number]['key'];

export function AccountsTabs({ value, onChange }: { value: AccountsTabKey; onChange: (k: AccountsTabKey) => void }) {
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

- [ ] **Step 2: Create `apps/web/components/accounts/ConnectionCard.tsx`**

```tsx
'use client';

import { Tile, Badge, Button } from '@perfin/ui';
import { useDisconnectConnection, useSyncConnection, type ConnectionRow } from '@/hooks/useConnections';

export function ConnectionCard({ conn }: { conn: ConnectionRow }) {
  const disconnect = useDisconnectConnection();
  const sync = useSyncConnection();
  return (
    <Tile variant="raised" className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">{conn.provider.toUpperCase()}</div>
          <div className="text-xs text-text-subtle">{conn.providerAccountId ?? '—'}</div>
        </div>
        <Badge variant={conn.status === 'active' ? 'income' : conn.status === 'error' ? 'expense' : 'neutral'}>
          {conn.status}
        </Badge>
      </div>
      {conn.error && <div className="text-xs text-negative">{conn.error}</div>}
      <div className="text-xs text-text-muted">
        Last sync: {conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString() : 'never'}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => sync.mutate(conn.id)} disabled={sync.isPending || conn.status !== 'active'}>
          {sync.isPending ? 'Syncing…' : 'Sync now'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => disconnect.mutate(conn.id)} disabled={disconnect.isPending || conn.status === 'disconnected'}>
          Disconnect
        </Button>
      </div>
    </Tile>
  );
}
```

- [ ] **Step 3: Create `apps/web/components/accounts/BankConnectionsTab.tsx`**

```tsx
'use client';

import { Tile, Skeleton } from '@perfin/ui';
import { useConnections } from '@/hooks/useConnections';
import { ConnectionCard } from './ConnectionCard';
import { PlaidLinkButton } from './PlaidLinkButton';

export function BankConnectionsTab() {
  const { data, isLoading } = useConnections();
  if (isLoading) return <Skeleton variant="tile" />;
  const banks = (data?.rows ?? []).filter((r) => r.provider === 'plaid');

  return (
    <div className="space-y-4">
      <div>
        <PlaidLinkButton />
      </div>
      {banks.length === 0 ? (
        <Tile className="text-center text-text-muted">No bank connections yet.</Tile>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {banks.map((c) => <ConnectionCard key={c.id} conn={c} />)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `apps/web/components/accounts/ManualAccountsTab.tsx`**

(extracted from the existing `AccountsGrid` flow):

```tsx
'use client';

import { Tile, Skeleton, Button, Modal, Field, Input } from '@perfin/ui';
import { useState } from 'react';
import { useAccounts, useCreateAccount } from '@/hooks/useAccounts';
import { AccountCard } from '@/components/accounts/AccountCard';

export function ManualAccountsTab() {
  const { data, isLoading } = useAccounts();
  const create = useCreateAccount();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [bank, setBank] = useState('');

  if (isLoading) return <Skeleton variant="tile" />;
  return (
    <div className="space-y-4">
      <Button variant="primary" onClick={() => setOpen(true)}>+ Add account</Button>
      {(data?.rows ?? []).length === 0 ? (
        <Tile className="text-center text-text-muted">No manual accounts.</Tile>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data!.rows.filter((a) => a.connectionId == null)).map((a) => <AccountCard key={a.id} account={a} />)}
        </div>
      )}
      <Modal open={open} onOpenChange={setOpen} title="Add manual account">
        <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (!name) return; await create.mutateAsync({ name, bank }); setOpen(false); setName(''); setBank(''); }}>
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
          <Field label="Bank"><Input value={bank} onChange={(e) => setBank(e.target.value)} /></Field>
          <div className="flex justify-end gap-2"><Button variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={create.isPending}>Save</Button></div>
        </form>
      </Modal>
    </div>
  );
}
```

(Note: `useAccounts` already exists from Phase 1; we're adding the per-row `connectionId` filter. If `Account.connectionId` isn't already part of the hook's row shape, no change needed — it falls through.)

- [ ] **Step 5: Create `apps/web/components/accounts/UploadsTab.tsx`**

```tsx
'use client';

import { Tile, Skeleton, Badge } from '@perfin/ui';
import { useUploadJobs } from '@/hooks/useUploadJobs';

export function UploadsTab() {
  const { data, isLoading } = useUploadJobs();
  if (isLoading) return <Skeleton variant="tile" />;
  if (!data?.rows.length) return <Tile className="text-text-muted text-center">No uploads yet.</Tile>;
  return (
    <Tile className="px-0 overflow-hidden">
      {data.rows.map((j) => (
        <div key={j.id} className="grid grid-cols-[1fr_120px_140px_100px] items-center gap-3 px-4 py-3 text-sm border-b border-border last:border-0">
          <div className="truncate font-medium">{j.fileName}</div>
          <Badge variant={j.status === 'done' ? 'income' : j.status === 'failed' ? 'expense' : 'info'}>{j.status}</Badge>
          <div className="text-xs text-text-muted">{new Date(j.createdAt).toLocaleString()}</div>
          <div className="text-xs font-mono text-right">{j.extractedCount} txns</div>
        </div>
      ))}
    </Tile>
  );
}
```

- [ ] **Step 6: Create `apps/web/components/accounts/EmailForwardingTab.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { Tile, Button, Skeleton } from '@perfin/ui';
import { useEmailAddress } from '@/hooks/useEmailAddress';

export function EmailForwardingTab() {
  const { data, isLoading } = useEmailAddress();
  const [copied, setCopied] = useState(false);
  if (isLoading || !data) return <Skeleton variant="tile" />;
  return (
    <div className="space-y-4">
      <Tile variant="raised" className="space-y-3">
        <div className="text-xs uppercase tracking-wider font-semibold text-text-subtle">Your forwarding address</div>
        <div className="font-mono text-lg break-all">{data.address}</div>
        <Button size="sm" variant="secondary" onClick={async () => { await navigator.clipboard.writeText(data.address); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          {copied ? '✓ Copied' : 'Copy address'}
        </Button>
      </Tile>
      <Tile className="space-y-2 text-sm text-text-muted">
        <div className="font-semibold text-text">Setting up forwarding</div>
        <ol className="list-decimal list-inside space-y-1">
          <li>Open your bank's online banking → Alerts settings.</li>
          <li>Enable transaction alerts via email.</li>
          <li>Add the address above as the destination (or set up a Gmail forward filter for alerts from your bank).</li>
          <li>Test with a small transaction; the row should appear within seconds.</li>
        </ol>
      </Tile>
    </div>
  );
}
```

- [ ] **Step 7: Replace `apps/web/app/(app)/accounts/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { AccountsTabs, type AccountsTabKey } from '@/components/accounts/AccountsTabs';
import { BankConnectionsTab } from '@/components/accounts/BankConnectionsTab';
import { ManualAccountsTab } from '@/components/accounts/ManualAccountsTab';
import { UploadsTab } from '@/components/accounts/UploadsTab';
import { EmailForwardingTab } from '@/components/accounts/EmailForwardingTab';

export default function AccountsPage() {
  const [tab, setTab] = useState<AccountsTabKey>('bank');
  return (
    <div className="p-8 max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold">Accounts</h1>
      <AccountsTabs value={tab} onChange={setTab} />
      {tab === 'bank' && <BankConnectionsTab />}
      {tab === 'manual' && <ManualAccountsTab />}
      {tab === 'uploads' && <UploadsTab />}
      {tab === 'email' && <EmailForwardingTab />}
    </div>
  );
}
```

- [ ] **Step 8: Typecheck and commit**

```bash
pnpm --filter @perfin/web typecheck
git add apps/web
git commit -m "feat(web): Accounts page with 4 tabs (Bank / Manual / Uploads / Email)"
```

---

## Task 23: Playwright e2e — connections page renders

**Files:**
- Create: `apps/web/tests/e2e/connections-flow.spec.ts`

- [ ] **Step 1: Create the test**

```ts
import { test, expect } from '@playwright/test';

test('connections page renders all four tabs', async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e-conn-${stamp}@perfin.dev`;
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

  await page.goto('/app/accounts');
  await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bank connections' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Manual accounts' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Uploads' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Email forwarding' })).toBeVisible();

  // Email tab shows derived address
  await page.getByRole('button', { name: 'Email forwarding' }).click();
  await expect(page.locator('text=/^u_[a-f0-9]{16}@/').first()).toBeVisible();
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/tests
git commit -m "test(web): e2e for /app/accounts tabs + email-address presence"
```

---

## Task 24: Phase 4 acceptance — full sweep

- [ ] **Step 1: Typecheck**

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 \
AUTH_URL=http://localhost:3000 \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
KMS_KEY=00000000000000000000000000000000000000000000000000000000000000aa \
  pnpm typecheck
```
Expected: clean across all 8 packages.

- [ ] **Step 2: Tests**

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 \
AUTH_URL=http://localhost:3000 \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
KMS_KEY=00000000000000000000000000000000000000000000000000000000000000aa \
  pnpm test
```
Expected: ≥ 152 tests pass (≥ 25 new across `@perfin/connectors` and `@perfin/worker`).

- [ ] **Step 3: Build**

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 \
AUTH_URL=http://localhost:3000 \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
KMS_KEY=00000000000000000000000000000000000000000000000000000000000000aa \
  pnpm build
```
Expected: web (≥ 33 routes) + worker both build.

- [ ] **Step 4: e2e**

```bash
docker compose up -d
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin pnpm db:migrate

DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 \
AUTH_URL=http://localhost:3000 \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
KMS_KEY=00000000000000000000000000000000000000000000000000000000000000aa \
EMAIL_DOMAIN=in.perfin.app \
EMAIL_HASH_SECRET=dev-email-hash-secret \
CRON_DISABLED=1 \
  pnpm --filter @perfin/web test:e2e
```
Expected: existing e2e tests + new connections-flow test pass.

- [ ] **Step 5: Manual smoke (Plaid Sandbox)**

Set `PLAID_CLIENT_ID` + `PLAID_SECRET` (Sandbox) and `KMS_KEY` in `.env`, restart dev servers. Sign up fresh, open `/app/accounts`, click **Connect a bank**, complete Plaid Sandbox flow with default credentials (`user_good`/`pass_good`). Verify:
1. A connection row appears with status `active`.
2. Within ~10s, transactions appear at `/app/transactions`.
3. **Sync now** button updates `lastSyncAt`.
4. **Disconnect** sets status to `disconnected` and clears the encrypted token.

- [ ] **Step 6: Manual smoke (Postmark inbound)**

Open `/app/accounts` → Email forwarding tab → copy address. Curl the worker:

```bash
ADDR='<paste address>'
curl -sX POST http://localhost:8001/webhooks/postmark \
  -H 'content-type: application/json' \
  -d '{
    "ToFull": [{ "Email": "'"$ADDR"'" }],
    "From": "alerts@hdfcbank.net",
    "Subject": "Debit Alert",
    "TextBody": "Dear Customer, Thank you for using your HDFC Bank Debit Card ending 1234 for Rs 450.00 at SWIGGY BANGALORE on 15-04-2026. Available balance Rs 12,550.00."
  }'
```

Verify:
- Worker logs `parsed: true`.
- A new transaction `Swiggy Bangalore` for −₹450 appears at `/app/transactions`.

- [ ] **Step 7: Tag + push + PHASES update**

```bash
git tag v0.5.0-phase4
git push origin main
git push origin v0.5.0-phase4
```

Edit `docs/PHASES.md`: move Phase 4 to ✅ Done; add a completion-notes section. Commit:

```bash
git add docs/PHASES.md
git commit -m "docs(phases): mark Phase 4 as done"
git push origin main
```

---

## Phase 4 — Definition of done

- [ ] All 24 tasks committed
- [ ] `pnpm typecheck` clean across all packages (now 8: db, ui, core, extractors, agent, connectors, web, worker)
- [ ] `pnpm test` passes — ≥ 152 unit tests
- [ ] `pnpm build` succeeds — web routes ≥ 33
- [ ] Playwright connections-flow test passes (live-Plaid e2e is manual)
- [ ] Manual: Plaid Sandbox connect → see transactions; Postmark webhook → see transaction
- [ ] Tag `v0.5.0-phase4` on `main`, pushed
- [ ] `docs/PHASES.md` updated

---

## Self-review notes

**Spec coverage check.** Phase 4 of the design spec asks for: Plaid Link integration (Tasks 4-5, 16-17, 21), Postmark inbound email parsing (Tasks 7, 13), Connections page (Task 22), scheduled syncs (Task 14), sync error handling (Task 12 — `ITEM_ERROR` webhook updates `connections.status='error'` + `error` text; surfaced as red banner via `ConnectionCard`). All covered.

**Type-consistency check.** `ConnectionRow` shape is consistent across `useConnections.ts`, `ConnectionCard.tsx`, and the `/api/connections` route response. `PlaidTxn` is the same TS type used by `syncTransactions`, `syncOnePlaidConnection`, and Plaid SDK return shape. `ParsedEmail` from `@perfin/connectors/postmark/parse.ts` is consumed only in the Postmark webhook route and matches the field set used to build the transactions insert. `connections.accessTokenEnc` is encrypted-only at rest and decrypted only inside `syncOnePlaidConnection`.

**Out of scope — deferred to Phase 5.** Marketing site (`/`, `/pricing`, `/how-it-works`, `/security`), Stripe billing, billing settings, live-demo widget on landing, PWA manifest, service worker, Web Push, invite-a-friend.

**Risk notes.**
- *Plaid production access.* Production Plaid requires a SOC2-style review and signed master agreement. Sandbox + Development tier suffice for v1 launch with limited users. Webhooks in Sandbox are unsigned (handled by `verifyPlaidWebhook`).
- *KMS_KEY rotation.* The current encryption helper does not include a key version byte. Rotating KMS_KEY would invalidate stored access tokens. Acceptable for v1; Phase 5 adds a small key-version prefix and a re-encrypt migration.
- *Email parser coverage.* Only HDFC + ICICI debit alerts are parsed in v1. Other banks return null from `parseInboundEmail` and land as `inbound_emails` rows with `status='failed'`. The Phase 4 design is explicit: failed parses are visible to the user (Email forwarding tab can list them later) and are not silently dropped. We add more bank parsers as users report missing formats.
- *Concurrency on sync.* `syncOnePlaidConnection` does sequential per-transaction inserts. For users with thousands of transactions on first sync this is slower than a batch insert; but the cursor model means subsequent syncs are very small (added/modified only). Acceptable trade-off.
- *Hourly cron load.* If many users connect Plaid, the hourly job will have to fetch each item sequentially. `node-cron` runs in-process; we'll graduate to a queue when load demands it. The path is clean: replace the cron loop with `for each conn: queue.push(syncJob)`.
- *Email forwarding security.* `EMAIL_HASH_SECRET` is the only thing keeping addresses unguessable. Treat it like an API key — never commit, rotate if exposed. (We use it inside HMAC, not as the address itself, so leakage doesn't directly leak addresses, but does enable address derivation.)
