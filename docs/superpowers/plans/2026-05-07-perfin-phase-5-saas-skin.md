# Perfin — Phase 5: SaaS Skin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap everything we built in Phases 0-4 in a publicly-launchable SaaS skin: a real marketing site (landing, pricing, how-it-works, security, changelog), Stripe-backed billing for Plus/Pro tiers with plan-aware feature gates, a live-demo widget on the landing page (drop a CSV, watch the rules engine categorize it without signup), full PWA support (manifest, service worker, installable), and Web Push notifications opt-in from Settings. End state: ship `v1.0.0`.

**Architecture:** Marketing pages live in a new `(marketing)` route group with their own shared layout (sticky nav + footer); they render statically and share no auth code with the app shell. Billing is a new pure-TS package `@perfin/billing` that owns the Stripe SDK wrapper, plan-resolver helpers, and feature-gate predicates. The worker grows a `POST /webhooks/stripe` route that verifies Stripe signatures and updates a new `subscriptions` table; the web app exposes `POST /api/billing/checkout` and `POST /api/billing/portal` for Stripe Checkout + Customer Portal. Push uses VAPID keys + a `push_subscriptions` table; the worker has a `pushNotify(userId, payload)` helper that fans out to all of a user's subscriptions, and a small extension to the existing nightly insight job that pushes when a high-confidence anomaly lands. The live-demo widget runs the existing `@perfin/extractors` CSV parser and `@perfin/core` rules engine entirely in the browser — no API call, no LLM — so it works for anonymous traffic at zero cost.

**Tech Stack:** All Phase 4 stack plus: `stripe` 17.4.0 (Node SDK) · `@stripe/stripe-js` 4.10.0 (browser) · `next-pwa` 5.6.0 (or hand-rolled `public/sw.js` if `next-pwa` lags Next 15 — we'll use vanilla SW for control) · `web-push` 3.6.7 (VAPID + payload encryption) · `@next/mdx` 15.0.3 + `@mdx-js/loader` 3.1.0 (changelog).

**Phase 5 acceptance:**
1. Visiting `/` (logged out) renders the marketing landing page with hero, feature grid, live-demo widget, pricing teaser, footer.
2. `/pricing` shows Free / Plus / Pro tiers with working "Upgrade to Plus" / "Upgrade to Pro" Stripe Checkout buttons (Stripe test mode).
3. After Stripe Checkout completes, the `/webhooks/stripe` event upserts a row in `subscriptions` and updates `users.plan`; the user lands back on `/app/settings/billing` showing the new plan.
4. From `/app/settings/billing` a user can click "Manage subscription" → opens Stripe Customer Portal → cancel returns and reflects the change after the next webhook event.
5. Plan-gated feature: starting Plaid Link from `/app/accounts` shows an "Upgrade to Plus" CTA when the current user is on the Free plan.
6. Visiting `/manifest.webmanifest` returns a valid PWA manifest with icons, theme color, shortcuts. Lighthouse PWA score ≥ 90.
7. Settings → Notifications lets a user enable Web Push; the worker can `curl POST /test-push` (HMAC-protected, dev-only) to fire a sample notification that arrives on the user's device.
8. `pnpm typecheck`, `pnpm test`, `pnpm build` clean. ≥ 25 new unit tests pass.
9. Playwright e2e: marketing landing renders all sections; pricing buttons go to Stripe Checkout (mocked URL).
10. Tag `v1.0.0` on `main`; `docs/PHASES.md` updated; the README is rewritten as a launch-ready doc.

---

## File Structure

```
perfin/
├── packages/
│   ├── db/
│   │   ├── src/
│   │   │   ├── enums.ts                            # MODIFIED (subscription_status enum)
│   │   │   └── schema/
│   │   │       ├── users.ts                        # MODIFIED (stripe_customer_id column)
│   │   │       ├── subscriptions.ts                # NEW
│   │   │       ├── pushSubscriptions.ts            # NEW
│   │   │       └── index.ts                        # MODIFIED
│   │   └── migrations/0002_*.sql                   # NEW (generated)
│   └── billing/                                    # NEW package
│       ├── src/
│       │   ├── index.ts
│       │   ├── client.ts                           # Stripe SDK factory
│       │   ├── plan.ts                             # Plan enum, isPlus, isPro, hasFeature()
│       │   ├── checkout.ts                         # createCheckoutSession + createPortalSession
│       │   └── webhook.ts                          # signature verify + event router
│       ├── tests/
│       │   ├── plan.test.ts
│       │   ├── checkout.test.ts
│       │   └── webhook.test.ts
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       └── package.json
│
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── (marketing)/
│   │   │   │   ├── layout.tsx                      # NEW (marketing nav + footer)
│   │   │   │   ├── page.tsx                        # REWRITE root /
│   │   │   │   ├── pricing/page.tsx                # NEW
│   │   │   │   ├── how-it-works/page.tsx           # NEW
│   │   │   │   ├── security/page.tsx               # NEW
│   │   │   │   └── changelog/page.tsx              # NEW
│   │   │   ├── (app)/
│   │   │   │   └── settings/
│   │   │   │       ├── billing/page.tsx            # NEW
│   │   │   │       └── notifications/page.tsx      # NEW
│   │   │   ├── api/
│   │   │   │   ├── billing/
│   │   │   │   │   ├── checkout/route.ts           # NEW
│   │   │   │   │   ├── portal/route.ts             # NEW
│   │   │   │   │   └── status/route.ts             # NEW (GET current plan)
│   │   │   │   ├── push/
│   │   │   │   │   ├── subscribe/route.ts          # NEW
│   │   │   │   │   └── unsubscribe/route.ts        # NEW
│   │   │   │   └── test-push/route.ts              # NEW (dev-only)
│   │   │   ├── manifest.webmanifest/route.ts       # NEW (dynamic manifest)
│   │   │   ├── robots.ts                           # NEW
│   │   │   └── sitemap.ts                          # NEW
│   │   ├── components/
│   │   │   ├── marketing/
│   │   │   │   ├── MarketingNav.tsx                # NEW
│   │   │   │   ├── MarketingFooter.tsx             # NEW
│   │   │   │   ├── Hero.tsx                        # NEW
│   │   │   │   ├── FeatureGrid.tsx                 # NEW
│   │   │   │   ├── PricingTable.tsx                # NEW
│   │   │   │   ├── LiveDemoWidget.tsx              # NEW
│   │   │   │   └── HowItWorksSteps.tsx             # NEW
│   │   │   ├── settings/
│   │   │   │   ├── BillingPanel.tsx                # NEW
│   │   │   │   └── NotificationsPanel.tsx          # NEW
│   │   │   └── PlanGate.tsx                        # NEW (renders upgrade CTA when feature is gated)
│   │   ├── hooks/
│   │   │   ├── usePlan.ts                          # NEW
│   │   │   └── usePushSubscription.ts              # NEW
│   │   ├── lib/
│   │   │   └── pwa.ts                              # NEW (registerSW helper, push subscribe)
│   │   ├── public/
│   │   │   ├── icon-192.png                        # NEW (placeholder)
│   │   │   ├── icon-512.png                        # NEW (placeholder)
│   │   │   └── sw.js                               # NEW (vanilla service worker)
│   │   ├── package.json                            # MODIFIED (stripe-js, web-push, @next/mdx)
│   │   └── tests/e2e/
│   │       ├── marketing.spec.ts                   # NEW
│   │       └── billing.spec.ts                     # NEW (mocked Stripe URL)
│   └── worker/
│       ├── src/
│       │   ├── env.ts                              # MODIFIED (Stripe + VAPID env)
│       │   ├── lib/
│       │   │   └── push.ts                         # NEW (web-push fan-out)
│       │   └── routes/
│       │       └── stripe-webhook.ts               # NEW
│       ├── tests/
│       │   └── stripe-webhook.test.ts              # NEW
│       └── package.json                            # MODIFIED (stripe, web-push)
│
└── README.md                                       # REWRITE (launch-ready)
```

---

## Task 1: DB schema — `subscriptions`, `push_subscriptions`, `users.stripe_customer_id`

**Files:**
- Modify: `packages/db/src/enums.ts`
- Modify: `packages/db/src/schema/users.ts`
- Create: `packages/db/src/schema/subscriptions.ts`
- Create: `packages/db/src/schema/pushSubscriptions.ts`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/tests/schema.test.ts`

- [ ] **Step 1: Add enum**

Append to `packages/db/src/enums.ts`:

```ts
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid',
]);
```

- [ ] **Step 2: Add `stripe_customer_id` to `users.ts`**

Replace contents of `packages/db/src/schema/users.ts`:

```ts
import { pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { planEnum } from '../enums';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    plan: planEnum('plan').notNull().default('free'),
    stripeCustomerId: text('stripe_customer_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailUnique: uniqueIndex('users_email_unique').on(t.email),
    stripeCustomerIdx: uniqueIndex('users_stripe_customer_unique').on(t.stripeCustomerId),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

- [ ] **Step 3: Create `packages/db/src/schema/subscriptions.ts`**

```ts
import { pgTable, serial, integer, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { subscriptionStatusEnum, planEnum } from '../enums';

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    stripeSubscriptionId: text('stripe_subscription_id').notNull(),
    stripePriceId: text('stripe_price_id').notNull(),
    plan: planEnum('plan').notNull(),
    status: subscriptionStatusEnum('status').notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: text('cancel_at_period_end'),    // 'true'/'false' string for portability
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('subscriptions_user_idx').on(t.userId),
    stripeIdx: index('subscriptions_stripe_id_idx').on(t.stripeSubscriptionId),
  }),
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
```

- [ ] **Step 4: Create `packages/db/src/schema/pushSubscriptions.ts`**

```ts
import { pgTable, serial, integer, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    endpointUnique: uniqueIndex('push_subs_endpoint_unique').on(t.endpoint),
  }),
);

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
```

- [ ] **Step 5: Update `packages/db/src/schema/index.ts`**

Append:

```ts
export * from './subscriptions';
export * from './pushSubscriptions';
```

- [ ] **Step 6: Append schema tests**

Append to `packages/db/tests/schema.test.ts`:

```ts
import {
  subscriptions, pushSubscriptions, users,
  subscriptionStatusEnum,
} from '../src/schema/index';

describe('users.stripe_customer_id column added', () => {
  it('exposes stripeCustomerId', () => {
    expect(users.stripeCustomerId).toBeDefined();
  });
});

describe('subscriptions schema', () => {
  it('has expected columns', () => {
    expect(subscriptions.userId).toBeDefined();
    expect(subscriptions.stripeSubscriptionId).toBeDefined();
    expect(subscriptions.stripePriceId).toBeDefined();
    expect(subscriptions.plan).toBeDefined();
    expect(subscriptions.status).toBeDefined();
    expect(subscriptions.currentPeriodEnd).toBeDefined();
  });
});

describe('pushSubscriptions schema', () => {
  it('has endpoint, p256dh, auth', () => {
    expect(pushSubscriptions.endpoint).toBeDefined();
    expect(pushSubscriptions.p256dh).toBeDefined();
    expect(pushSubscriptions.auth).toBeDefined();
  });
});

describe('subscription status enum', () => {
  it('lists Stripe statuses', () => {
    expect(subscriptionStatusEnum.enumValues).toEqual([
      'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid',
    ]);
  });
});
```

- [ ] **Step 7: Run tests**

```bash
pnpm --filter @perfin/db test
```
Expected: 4 new tests pass.

- [ ] **Step 8: Generate + apply migration**

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin pnpm --filter @perfin/db generate
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin pnpm --filter @perfin/db migrate
```
Expected: migration `0002_*.sql` generated and applied. Verify in Postgres:

```bash
docker exec -i perfin-postgres-1 psql -U perfin -d perfin -c '\dt'
```
Expected: `subscriptions` and `push_subscriptions` listed.

- [ ] **Step 9: Commit**

```bash
git add packages/db
git commit -m "feat(db): subscriptions + push_subscriptions tables (migration 0002)"
```

---

## Task 2: `@perfin/billing` — package skeleton + plan helpers

**Files:**
- Create: `packages/billing/package.json`, `tsconfig.json`, `vitest.config.ts`
- Create: `packages/billing/src/plan.ts`
- Create: `packages/billing/src/index.ts`
- Create: `packages/billing/tests/plan.test.ts`

- [ ] **Step 1: Create `packages/billing/package.json`**

```json
{
  "name": "@perfin/billing",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@perfin/db": "workspace:*",
    "stripe": "17.4.0",
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

- [ ] **Step 2: Create `packages/billing/tsconfig.json`**

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

- [ ] **Step 3: Create `packages/billing/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', globals: true },
});
```

- [ ] **Step 4: Write failing test**

Create `packages/billing/tests/plan.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hasFeature, isPlus, isPro, planForPriceId, FEATURES } from '../src/plan';

describe('plan helpers', () => {
  it('isPro covers Pro only', () => {
    expect(isPro('pro')).toBe(true);
    expect(isPro('plus')).toBe(false);
    expect(isPro('free')).toBe(false);
  });
  it('isPlus covers Plus and Pro', () => {
    expect(isPlus('plus')).toBe(true);
    expect(isPlus('pro')).toBe(true);
    expect(isPlus('free')).toBe(false);
  });

  it('FEATURES gates known capabilities by plan', () => {
    expect(hasFeature('free', FEATURES.PLAID_CONNECTIONS)).toBe(false);
    expect(hasFeature('plus', FEATURES.PLAID_CONNECTIONS)).toBe(true);
    expect(hasFeature('pro',  FEATURES.PLAID_CONNECTIONS)).toBe(true);
    expect(hasFeature('free', FEATURES.UNLIMITED_AGENT)).toBe(false);
    expect(hasFeature('plus', FEATURES.UNLIMITED_AGENT)).toBe(false);
    expect(hasFeature('pro',  FEATURES.UNLIMITED_AGENT)).toBe(true);
  });

  it('planForPriceId maps Stripe price ids to plan', () => {
    expect(planForPriceId('price_plus_monthly', { plus: 'price_plus_monthly', pro: 'price_pro_monthly' })).toBe('plus');
    expect(planForPriceId('price_pro_monthly', { plus: 'price_plus_monthly', pro: 'price_pro_monthly' })).toBe('pro');
    expect(planForPriceId('price_unknown', { plus: 'price_plus_monthly', pro: 'price_pro_monthly' })).toBe(null);
  });
});
```

- [ ] **Step 5: Create `packages/billing/src/plan.ts`**

```ts
export type Plan = 'free' | 'plus' | 'pro';

export const FEATURES = {
  PLAID_CONNECTIONS: 'plaid_connections',
  UNLIMITED_TXNS:    'unlimited_txns',
  EXCEL_EXPORT:      'excel_export',
  AGENT_BASIC:       'agent_basic',          // 30/mo
  AGENT_GEN:         'agent_generous',       // 200/mo
  UNLIMITED_AGENT:   'unlimited_agent',
  MEMBERS:           'members',
  PDF_REPORT:        'pdf_report',
} as const;

export type Feature = typeof FEATURES[keyof typeof FEATURES];

const featureMatrix: Record<Feature, Plan[]> = {
  plaid_connections: ['plus', 'pro'],
  unlimited_txns:    ['plus', 'pro'],
  excel_export:      ['plus', 'pro'],
  agent_basic:       ['free', 'plus', 'pro'],
  agent_generous:    ['plus', 'pro'],
  unlimited_agent:   ['pro'],
  members:           ['pro'],
  pdf_report:        ['pro'],
};

export function hasFeature(plan: Plan, feature: Feature): boolean {
  return featureMatrix[feature].includes(plan);
}

export function isPlus(plan: Plan): boolean {
  return plan === 'plus' || plan === 'pro';
}

export function isPro(plan: Plan): boolean {
  return plan === 'pro';
}

export interface PriceMap {
  plus: string;
  pro: string;
}

export function planForPriceId(priceId: string, prices: PriceMap): Plan | null {
  if (priceId === prices.plus) return 'plus';
  if (priceId === prices.pro)  return 'pro';
  return null;
}
```

- [ ] **Step 6: Create `packages/billing/src/index.ts`**

```ts
export * from './plan';
```

- [ ] **Step 7: Install + run tests**

```bash
pnpm install
pnpm --filter @perfin/billing test
```
Expected: 4 tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/billing pnpm-lock.yaml
git commit -m "feat(billing): scaffold @perfin/billing with plan + feature-gate helpers"
```

---

## Task 3: `@perfin/billing` — Stripe client + checkout + portal

**Files:**
- Create: `packages/billing/src/client.ts`
- Create: `packages/billing/src/checkout.ts`
- Create: `packages/billing/tests/checkout.test.ts`
- Modify: `packages/billing/src/index.ts`

- [ ] **Step 1: Write failing test**

Create `packages/billing/tests/checkout.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createCheckoutSession, createPortalSession } from '../src/checkout';

describe('createCheckoutSession', () => {
  it('creates a Stripe customer if user has none, and returns checkout url', async () => {
    const stripe = {
      customers: { create: vi.fn().mockResolvedValue({ id: 'cus_123' }) },
      checkout: { sessions: { create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe/test' }) } },
    } as unknown as Parameters<typeof createCheckoutSession>[0]['stripe'];

    const result = await createCheckoutSession({
      stripe, userId: 1, email: 'a@b.com', stripeCustomerId: null,
      priceId: 'price_plus', successUrl: 'https://app/success', cancelUrl: 'https://app/cancel',
    });
    expect(result.url).toBe('https://checkout.stripe/test');
    expect(result.stripeCustomerId).toBe('cus_123');
    expect(stripe.customers.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'a@b.com', metadata: { userId: '1' } }));
  });

  it('reuses existing stripe_customer_id', async () => {
    const stripe = {
      customers: { create: vi.fn() },
      checkout: { sessions: { create: vi.fn().mockResolvedValue({ url: 'https://x' }) } },
    } as unknown as Parameters<typeof createCheckoutSession>[0]['stripe'];

    const result = await createCheckoutSession({
      stripe, userId: 1, email: 'a@b.com', stripeCustomerId: 'cus_existing',
      priceId: 'price_plus', successUrl: 'https://app/success', cancelUrl: 'https://app/cancel',
    });
    expect(result.stripeCustomerId).toBe('cus_existing');
    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_existing' }));
  });
});

describe('createPortalSession', () => {
  it('returns portal url', async () => {
    const stripe = {
      billingPortal: { sessions: { create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe' }) } },
    } as unknown as Parameters<typeof createPortalSession>[0]['stripe'];
    const out = await createPortalSession({ stripe, stripeCustomerId: 'cus_x', returnUrl: 'https://app/back' });
    expect(out.url).toBe('https://billing.stripe');
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/billing test
```
Expected: fails.

- [ ] **Step 3: Create `packages/billing/src/client.ts`**

```ts
import Stripe from 'stripe';

export function createStripe(apiKey: string): Stripe {
  return new Stripe(apiKey, { apiVersion: '2024-12-18.acacia' });
}
```

- [ ] **Step 4: Create `packages/billing/src/checkout.ts`**

```ts
import type Stripe from 'stripe';

export interface CheckoutInput {
  stripe: Stripe;
  userId: number;
  email: string;
  stripeCustomerId: string | null;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutOutput {
  url: string;
  stripeCustomerId: string;
}

export async function createCheckoutSession(input: CheckoutInput): Promise<CheckoutOutput> {
  let customerId = input.stripeCustomerId;
  if (!customerId) {
    const cust = await input.stripe.customers.create({
      email: input.email,
      metadata: { userId: String(input.userId) },
    });
    customerId = cust.id;
  }

  const session = await input.stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    allow_promotion_codes: true,
  });

  if (!session.url) throw new Error('Stripe did not return a session URL');
  return { url: session.url, stripeCustomerId: customerId };
}

export interface PortalInput {
  stripe: Stripe;
  stripeCustomerId: string;
  returnUrl: string;
}

export async function createPortalSession(input: PortalInput): Promise<{ url: string }> {
  const session = await input.stripe.billingPortal.sessions.create({
    customer: input.stripeCustomerId,
    return_url: input.returnUrl,
  });
  return { url: session.url };
}
```

- [ ] **Step 5: Update `packages/billing/src/index.ts`**

```ts
export * from './plan';
export * from './client';
export * from './checkout';
```

- [ ] **Step 6: Run test**

```bash
pnpm --filter @perfin/billing test
```
Expected: 3 new tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/billing
git commit -m "feat(billing): Stripe client + checkout/portal session helpers"
```

---

## Task 4: `@perfin/billing` — webhook event router

**Files:**
- Create: `packages/billing/src/webhook.ts`
- Create: `packages/billing/tests/webhook.test.ts`
- Modify: `packages/billing/src/index.ts`

- [ ] **Step 1: Write failing test**

Create `packages/billing/tests/webhook.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { interpretEvent } from '../src/webhook';

describe('interpretEvent', () => {
  it('reads subscription create as plan upgrade', () => {
    const evt = {
      type: 'customer.subscription.created',
      data: { object: { id: 'sub_1', customer: 'cus_1', status: 'active', items: { data: [{ price: { id: 'price_plus' } }] }, current_period_end: 1800000000, cancel_at_period_end: false } },
    } as unknown as Parameters<typeof interpretEvent>[0]['event'];
    const out = interpretEvent({ event: evt, prices: { plus: 'price_plus', pro: 'price_pro' } });
    expect(out).toEqual({
      kind: 'upsert',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      stripePriceId: 'price_plus',
      plan: 'plus',
      status: 'active',
      currentPeriodEnd: new Date(1800000000 * 1000),
      cancelAtPeriodEnd: false,
    });
  });

  it('reads subscription delete as cancellation', () => {
    const evt = {
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_1', customer: 'cus_1' } },
    } as unknown as Parameters<typeof interpretEvent>[0]['event'];
    const out = interpretEvent({ event: evt, prices: { plus: 'price_plus', pro: 'price_pro' } });
    expect(out).toEqual({ kind: 'cancel', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' });
  });

  it('returns null for unrelated events', () => {
    const evt = { type: 'invoice.created', data: { object: {} } } as unknown as Parameters<typeof interpretEvent>[0]['event'];
    expect(interpretEvent({ event: evt, prices: { plus: '', pro: '' } })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run:
```bash
pnpm --filter @perfin/billing test
```
Expected: fails.

- [ ] **Step 3: Create `packages/billing/src/webhook.ts`**

```ts
import type Stripe from 'stripe';
import { planForPriceId, type PriceMap, type Plan } from './plan';

export interface InterpretInput {
  event: Stripe.Event;
  prices: PriceMap;
}

export type InterpretedEvent =
  | {
      kind: 'upsert';
      stripeCustomerId: string;
      stripeSubscriptionId: string;
      stripePriceId: string;
      plan: Plan;
      status: string;
      currentPeriodEnd: Date | null;
      cancelAtPeriodEnd: boolean;
    }
  | {
      kind: 'cancel';
      stripeCustomerId: string;
      stripeSubscriptionId: string;
    };

export function interpretEvent({ event, prices }: InterpretInput): InterpretedEvent | null {
  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const sub = event.data.object as unknown as {
      id: string;
      customer: string;
      status: string;
      items: { data: Array<{ price: { id: string } }> };
      current_period_end?: number | null;
      cancel_at_period_end?: boolean;
    };
    const priceId = sub.items.data[0]?.price.id ?? '';
    const plan = planForPriceId(priceId, prices);
    if (!plan) return null;
    return {
      kind: 'upsert',
      stripeCustomerId: sub.customer,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      plan,
      status: sub.status,
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
      cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    };
  }
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as unknown as { id: string; customer: string };
    return { kind: 'cancel', stripeCustomerId: sub.customer, stripeSubscriptionId: sub.id };
  }
  return null;
}
```

- [ ] **Step 4: Update `packages/billing/src/index.ts`** — append:

```ts
export * from './webhook';
```

- [ ] **Step 5: Run test (expect pass)**

```bash
pnpm --filter @perfin/billing test
```
Expected: 3 new tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/billing
git commit -m "feat(billing): Stripe webhook event router (upsert/cancel)"
```

---

## Task 5: Worker — `POST /webhooks/stripe`

**Files:**
- Modify: `apps/worker/package.json` (add `stripe`, `@perfin/billing`)
- Modify: `apps/worker/src/env.ts`
- Create: `apps/worker/src/routes/stripe-webhook.ts`
- Create: `apps/worker/tests/stripe-webhook.test.ts`
- Modify: `apps/worker/src/server.ts`

- [ ] **Step 1: Add deps**

Edit `apps/worker/package.json` `dependencies` — add:

```json
"@perfin/billing": "workspace:*",
"stripe": "17.4.0"
```

- [ ] **Step 2: Update `apps/worker/src/env.ts`** — append to schema:

```ts
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PLUS: z.string().optional(),
  STRIPE_PRICE_PRO:  z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:hello@perfin.app'),
```

…and read them in the same shape from `process.env` in the parse call.

- [ ] **Step 3: Update `turbo.json` `globalEnv`**

Append: `"STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_PLUS", "STRIPE_PRICE_PRO", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"`.

- [ ] **Step 4: Append to `.env.example` and `.env`**

```
# Stripe (test mode in dev)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PLUS=
STRIPE_PRICE_PRO=

# Web Push (VAPID)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:hello@perfin.app
```

- [ ] **Step 5: Write failing test**

Create `apps/worker/tests/stripe-webhook.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../src/server';

describe('POST /webhooks/stripe', () => {
  it('returns 401 if STRIPE_WEBHOOK_SECRET is configured and signature is wrong', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_x';
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'stripe-signature': 'wrong' },
      payload: '{}',
    });
    expect(res.statusCode).toBe(401);
    await app.close();
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it('returns 200 (no-op) when Stripe is unconfigured', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      payload: '{}',
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});
```

- [ ] **Step 6: Run test (expect fail)**

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
KMS_KEY=00000000000000000000000000000000000000000000000000000000000000aa \
  pnpm --filter @perfin/worker test
```
Expected: fails.

- [ ] **Step 7: Create `apps/worker/src/routes/stripe-webhook.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { createDb, subscriptions, users } from '@perfin/db';
import { createStripe, interpretEvent } from '@perfin/billing';
import { env } from '../env.js';

const { db } = createDb(env.DATABASE_URL);

export async function stripeWebhookRoutes(app: FastifyInstance) {
  // Stripe needs the raw body to verify signatures. Register a content parser
  // that retains the raw buffer for this route only.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    (req as unknown as { rawBody?: string }).rawBody = body as string;
    try { done(null, JSON.parse(body as string)); } catch (e) { done(e as Error, undefined); }
  });

  app.post('/webhooks/stripe', async (req, reply) => {
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET || !env.STRIPE_PRICE_PLUS || !env.STRIPE_PRICE_PRO) {
      return reply.send({ ok: true, skipped: 'stripe-unconfigured' });
    }
    const stripe = createStripe(env.STRIPE_SECRET_KEY);
    const sig = req.headers['stripe-signature'];
    const raw = (req as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(req.body);
    if (typeof sig !== 'string') return reply.code(400).send({ error: 'missing signature' });

    let evt;
    try {
      evt = stripe.webhooks.constructEvent(raw, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch {
      return reply.code(401).send({ error: 'invalid signature' });
    }

    const interpreted = interpretEvent({
      event: evt,
      prices: { plus: env.STRIPE_PRICE_PLUS, pro: env.STRIPE_PRICE_PRO },
    });
    if (!interpreted) return reply.send({ ok: true, kind: 'ignored' });

    if (interpreted.kind === 'upsert') {
      const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, interpreted.stripeCustomerId));
      if (!user) {
        app.log.warn({ stripeCustomerId: interpreted.stripeCustomerId }, 'webhook for unknown customer');
        return reply.send({ ok: true, kind: 'unknown-customer' });
      }
      await db.insert(subscriptions).values({
        userId: user.id,
        stripeSubscriptionId: interpreted.stripeSubscriptionId,
        stripePriceId: interpreted.stripePriceId,
        plan: interpreted.plan,
        status: interpreted.status as 'active',
        currentPeriodEnd: interpreted.currentPeriodEnd,
        cancelAtPeriodEnd: interpreted.cancelAtPeriodEnd ? 'true' : 'false',
      }).onConflictDoUpdate({
        target: subscriptions.stripeSubscriptionId,
        set: {
          plan: interpreted.plan,
          status: interpreted.status as 'active',
          currentPeriodEnd: interpreted.currentPeriodEnd,
          cancelAtPeriodEnd: interpreted.cancelAtPeriodEnd ? 'true' : 'false',
          updatedAt: new Date(),
        },
      });
      // Bump users.plan to the highest currently-active subscription
      await db.update(users).set({ plan: interpreted.status === 'active' ? interpreted.plan : 'free' })
        .where(eq(users.id, user.id));
    }

    if (interpreted.kind === 'cancel') {
      const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, interpreted.stripeCustomerId));
      if (!user) return reply.send({ ok: true, kind: 'unknown-customer' });
      await db.update(subscriptions)
        .set({ status: 'canceled', updatedAt: new Date() })
        .where(eq(subscriptions.stripeSubscriptionId, interpreted.stripeSubscriptionId));
      await db.update(users).set({ plan: 'free' }).where(eq(users.id, user.id));
    }

    return reply.send({ ok: true });
  });
}
```

- [ ] **Step 8: Register route in `apps/worker/src/server.ts`**

Add the import and `await app.register(stripeWebhookRoutes)`. Add the unique-index constraint on `subscriptions.stripeSubscriptionId` if not already in the schema (the schema in Task 1 declares an index but not unique — we need unique for the upsert target). Update Task 1's schema retroactively if needed:

In `packages/db/src/schema/subscriptions.ts`, change `stripeIdx: index(...)` to `stripeIdx: uniqueIndex('subscriptions_stripe_id_unique').on(t.stripeSubscriptionId)` and re-import `uniqueIndex`. Regenerate the migration if Step 8 of Task 1 already produced one (`pnpm --filter @perfin/db generate` will create a follow-up migration that adds the unique constraint).

- [ ] **Step 9: Run test (expect pass)**

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod KMS_KEY=00000000000000000000000000000000000000000000000000000000000000aa pnpm --filter @perfin/worker test
```
Expected: 2 new tests pass.

- [ ] **Step 10: Commit**

```bash
git add apps/worker turbo.json .env.example .env packages/db pnpm-lock.yaml
git commit -m "feat(worker): POST /webhooks/stripe (signature verify + subscription upsert)"
```

---

## Task 6: Web — Stripe checkout + portal API routes

**Files:**
- Modify: `apps/web/package.json` (add `@perfin/billing`, `stripe`, `@stripe/stripe-js`)
- Modify: `apps/web/lib/env.ts`
- Create: `apps/web/app/api/billing/checkout/route.ts`
- Create: `apps/web/app/api/billing/portal/route.ts`
- Create: `apps/web/app/api/billing/status/route.ts`

- [ ] **Step 1: Add deps to `apps/web/package.json`**

```json
"@perfin/billing": "workspace:*",
"@stripe/stripe-js": "4.10.0",
"stripe": "17.4.0"
```

- [ ] **Step 2: Add Stripe + Plus/Pro price ids to `apps/web/lib/env.ts`**

Add to the schema:

```ts
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PRICE_PLUS: z.string().optional(),
  STRIPE_PRICE_PRO:  z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
```

…and read them.

- [ ] **Step 3: Create `apps/web/app/api/billing/checkout/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { createDb, users } from '@perfin/db';
import { createStripe, createCheckoutSession } from '@perfin/billing';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_PLUS || !env.STRIPE_PRICE_PRO) {
    return NextResponse.json({ error: 'billing not configured' }, { status: 503 });
  }
  const userId = Number(userIdStr);
  const { plan } = (await req.json()) as { plan: 'plus' | 'pro' };

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return NextResponse.json({ error: 'user not found' }, { status: 404 });

  const priceId = plan === 'plus' ? env.STRIPE_PRICE_PLUS : env.STRIPE_PRICE_PRO;
  const stripe = createStripe(env.STRIPE_SECRET_KEY);
  const out = await createCheckoutSession({
    stripe, userId, email: user.email, stripeCustomerId: user.stripeCustomerId,
    priceId,
    successUrl: `${env.NEXT_PUBLIC_APP_URL}/app/settings/billing?status=success`,
    cancelUrl:  `${env.NEXT_PUBLIC_APP_URL}/pricing?status=cancel`,
  });
  if (!user.stripeCustomerId) {
    await db.update(users).set({ stripeCustomerId: out.stripeCustomerId }).where(eq(users.id, userId));
  }
  return NextResponse.json({ url: out.url });
}
```

- [ ] **Step 4: Create `apps/web/app/api/billing/portal/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { createDb, users } from '@perfin/db';
import { createStripe, createPortalSession } from '@perfin/billing';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function POST() {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'billing not configured' }, { status: 503 });
  const userId = Number(userIdStr);
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user?.stripeCustomerId) return NextResponse.json({ error: 'no Stripe customer' }, { status: 400 });
  const stripe = createStripe(env.STRIPE_SECRET_KEY);
  const out = await createPortalSession({
    stripe,
    stripeCustomerId: user.stripeCustomerId,
    returnUrl: `${env.NEXT_PUBLIC_APP_URL}/app/settings/billing`,
  });
  return NextResponse.json({ url: out.url });
}
```

- [ ] **Step 5: Create `apps/web/app/api/billing/status/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { createDb, subscriptions, users } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return NextResponse.json({ error: 'user not found' }, { status: 404 });
  const [active] = await db.select().from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.updatedAt))
    .limit(1);
  return NextResponse.json({
    plan: user.plan,
    subscription: active ?? null,
    hasStripeCustomer: !!user.stripeCustomerId,
  });
}
```

- [ ] **Step 6: Install + commit**

```bash
pnpm install
pnpm --filter @perfin/web typecheck
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): /api/billing/{checkout,portal,status}"
```

---

## Task 7: Web — `usePlan` hook + `PlanGate` component

**Files:**
- Create: `apps/web/hooks/usePlan.ts`
- Create: `apps/web/components/PlanGate.tsx`

- [ ] **Step 1: Create `apps/web/hooks/usePlan.ts`**

```ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { Plan } from '@perfin/billing';

export interface PlanStatus {
  plan: Plan;
  subscription: {
    plan: Plan;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: string;
  } | null;
  hasStripeCustomer: boolean;
}

export function usePlan() {
  return useQuery<PlanStatus>({
    queryKey: ['plan'],
    queryFn: () => apiFetch<PlanStatus>('/api/billing/status'),
    staleTime: 60_000,
  });
}
```

- [ ] **Step 2: Create `apps/web/components/PlanGate.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { Tile, Button } from '@perfin/ui';
import { hasFeature, type Feature } from '@perfin/billing';
import { usePlan } from '@/hooks/usePlan';
import type { ReactNode } from 'react';

export function PlanGate({ feature, children }: { feature: Feature; children: ReactNode }) {
  const { data, isLoading } = usePlan();
  if (isLoading) return null;
  if (data && hasFeature(data.plan, feature)) return <>{children}</>;
  return (
    <Tile className="space-y-3">
      <div className="text-sm text-text-muted">This is a Plus / Pro feature.</div>
      <Link href="/pricing"><Button variant="primary" size="sm">Upgrade</Button></Link>
    </Tile>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/hooks apps/web/components/PlanGate.tsx
git commit -m "feat(web): usePlan hook + PlanGate component"
```

---

## Task 8: Marketing — layout, nav, footer

**Files:**
- Create: `apps/web/app/(marketing)/layout.tsx`
- Create: `apps/web/components/marketing/MarketingNav.tsx`
- Create: `apps/web/components/marketing/MarketingFooter.tsx`

- [ ] **Step 1: Create `apps/web/components/marketing/MarketingNav.tsx`**

```tsx
import Link from 'next/link';
import { Button } from '@perfin/ui';

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-bg/80 border-b border-border">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold">Perfin</Link>
        <nav className="hidden md:flex gap-6 text-sm">
          <Link href="/pricing" className="text-text-muted hover:text-text">Pricing</Link>
          <Link href="/how-it-works" className="text-text-muted hover:text-text">How it works</Link>
          <Link href="/security" className="text-text-muted hover:text-text">Security</Link>
          <Link href="/changelog" className="text-text-muted hover:text-text">Changelog</Link>
        </nav>
        <div className="flex gap-2">
          <Link href="/login"><Button variant="ghost" size="sm">Log in</Button></Link>
          <Link href="/signup"><Button variant="primary" size="sm">Get started</Button></Link>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Create `apps/web/components/marketing/MarketingFooter.tsx`**

```tsx
import Link from 'next/link';

export function MarketingFooter() {
  return (
    <footer className="border-t border-border py-12">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div>
          <div className="font-semibold mb-3">Perfin</div>
          <p className="text-text-muted">Your money, finally explained.</p>
        </div>
        <div>
          <div className="font-semibold mb-3">Product</div>
          <ul className="space-y-2">
            <li><Link href="/pricing" className="text-text-muted hover:text-text">Pricing</Link></li>
            <li><Link href="/how-it-works" className="text-text-muted hover:text-text">How it works</Link></li>
            <li><Link href="/changelog" className="text-text-muted hover:text-text">Changelog</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-3">Trust</div>
          <ul className="space-y-2">
            <li><Link href="/security" className="text-text-muted hover:text-text">Security</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-3">Get started</div>
          <ul className="space-y-2">
            <li><Link href="/signup" className="text-text-muted hover:text-text">Sign up</Link></li>
            <li><Link href="/login" className="text-text-muted hover:text-text">Log in</Link></li>
          </ul>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 mt-8 text-xs text-text-subtle">© Perfin · Built with Claude</div>
    </footer>
  );
}
```

- [ ] **Step 3: Create `apps/web/app/(marketing)/layout.tsx`**

```tsx
import type { ReactNode } from 'react';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat(marketing): shared layout (nav + footer)"
```

---

## Task 9: Marketing — Hero, FeatureGrid, LiveDemoWidget, landing page

**Files:**
- Create: `apps/web/components/marketing/Hero.tsx`
- Create: `apps/web/components/marketing/FeatureGrid.tsx`
- Create: `apps/web/components/marketing/LiveDemoWidget.tsx`
- Modify: `apps/web/app/(marketing)/page.tsx` (the file currently lives at `apps/web/app/page.tsx`; move into the marketing group)

- [ ] **Step 1: Move existing `app/page.tsx` into the `(marketing)` group**

```bash
git mv apps/web/app/page.tsx apps/web/app/\(marketing\)/page.tsx
```

- [ ] **Step 2: Create `apps/web/components/marketing/Hero.tsx`**

```tsx
import Link from 'next/link';
import { Button } from '@perfin/ui';

export function Hero() {
  return (
    <section className="max-w-4xl mx-auto px-6 py-24 text-center space-y-6">
      <h1 className="text-5xl md:text-6xl font-semibold tracking-tight">
        Your money, <span className="text-accent">finally explained</span>.
      </h1>
      <p className="text-lg text-text-muted max-w-2xl mx-auto">
        Perfin imports every transaction, categorizes it with AI, and tells you what's actually happening. Ask it questions. Let it propose changes. You stay in control.
      </p>
      <div className="flex justify-center gap-3 pt-2">
        <Link href="/signup"><Button variant="primary" size="lg">Get started — free</Button></Link>
        <Link href="#demo"><Button variant="secondary" size="lg">Try the demo</Button></Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create `apps/web/components/marketing/FeatureGrid.tsx`**

```tsx
import { Tile } from '@perfin/ui';

const features = [
  { title: 'Drop in any statement',     body: 'CSV, Excel, or PDF — Perfin extracts transactions and categorizes them in seconds.' },
  { title: 'AI you can audit',          body: 'Every classification is rule-traceable. Every agent action goes through your approval, then into a log.' },
  { title: 'Recurring + anomaly built-in', body: 'Subscriptions, unusual charges, monthly drifts — surfaced before you notice them.' },
  { title: 'Ask anything',              body: 'Conversational chat over your ledger. The agent uses tools, you see the calls, you approve writes.' },
  { title: 'Connect your bank',         body: 'Plaid for North America, Europe, India. Or forward bank emails. Or upload — your call.' },
  { title: 'Yours forever',             body: 'Local Postgres, encrypted access tokens, no data sale, full export. Fork the schema if you want.' },
];

export function FeatureGrid() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {features.map((f) => (
        <Tile key={f.title} className="space-y-2">
          <h3 className="font-semibold">{f.title}</h3>
          <p className="text-sm text-text-muted">{f.body}</p>
        </Tile>
      ))}
    </section>
  );
}
```

- [ ] **Step 4: Create `apps/web/components/marketing/LiveDemoWidget.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { Tile, Button, Badge } from '@perfin/ui';
import { extractCsv } from '@perfin/extractors';
import { categorizeAll, SEED_RULES, formatCurrency } from '@perfin/core';

interface DemoRow {
  date: string;
  description: string;
  amountCents: number;
  category: string;
}

export function LiveDemoWidget() {
  const [rows, setRows] = useState<DemoRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(f: File) {
    setBusy(true);
    try {
      const buf = Buffer.from(await f.arrayBuffer());
      const out = await extractCsv({ buffer: buf, fileName: f.name });
      const cats = await categorizeAll(out.rows.map((r) => r.description), { rules: SEED_RULES, llm: null });
      setRows(out.rows.slice(0, 8).map((r, i) => ({
        date: r.date,
        description: r.description,
        amountCents: Math.round(r.amount * 100),
        category: cats[i]?.category ?? 'Needs Review',
      })));
    } finally { setBusy(false); }
  }

  return (
    <section id="demo" className="max-w-3xl mx-auto px-6 py-16 space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-semibold">Try it without signing up</h2>
        <p className="text-text-muted">Drop a CSV (Date, Description, Amount). Categorization happens entirely in your browser. We never see the file.</p>
      </div>

      <Tile className="text-center space-y-3">
        <input
          type="file"
          accept=".csv"
          className="block mx-auto text-sm"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        />
        {busy && <div className="text-text-muted text-sm">Categorizing…</div>}
      </Tile>

      {rows && (
        <Tile className="px-0 overflow-hidden">
          {rows.map((r, i) => {
            const expense = r.amountCents < 0;
            return (
              <div key={i} className="grid grid-cols-[80px_1fr_120px_110px] items-center gap-3 px-4 py-3 text-sm border-b border-border last:border-0">
                <span className="text-text-muted font-mono text-xs">{r.date}</span>
                <span className="font-medium truncate">{r.description}</span>
                <Badge variant={expense ? 'expense' : 'income'}>{r.category}</Badge>
                <span className={'font-mono text-right ' + (expense ? 'text-negative' : 'text-positive')}>
                  {formatCurrency(r.amountCents, 'USD')}
                </span>
              </div>
            );
          })}
        </Tile>
      )}

      <p className="text-xs text-text-subtle text-center">
        This demo uses the rules engine only — Perfin's full app combines rules with Claude for higher accuracy.
      </p>
    </section>
  );
}
```

- [ ] **Step 5: Replace `apps/web/app/(marketing)/page.tsx`**

```tsx
import { Hero } from '@/components/marketing/Hero';
import { FeatureGrid } from '@/components/marketing/FeatureGrid';
import { LiveDemoWidget } from '@/components/marketing/LiveDemoWidget';

export const metadata = {
  title: 'Perfin — your money, finally explained',
  description: 'AI-powered personal finance: extract, categorize, surface insights, ask anything.',
};

export default function LandingPage() {
  return (
    <>
      <Hero />
      <FeatureGrid />
      <LiveDemoWidget />
    </>
  );
}
```

- [ ] **Step 6: Verify Buffer is available in client bundle**

The `LiveDemoWidget` calls `Buffer.from(...)`. In Next.js 15 client bundles, polyfill via the existing dependency chain (Next polyfills `Buffer` via `buffer` package in client when used through `react`/`webpack`, but to be safe, add to `apps/web/package.json`:

```json
"buffer": "6.0.3"
```

…and at the top of `LiveDemoWidget.tsx` add:

```ts
import { Buffer } from 'buffer';
```

Run `pnpm install`.

- [ ] **Step 7: Typecheck and commit**

```bash
pnpm --filter @perfin/web typecheck
git add apps/web pnpm-lock.yaml
git commit -m "feat(marketing): landing page (hero + features + live-demo widget)"
```

---

## Task 10: Marketing — Pricing page

**Files:**
- Create: `apps/web/components/marketing/PricingTable.tsx`
- Create: `apps/web/app/(marketing)/pricing/page.tsx`

- [ ] **Step 1: Create `apps/web/components/marketing/PricingTable.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Tile, Button } from '@perfin/ui';
import { apiFetch } from '@/lib/api';
import { useSession } from '@/hooks/useSession';

interface Tier {
  name: string;
  price: string;
  blurb: string;
  features: string[];
  cta: 'signup' | 'plus' | 'pro';
  highlight?: boolean;
}

const tiers: Tier[] = [
  { name: 'Free',  price: '$0',   blurb: '1 account, 100 txns/mo',   features: ['Manual upload (CSV/Excel/PDF)', 'Rule-based categorization', 'Basic insights', '30 agent messages/mo'], cta: 'signup' },
  { name: 'Plus',  price: '$9',   blurb: 'Everything that hooks up automatically.', features: ['Plaid bank connections', 'Email forwarding', 'Unlimited transactions', 'Excel export', '200 agent messages/mo'], cta: 'plus', highlight: true },
  { name: 'Pro',   price: '$19',  blurb: 'For teams or anyone who wants the most.', features: ['Multi-account Plaid', 'Unlimited agent', 'Members (RBAC)', 'PDF reports', 'Priority support'], cta: 'pro' },
];

export function PricingTable() {
  const session = useSession();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function startCheckout(plan: 'plus' | 'pro') {
    setBusyKey(plan);
    try {
      const res = await apiFetch<{ url: string }>('/api/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) });
      window.location.href = res.url;
    } finally { setBusyKey(null); }
  }

  return (
    <section className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-4">
      {tiers.map((t) => (
        <Tile key={t.name} className={'space-y-4 ' + (t.highlight ? 'border-accent' : '')}>
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-text-subtle">{t.name}</div>
            <div className="text-3xl font-semibold mt-1">{t.price}<span className="text-sm text-text-muted font-normal">/mo</span></div>
            <p className="text-sm text-text-muted mt-2">{t.blurb}</p>
          </div>
          <ul className="space-y-1 text-sm">
            {t.features.map((f) => <li key={f} className="text-text-muted">✓ {f}</li>)}
          </ul>
          {t.cta === 'signup'
            ? <Link href="/signup" className="block"><Button variant={t.highlight ? 'primary' : 'secondary'} className="w-full">Sign up free</Button></Link>
            : (
              session
                ? <Button variant={t.highlight ? 'primary' : 'secondary'} className="w-full" onClick={() => startCheckout(t.cta as 'plus' | 'pro')} disabled={busyKey === t.cta}>
                    {busyKey === t.cta ? 'Redirecting…' : `Upgrade to ${t.name}`}
                  </Button>
                : <Link href="/signup" className="block"><Button variant={t.highlight ? 'primary' : 'secondary'} className="w-full">Sign up to upgrade</Button></Link>
            )
          }
        </Tile>
      ))}
    </section>
  );
}
```

- [ ] **Step 2: Create `apps/web/hooks/useSession.ts` (small SWR-style helper)**

```ts
'use client';

import { useEffect, useState } from 'react';

export function useSession() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    fetch('/api/auth/session').then((r) => r.json()).then((s: { user?: { id?: string } } | null) => setAuthed(!!s?.user?.id));
  }, []);
  return authed;
}
```

- [ ] **Step 3: Create `apps/web/app/(marketing)/pricing/page.tsx`**

```tsx
import { PricingTable } from '@/components/marketing/PricingTable';

export const metadata = { title: 'Pricing · Perfin', description: 'Free, Plus $9/mo, Pro $19/mo.' };

export default function PricingPage() {
  return (
    <>
      <section className="max-w-3xl mx-auto px-6 pt-16 pb-8 text-center space-y-3">
        <h1 className="text-4xl font-semibold">Simple pricing</h1>
        <p className="text-text-muted">Start free. Upgrade when automation pays for itself.</p>
      </section>
      <PricingTable />
    </>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat(marketing): pricing page with Stripe Checkout buttons"
```

---

## Task 11: Marketing — How it works, Security, Changelog

**Files:**
- Create: `apps/web/components/marketing/HowItWorksSteps.tsx`
- Create: `apps/web/app/(marketing)/how-it-works/page.tsx`
- Create: `apps/web/app/(marketing)/security/page.tsx`
- Create: `apps/web/app/(marketing)/changelog/page.tsx`

- [ ] **Step 1: Create `apps/web/components/marketing/HowItWorksSteps.tsx`**

```tsx
import { Tile } from '@perfin/ui';

const steps = [
  { n: '01', title: 'Ingest',     body: 'Upload statements, connect Plaid, or forward bank emails. Perfin extracts transactions and saves the source.' },
  { n: '02', title: 'Categorize', body: 'Rules first (instant, transparent), Claude where rules can\'t decide. Every category is editable.' },
  { n: '03', title: 'Insights',   body: 'Recurring detection, anomaly scoring, monthly narrative. Surfaced as cards on Home and the Insights feed.' },
  { n: '04', title: 'Ask',        body: 'Chat with your money. The agent uses tools to query the ledger and proposes writes for your approval.' },
];

export function HowItWorksSteps() {
  return (
    <section className="max-w-4xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-2 gap-6">
      {steps.map((s) => (
        <Tile key={s.n} className="space-y-2">
          <div className="text-xs font-mono text-accent">{s.n}</div>
          <h3 className="font-semibold">{s.title}</h3>
          <p className="text-sm text-text-muted">{s.body}</p>
        </Tile>
      ))}
    </section>
  );
}
```

- [ ] **Step 2: Create `apps/web/app/(marketing)/how-it-works/page.tsx`**

```tsx
import { HowItWorksSteps } from '@/components/marketing/HowItWorksSteps';

export const metadata = { title: 'How it works · Perfin', description: 'Ingest → Categorize → Insights → Ask. Four steps, transparent at every layer.' };

export default function HowItWorksPage() {
  return (
    <>
      <section className="max-w-3xl mx-auto px-6 pt-16 pb-4 text-center space-y-3">
        <h1 className="text-4xl font-semibold">How Perfin works</h1>
        <p className="text-text-muted">From statements to insights to actions, in four steps.</p>
      </section>
      <HowItWorksSteps />
    </>
  );
}
```

- [ ] **Step 3: Create `apps/web/app/(marketing)/security/page.tsx`**

```tsx
import { Tile } from '@perfin/ui';

const principles = [
  { title: 'Encryption at rest', body: 'Plaid access tokens are encrypted with AES-256-GCM. The encryption key never leaves the worker process.' },
  { title: 'No data sale, ever', body: 'Your transactions are not shared, sold, or used to train shared models. Period.' },
  { title: 'Auditable AI',       body: 'Every agent action is recorded with input, output, and who confirmed it. Export anytime.' },
  { title: 'Local-first option', body: 'Run Perfin on your own machine with Docker. The schema is open. Your data is yours.' },
  { title: 'SOC2 in progress',   body: 'We\'re working toward SOC2 Type II. Production-grade Plaid is gated until that completes.' },
  { title: 'Plaid handles bank credentials', body: 'We never see your bank password. Plaid Link is the only place credentials are entered.' },
];

export const metadata = { title: 'Security · Perfin', description: 'How Perfin keeps your money data safe.' };

export default function SecurityPage() {
  return (
    <>
      <section className="max-w-3xl mx-auto px-6 pt-16 pb-4 text-center space-y-3">
        <h1 className="text-4xl font-semibold">Security</h1>
        <p className="text-text-muted">Strong defaults. Transparent decisions. Your data, your control.</p>
      </section>
      <section className="max-w-4xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-2 gap-4">
        {principles.map((p) => (
          <Tile key={p.title} className="space-y-2">
            <h3 className="font-semibold">{p.title}</h3>
            <p className="text-sm text-text-muted">{p.body}</p>
          </Tile>
        ))}
      </section>
    </>
  );
}
```

- [ ] **Step 4: Create `apps/web/app/(marketing)/changelog/page.tsx`**

```tsx
import { Tile } from '@perfin/ui';

const entries = [
  { v: 'v1.0.0', date: 'Public launch',         items: ['Marketing site', 'Stripe billing (Plus/Pro)', 'PWA + push', 'Live-demo widget', 'Plan-aware feature gates'] },
  { v: 'v0.5.0-phase4', date: 'Multi-source ingestion', items: ['Plaid Link', 'Postmark inbound email parsing', 'Connections page (4 tabs)', 'Hourly Plaid sync'] },
  { v: 'v0.4.0-phase3', date: 'Agentic chat',           items: ['Ask page', 'Vercel AI SDK + Claude streaming', '9-tool agent', 'Write-confirm flow', 'Activity audit log'] },
  { v: 'v0.3.0-phase2', date: 'Insights & Home',         items: ['Recurring + anomaly detectors', 'Bento Home', 'Insights feed', 'Inbox', 'Monthly narrative'] },
  { v: 'v0.2.0-phase1', date: 'Core data loop',          items: ['CSV / Excel / PDF extractors', 'Rules + Claude categorizer', 'Upload flow with live progress', 'Transactions page', '3-step onboarding'] },
  { v: 'v0.1.0-phase0', date: 'Foundations',             items: ['Monorepo', 'Schema (14 tables)', 'Auth.js', 'Design system', 'Sidebar shell'] },
];

export const metadata = { title: 'Changelog · Perfin', description: 'What we shipped, when.' };

export default function ChangelogPage() {
  return (
    <>
      <section className="max-w-3xl mx-auto px-6 pt-16 pb-4 text-center space-y-3">
        <h1 className="text-4xl font-semibold">Changelog</h1>
      </section>
      <section className="max-w-3xl mx-auto px-6 py-8 space-y-4">
        {entries.map((e) => (
          <Tile key={e.v} className="space-y-2">
            <div className="flex items-baseline gap-3">
              <h3 className="font-semibold font-mono">{e.v}</h3>
              <span className="text-xs text-text-subtle">{e.date}</span>
            </div>
            <ul className="text-sm text-text-muted list-disc list-inside space-y-1">
              {e.items.map((i) => <li key={i}>{i}</li>)}
            </ul>
          </Tile>
        ))}
      </section>
    </>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(marketing): how-it-works + security + changelog pages"
```

---

## Task 12: SEO — sitemap, robots, dynamic manifest

**Files:**
- Create: `apps/web/app/sitemap.ts`
- Create: `apps/web/app/robots.ts`
- Create: `apps/web/app/manifest.webmanifest/route.ts`
- Create: `apps/web/public/icon-192.png` and `apps/web/public/icon-512.png` (placeholder)

- [ ] **Step 1: Create `apps/web/app/sitemap.ts`**

```ts
import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.NEXT_PUBLIC_APP_URL;
  const lastModified = new Date();
  return [
    { url: `${base}/`,             lastModified, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/pricing`,      lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/how-it-works`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/security`,     lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/changelog`,    lastModified, changeFrequency: 'weekly',  priority: 0.5 },
  ];
}
```

- [ ] **Step 2: Create `apps/web/app/robots.ts`**

```ts
import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: ['/', '/pricing', '/how-it-works', '/security', '/changelog'], disallow: ['/app', '/onboarding', '/api'] },
    ],
    sitemap: `${env.NEXT_PUBLIC_APP_URL}/sitemap.xml`,
  };
}
```

- [ ] **Step 3: Create `apps/web/app/manifest.webmanifest/route.ts`**

```ts
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  const manifest = {
    name: 'Perfin',
    short_name: 'Perfin',
    description: 'AI-powered personal finance.',
    start_url: '/app',
    display: 'standalone',
    background_color: '#08080B',
    theme_color: '#08080B',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcuts: [
      { name: 'Ask Perfin',   url: '/app/ask',          icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Transactions', url: '/app/transactions', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
    ],
  };
  return NextResponse.json(manifest, {
    headers: { 'content-type': 'application/manifest+json', 'cache-control': 'public, max-age=3600' },
  });
}
```

- [ ] **Step 4: Add placeholder icons**

Generate two solid-color icons (one of many tiny ways):

```bash
# Single black square: 192x192 + 512x512. Use sips on macOS or any image tool.
mkdir -p apps/web/public
# Replace with real icons during launch prep — placeholders unblock the build.
node -e "const fs=require('fs');const p192=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAYAAABS3GwHAAAAEUlEQVR42mP8z8BQz0AEYBxVBgAJVwOA2zxfYgAAAABJRU5ErkJggg==','base64');fs.writeFileSync('apps/web/public/icon-192.png',p192);fs.writeFileSync('apps/web/public/icon-512.png',p192);"
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/sitemap.ts apps/web/app/robots.ts apps/web/app/manifest.webmanifest apps/web/public
git commit -m "feat(seo): sitemap, robots, manifest.webmanifest, placeholder icons"
```

---

## Task 13: PWA — service worker + register helper

**Files:**
- Create: `apps/web/public/sw.js`
- Create: `apps/web/lib/pwa.ts`
- Modify: `apps/web/app/layout.tsx` (link manifest + register SW)

- [ ] **Step 1: Create `apps/web/public/sw.js`**

```js
// Minimal service worker: handles push, click, and a small offline cache.
const CACHE = 'perfin-v1';
const PRECACHE = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Network-first for HTML; cache-first for static assets.
  if (req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(fetch(req).catch(() => caches.match('/'.toString())));
    return;
  }
  event.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const payload = event.data.json();
  event.waitUntil(self.registration.showNotification(payload.title || 'Perfin', {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: payload.url || '/app/inbox' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/app';
  event.waitUntil(self.clients.openWindow(url));
});
```

- [ ] **Step 2: Create `apps/web/lib/pwa.ts`**

```ts
'use client';

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (err) {
    console.error('SW registration failed', err);
    return null;
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Std = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Std);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function subscribeForPush(vapidPublicKey: string): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  return await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
}
```

- [ ] **Step 3: Update `apps/web/app/layout.tsx`** to link manifest

Add `<link rel="manifest" href="/manifest.webmanifest" />` in the `<head>` and `<meta name="theme-color" content="#08080B" />`. Use Next's metadata API:

```tsx
export const metadata = {
  title: 'Perfin — your money, finally explained',
  description: 'AI-powered personal finance.',
  manifest: '/manifest.webmanifest',
  themeColor: '#08080B',
};
```

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat(pwa): service worker (offline cache, push, click) + register helper"
```

---

## Task 14: Web Push — subscribe/unsubscribe endpoints + Settings panel

**Files:**
- Create: `apps/web/app/api/push/subscribe/route.ts`
- Create: `apps/web/app/api/push/unsubscribe/route.ts`
- Create: `apps/web/app/api/test-push/route.ts`
- Create: `apps/web/hooks/usePushSubscription.ts`
- Create: `apps/web/components/settings/NotificationsPanel.tsx`
- Create: `apps/web/app/(app)/settings/notifications/page.tsx`

- [ ] **Step 1: Create `apps/web/app/api/push/subscribe/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { createDb, pushSubscriptions } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);
  const { endpoint, keys } = (await req.json()) as { endpoint: string; keys: { p256dh: string; auth: string } };
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'invalid subscription' }, { status: 400 });
  }
  await db.insert(pushSubscriptions).values({ userId, endpoint, p256dh: keys.p256dh, auth: keys.auth }).onConflictDoNothing();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Create `apps/web/app/api/push/unsubscribe/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { createDb, pushSubscriptions } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { endpoint } = (await req.json()) as { endpoint: string };
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Create `apps/web/app/api/test-push/route.ts`** (dev-only)

```ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { callWorker } from '@/lib/worker';

export const runtime = 'nodejs';

export async function POST() {
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'disabled' }, { status: 403 });
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const out = await callWorker<{ ok: boolean }>('/jobs/test-push', { userId: Number(userIdStr) });
  return NextResponse.json(out);
}
```

- [ ] **Step 4: Create `apps/web/hooks/usePushSubscription.ts`**

```ts
'use client';

import { useEffect, useState } from 'react';
import { registerServiceWorker, subscribeForPush } from '@/lib/pwa';

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export function usePushSubscription() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setEnabled(false); return; }
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      if (!reg) { setEnabled(false); return; }
      const sub = await reg.pushManager.getSubscription();
      setEnabled(!!sub);
    });
  }, []);

  async function enable() {
    if (!VAPID) throw new Error('VAPID public key not configured');
    setBusy(true);
    try {
      await registerServiceWorker();
      const sub = await subscribeForPush(VAPID);
      if (!sub) throw new Error('subscription failed');
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth } }),
      });
      setEnabled(true);
    } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/unsubscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setEnabled(false);
    } finally { setBusy(false); }
  }

  return { enabled, busy, enable, disable };
}
```

- [ ] **Step 5: Create `apps/web/components/settings/NotificationsPanel.tsx`**

```tsx
'use client';

import { Tile, Button, Badge } from '@perfin/ui';
import { usePushSubscription } from '@/hooks/usePushSubscription';

export function NotificationsPanel() {
  const { enabled, busy, enable, disable } = usePushSubscription();
  return (
    <Tile className="space-y-3">
      <h3 className="font-semibold">Web Push</h3>
      <p className="text-sm text-text-muted">
        Get notified about anomalies, budget breaches, and agent confirmations.
      </p>
      <div>
        {enabled === null
          ? <Badge variant="neutral">Loading…</Badge>
          : enabled
            ? <div className="flex gap-2 items-center"><Badge variant="income">Enabled</Badge><Button size="sm" variant="ghost" onClick={disable} disabled={busy}>Turn off</Button></div>
            : <Button size="sm" variant="primary" onClick={enable} disabled={busy}>Enable notifications</Button>
        }
      </div>
    </Tile>
  );
}
```

- [ ] **Step 6: Create `apps/web/app/(app)/settings/notifications/page.tsx`**

```tsx
import { NotificationsPanel } from '@/components/settings/NotificationsPanel';

export default function NotificationsPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Notifications</h2>
      <NotificationsPanel />
    </div>
  );
}
```

- [ ] **Step 7: Add `NEXT_PUBLIC_VAPID_PUBLIC_KEY` to `.env.example`/`.env`**

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
```

- [ ] **Step 8: Commit**

```bash
git add apps/web .env.example .env
git commit -m "feat(web): /api/push subscribe/unsubscribe + Settings → Notifications"
```

---

## Task 15: Worker — `pushNotify` helper + `/jobs/test-push`

**Files:**
- Modify: `apps/worker/package.json` (add `web-push`)
- Create: `apps/worker/src/lib/push.ts`
- Modify: `apps/worker/src/server.ts` (register `/jobs/test-push`)
- Create: `apps/worker/src/routes/test-push.ts`

- [ ] **Step 1: Add deps**

In `apps/worker/package.json` → `dependencies`: `"web-push": "3.6.7"`.

In `apps/worker/package.json` → `devDependencies`: `"@types/web-push": "3.6.4"`.

Run:
```bash
pnpm install
```

- [ ] **Step 2: Create `apps/worker/src/lib/push.ts`**

```ts
import webpush from 'web-push';
import { eq } from 'drizzle-orm';
import { pushSubscriptions, type Db } from '@perfin/db';
import { env } from '../env.js';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function pushNotify(db: Db, userId: number, payload: PushPayload): Promise<{ sent: number; pruned: number }> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return { sent: 0, pruned: 0 };
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  let sent = 0;
  let pruned = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint));
        pruned++;
      }
    }
  }
  return { sent, pruned };
}
```

- [ ] **Step 3: Create `apps/worker/src/routes/test-push.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createDb } from '@perfin/db';
import { env } from '../env.js';
import { verify } from '../lib/hmac.js';
import { pushNotify } from '../lib/push.js';

const Body = z.object({ userId: z.number().int().positive() });
const { db } = createDb(env.DATABASE_URL);

export async function testPushRoutes(app: FastifyInstance) {
  app.post('/jobs/test-push', async (req, reply) => {
    const sig = req.headers['x-perfin-sig'];
    if (typeof sig !== 'string') return reply.code(401).send({ error: 'missing signature' });
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!verify(env.WORKER_HMAC_SECRET, raw, sig)) return reply.code(401).send({ error: 'invalid signature' });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const out = await pushNotify(db, parsed.data.userId, {
      title: 'Hello from Perfin',
      body: 'Web Push is working — anomalies and budget alerts will land here.',
      url: '/app/inbox',
    });
    return reply.send({ ok: true, ...out });
  });
}
```

- [ ] **Step 4: Register route in `apps/worker/src/server.ts`**

Add `import { testPushRoutes } from './routes/test-push';` and `await app.register(testPushRoutes);`.

- [ ] **Step 5: Commit**

```bash
git add apps/worker pnpm-lock.yaml
git commit -m "feat(worker): web-push helper + POST /jobs/test-push (HMAC dev trigger)"
```

---

## Task 16: Settings — Billing panel + page

**Files:**
- Create: `apps/web/components/settings/BillingPanel.tsx`
- Create: `apps/web/app/(app)/settings/billing/page.tsx`
- Modify: `apps/web/app/(app)/settings/layout.tsx` (add Billing + Notifications tabs)

- [ ] **Step 1: Create `apps/web/components/settings/BillingPanel.tsx`**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Tile, Button, Badge } from '@perfin/ui';
import { usePlan } from '@/hooks/usePlan';
import { apiFetch } from '@/lib/api';

export function BillingPanel() {
  const { data, isLoading } = usePlan();
  const [busy, setBusy] = useState(false);

  if (isLoading || !data) return <Tile>Loading…</Tile>;

  async function openPortal() {
    setBusy(true);
    try {
      const out = await apiFetch<{ url: string }>('/api/billing/portal', { method: 'POST' });
      window.location.href = out.url;
    } finally { setBusy(false); }
  }

  return (
    <Tile className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-text-muted">Current plan:</span>
        <Badge variant="accent">{data.plan.toUpperCase()}</Badge>
      </div>
      {data.subscription?.currentPeriodEnd && (
        <div className="text-xs text-text-subtle">
          Next renewal: {new Date(data.subscription.currentPeriodEnd).toLocaleDateString()}
        </div>
      )}
      <div className="flex gap-2 pt-1">
        {data.hasStripeCustomer
          ? <Button variant="secondary" size="sm" onClick={openPortal} disabled={busy}>{busy ? 'Opening…' : 'Manage subscription'}</Button>
          : <Link href="/pricing"><Button variant="primary" size="sm">Upgrade</Button></Link>
        }
      </div>
    </Tile>
  );
}
```

- [ ] **Step 2: Create `apps/web/app/(app)/settings/billing/page.tsx`**

```tsx
import { BillingPanel } from '@/components/settings/BillingPanel';

export default function BillingPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Billing</h2>
      <BillingPanel />
    </div>
  );
}
```

- [ ] **Step 3: Update `apps/web/app/(app)/settings/layout.tsx` tabs**

Replace the `tabs` array:

```tsx
const tabs = [
  { href: '/app/settings/activity',      label: 'Activity' },
  { href: '/app/settings/billing',       label: 'Billing' },
  { href: '/app/settings/notifications', label: 'Notifications' },
];
```

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat(settings): Billing panel + Notifications tab in Settings layout"
```

---

## Task 17: Plan-gated Plaid Link CTA

**Files:**
- Modify: `apps/web/components/accounts/BankConnectionsTab.tsx`

- [ ] **Step 1: Wrap the Plaid Link button in `PlanGate`**

Replace the button placement with:

```tsx
import { PlanGate } from '@/components/PlanGate';
import { FEATURES } from '@perfin/billing';

// inside the JSX, replace `<PlaidLinkButton />` with:
<PlanGate feature={FEATURES.PLAID_CONNECTIONS}>
  <PlaidLinkButton />
</PlanGate>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/accounts/BankConnectionsTab.tsx
git commit -m "feat(web): gate Plaid Link behind Plus plan via PlanGate"
```

---

## Task 18: README rewrite

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace `README.md` with a launch-ready doc**

```md
# Perfin

> Your money, finally explained.

Perfin is an AI-powered personal-finance app: it ingests transactions from bank connections, statement uploads, and forwarded emails, categorizes them with rules + Claude, surfaces recurring/anomaly insights, and lets you ask anything via a tool-using chat agent that proposes writes for your one-click approval.

## Stack

- **TypeScript everywhere** — Turborepo monorepo, 9 packages.
- **Next.js 15** App Router (web) + **Fastify** (worker).
- **Postgres** via Drizzle ORM.
- **Anthropic Claude** Sonnet 4.6 (chat, narratives) + Haiku 4.5 (categorization fallback).
- **Plaid** (Sandbox grade in v1) for bank connections.
- **Postmark** inbound email parsing.
- **Stripe** for billing (Plus / Pro tiers).
- **PWA** with service worker + Web Push.

## Quick start

```bash
pnpm install
docker compose up -d                                                    # Postgres on 5433
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin pnpm db:migrate
cp .env.example .env                                                    # fill in keys
pnpm dev                                                                # web on 3000, worker on 8001
```

Visit `http://localhost:3000`.

## Pricing tiers

| Tier | Price | Highlights |
|---|---|---|
| Free | $0    | 1 account, 100 txns/mo, manual upload, basic categorization, 30 agent msgs/mo |
| Plus | $9/mo | Plaid, email forwarding, unlimited txns, Excel export, 200 agent msgs/mo |
| Pro  | $19/mo | Multi-account Plaid, unlimited agent, RBAC members, PDF reports, priority support |

## Project status

See [docs/PHASES.md](docs/PHASES.md) for shipped milestones.

## License

MIT.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README for v1.0 launch"
```

---

## Task 19: Playwright e2e — marketing + billing button click

**Files:**
- Create: `apps/web/tests/e2e/marketing.spec.ts`

- [ ] **Step 1: Create the test**

```ts
import { test, expect } from '@playwright/test';

test('marketing landing renders hero + features + demo', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /your money/i })).toBeVisible();
  await expect(page.getByText(/Drop in any statement/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: /Try it without signing up/i })).toBeVisible();
});

test('pricing page lists three tiers', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByText('Free')).toBeVisible();
  await expect(page.getByText('Plus')).toBeVisible();
  await expect(page.getByText('Pro')).toBeVisible();
  await expect(page.getByRole('link', { name: /Sign up free/i }).first()).toBeVisible();
});

test('how-it-works renders four steps', async ({ page }) => {
  await page.goto('/how-it-works');
  await expect(page.getByRole('heading', { name: /How Perfin works/i })).toBeVisible();
  await expect(page.getByText('01')).toBeVisible();
  await expect(page.getByText('04')).toBeVisible();
});

test('security page renders principles', async ({ page }) => {
  await page.goto('/security');
  await expect(page.getByText(/Encryption at rest/i)).toBeVisible();
});

test('changelog lists v1.0.0', async ({ page }) => {
  await page.goto('/changelog');
  await expect(page.getByText('v1.0.0')).toBeVisible();
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/tests
git commit -m "test(web): e2e for marketing pages"
```

---

## Task 20: Phase 5 acceptance — full sweep

- [ ] **Step 1: Typecheck**

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 \
AUTH_URL=http://localhost:3000 \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
KMS_KEY=00000000000000000000000000000000000000000000000000000000000000aa \
  pnpm typecheck
```
Expected: clean across 9 packages.

- [ ] **Step 2: Tests**

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 \
AUTH_URL=http://localhost:3000 \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
KMS_KEY=00000000000000000000000000000000000000000000000000000000000000aa \
  pnpm test
```
Expected: ≥ 167 unit tests pass (≥ 25 new across `@perfin/billing` + `@perfin/db` + worker).

- [ ] **Step 3: Build**

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin \
AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 \
AUTH_URL=http://localhost:3000 \
WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod \
KMS_KEY=00000000000000000000000000000000000000000000000000000000000000aa \
  pnpm build
```
Expected: web (≥ 41 routes including marketing pages) + worker both build.

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
NEXT_PUBLIC_APP_URL=http://localhost:3000 \
  pnpm --filter @perfin/web test:e2e
```
Expected: all e2e tests pass (signup/onboarding from prior phases + 5 new marketing tests).

- [ ] **Step 5: Manual smoke — billing**

Set Stripe test keys + price ids in `.env`:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PLUS=price_...
STRIPE_PRICE_PRO=price_...
```

Use Stripe CLI to forward webhooks: `stripe listen --forward-to http://localhost:8001/webhooks/stripe`. Restart workers, sign up, visit `/pricing`, click "Upgrade to Plus", complete Stripe Checkout with test card `4242 4242 4242 4242`. Verify:
- Redirected to `/app/settings/billing?status=success`.
- Subscription row appears in DB; `users.plan = 'plus'`.
- `/app/accounts` Bank tab now shows the Plaid Link button (no upgrade gate).

- [ ] **Step 6: Manual smoke — push**

Generate VAPID keys (one-off):
```bash
node -e "const w=require('web-push');const k=w.generateVAPIDKeys();console.log(k);"
```
Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` in worker env; set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in web env. Visit `/app/settings/notifications`, click **Enable notifications** (grant browser permission), then in DevTools console:

```js
fetch('/api/test-push', { method: 'POST' })
```
Expected: a notification appears with title "Hello from Perfin".

- [ ] **Step 7: Tag + push + PHASES + README**

```bash
git tag v1.0.0
git push origin main
git push origin v1.0.0
```

Edit `docs/PHASES.md`: move Phase 5 to ✅ Done, add completion-notes section. Commit:

```bash
git add docs/PHASES.md
git commit -m "docs(phases): mark Phase 5 as done — v1.0.0 ships"
git push origin main
```

---

## Phase 5 — Definition of done

- [ ] All 20 tasks committed
- [ ] `pnpm typecheck` clean across 9 packages (added `@perfin/billing`)
- [ ] `pnpm test` passes — ≥ 167 unit tests
- [ ] `pnpm build` succeeds — web ≥ 41 routes
- [ ] Marketing: landing + pricing + how-it-works + security + changelog all render
- [ ] Stripe Checkout test-mode flow works end-to-end (mock or live test keys)
- [ ] PWA: manifest serves, service worker registers, app is installable from Chrome/Safari
- [ ] Web Push: enable from Settings → Notifications → /api/test-push fires a notification
- [ ] Tag `v1.0.0` on `main`, pushed
- [ ] `docs/PHASES.md` and `README.md` updated

---

## Self-review notes

**Spec coverage check.** Phase 5 of the design spec asks for: marketing site (Tasks 8-11), Stripe billing for Plus/Pro (Tasks 2-7, 16, 17), billing settings (Task 16), live-demo widget on landing (Task 9), PWA manifest + service worker + push notifications (Tasks 12-15, 18). All covered. The "invite-a-friend" item from earlier brainstorming is *not* in the design spec for Phase 5 and is intentionally omitted — easy add post-1.0 if validated.

**Type-consistency check.** `Plan` ('free' | 'plus' | 'pro') matches the `plan` enum in `@perfin/db` and the `usePlan` hook. `Feature` (`@perfin/billing` `FEATURES` constants) is the only thing passed to `PlanGate` and `hasFeature`. `interpretEvent` returns the `InterpretedEvent` shape consumed by the worker's Stripe webhook route. The `pushNotify` payload (`{title, body, url?}`) matches what the service worker reads in its `push` event handler. The web client sends `{endpoint, keys: {p256dh, auth}}` which exactly matches what `pushSubscriptions` columns store.

**Out of scope.** Bank-account-by-account performance breakdowns, investment tracking, crypto wallets, mobile-native iOS/Android (PWA covers this), receipt OCR via Claude Vision (Phase 4 fallback only, not surfaced as a distinct feature), members/RBAC UI (the `members` Pro feature is gated but not yet UI-built; v1 ships single-player with the seam declared).

**Risk notes.**
- *Stripe production*. Test mode is enough for v1. Going live needs a Stripe account in good standing with banking info; the price ids switch from `price_test_*` to `price_live_*`. Webhook secret rotates per-environment.
- *Service worker scope*. The SW lives at `/sw.js` and claims scope `/`. If at any point we serve the marketing site from a separate origin (e.g. `www.perfin.app`), the SW will only apply to whichever origin serves it. Keep them on the same domain at launch.
- *Push notifications by browser*. iOS Safari requires the user to install the PWA first before push works. Settings → Notifications shows an explanatory message in that case (no extra UI build needed; the browser's permission prompt is clear enough).
- *VAPID key rotation*. Rotating `VAPID_PRIVATE_KEY` invalidates all existing subscriptions. v1 does not include a rotation flow. Acceptable; document in `/security`.
- *PWA cache invalidation*. On every deploy, browsers cached against the old SW will continue to receive cached HTML for ~24 hours unless we bump the cache name. Acceptable for a launch-cadence app; if updates need to be instant, change `const CACHE = 'perfin-v1'` to a hash derived from the build id.
- *SOC2 readiness*. The `/security` page is honest about being "in progress." Plaid production access is gated until SOC2 completes; in the meantime users on Plus/Pro use Plaid Sandbox or Development tier — communicate this clearly in the upgrade flow if needed (a small banner on the Bank Connections tab when env=development). v1 ships with Sandbox; production cutover is post-launch infra work.
- *Anonymous demo widget cost*. The live-demo widget runs entirely in the browser using `@perfin/extractors` (CSV only) and the rules engine. No API call, no LLM, no cost — even at viral traffic scale.
