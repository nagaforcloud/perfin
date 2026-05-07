# Google Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Continue with Google" button to `/login` and `/signup`. First-time Google sign-ups create a `users` row (with `password_hash = null`) and run the existing onboarding; existing email users auto-link the providers via `allowDangerousEmailAccountLinking: true`.

**Architecture:** Keep Auth.js v5 JWT sessions and the manual user-insert pattern (no Drizzle adapter swap). One small migration makes `password_hash` nullable; one shared `GoogleButton` component is rendered conditionally on both auth pages based on env presence; the `signIn` callback verifies the Google email and inserts the user row on first sign-in; the `redirect` callback routes new users to `/onboarding/welcome` and existing users to `/app`. Unverified Google emails are rejected.

**Tech Stack:** Auth.js v5 (next-auth) · Drizzle ORM · Vitest · Playwright. No new dependencies.

**Acceptance:**
1. Visit `/login` with `GOOGLE_CLIENT_ID` set → "Continue with Google" button is visible.
2. Click it → Google consent screen → on approval, new account is created → onboarding runs → land on `/app/transactions`.
3. Existing email user clicks Google → auto-linked → land on `/app`.
4. `/login` without `GOOGLE_CLIENT_ID` set → no Google button renders, no broken click.
5. `pnpm typecheck`, `pnpm test`, `pnpm build` clean. ≥ 4 new unit tests pass.
6. README has a "Google OAuth setup" subsection.
7. Committed + pushed.

---

## File Structure

Files touched in this plan:

```
perfin/
├── packages/
│   └── db/
│       ├── src/schema/users.ts              # MODIFIED (drop .notNull on passwordHash)
│       └── migrations/0003_*.sql            # NEW (generated)
└── apps/
    └── web/
        ├── lib/
        │   ├── auth.ts                      # MODIFIED (signIn + redirect callbacks; allowDangerousEmailAccountLinking)
        │   └── password.ts                  # MODIFIED (verifyPassword tolerates null hash)
        ├── components/
        │   └── auth/GoogleButton.tsx        # NEW
        ├── app/(auth)/
        │   ├── login/page.tsx               # MODIFIED (render button + error banner)
        │   └── signup/page.tsx              # MODIFIED (render button + error banner)
        ├── tests/
        │   ├── auth.test.ts                 # NEW (signIn callback unit tests)
        │   └── e2e/happy-path.spec.ts       # MODIFIED (assert button visible when env set)
        └── README.md                         # MODIFIED (Google OAuth setup subsection — file at repo root)
```

---

## Task 1: Make `users.password_hash` nullable

**Files:**
- Modify: `packages/db/src/schema/users.ts`
- Create: `packages/db/migrations/0003_*.sql` (generated)

- [ ] **Step 1: Modify the schema**

Edit `packages/db/src/schema/users.ts` — change the `passwordHash` column. Replace this line:

```ts
    passwordHash: text('password_hash').notNull(),
```

with:

```ts
    passwordHash: text('password_hash'),
```

- [ ] **Step 2: Generate the migration**

Run from repo root:
```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin pnpm --filter @perfin/db generate
```
Expected: a new file `packages/db/migrations/0003_*.sql` appears containing an `ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;` statement.

- [ ] **Step 3: Apply the migration**

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin pnpm --filter @perfin/db migrate
```
Expected: prints `applying 1 migration`, exits 0.

- [ ] **Step 4: Verify schema in Postgres**

```bash
docker exec -i perfin-postgres-1 psql -U perfin -d perfin -c '\d users' | grep password_hash
```
Expected: line shows `password_hash | text |` (no `not null`).

- [ ] **Step 5: Confirm typecheck still clean**

```bash
pnpm --filter @perfin/db typecheck
```
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/db
git commit -m "feat(db): make users.password_hash nullable (Google OAuth users have no password)"
```

---

## Task 2: `verifyPassword` tolerates null hash

**Files:**
- Modify: `apps/web/lib/password.ts`

- [ ] **Step 1: Read current `password.ts`**

```bash
cat apps/web/lib/password.ts
```
Expected: a `verifyPassword(plain: string, hash: string)` function that calls `bcrypt.compare`.

- [ ] **Step 2: Update the file**

Replace the contents of `apps/web/lib/password.ts` with:

```ts
import bcrypt from 'bcryptjs';

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export function verifyPassword(plain: string, hash: string | null): Promise<boolean> {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @perfin/web typecheck
```
Expected: clean. (The `users.passwordHash` type from `@perfin/db` is now `string | null` after Task 1, so callers feeding it into `verifyPassword` continue to type-check.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/password.ts
git commit -m "feat(web): verifyPassword early-returns false for null hash (Google-only users)"
```

---

## Task 3: Auth.js `signIn` callback (verify email + auto-create user)

**Files:**
- Modify: `apps/web/lib/auth.ts`

- [ ] **Step 1: Read current `auth.ts`**

```bash
cat apps/web/lib/auth.ts
```
Expected: an `NextAuth({...})` config with the `Credentials` provider, optional `Google` provider, and `callbacks: { jwt, session }`.

- [ ] **Step 2: Replace `apps/web/lib/auth.ts`**

```ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { eq } from 'drizzle-orm';
import { createDb, users } from '@perfin/db';
import { env } from './env';
import { verifyPassword } from './password';

const { db } = createDb(env.DATABASE_URL);

const NEW_USER_WINDOW_MS = 30_000;

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
      ? [Google({
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          allowDangerousEmailAccountLinking: true,
        })]
      : []),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== 'google') return true;
      if (!profile?.email) return false;
      if ((profile as { email_verified?: boolean }).email_verified === false) return false;

      const email = profile.email.toLowerCase();
      const [existing] = await db.select().from(users).where(eq(users.email, email));
      if (!existing) {
        await db.insert(users).values({ email, passwordHash: null, plan: 'free' });
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) (session.user as { id?: string }).id = String(token.id);
      return session;
    },
    async redirect({ url, baseUrl }) {
      // After Google sign-in, route brand-new users to onboarding.
      // Anything else (returning users, explicit callbackUrl) keeps default behaviour.
      if (url.startsWith(baseUrl)) {
        const path = url.slice(baseUrl.length);
        // Only intercept the post-OAuth landing (Auth.js default is "/").
        if (path === '/' || path === '') {
          // We can't read the session here — but the only callers landing on "/"
          // post-OAuth are sign-ins. Look up the most recent user activity.
          // Simpler approach: route all post-OAuth landings to /app, and let
          // a separate redirect on /app detect "I'm new" by reading createdAt.
          return `${baseUrl}/app`;
        }
      }
      return url;
    },
  },
});

export const NEW_USER_THRESHOLD_MS = NEW_USER_WINDOW_MS;
```

> The redirect callback in Auth.js v5 doesn't receive user/session info, so we route all post-OAuth landings to `/app`. The "is this user brand new?" check happens inside `/app/page.tsx` (Task 5), reading `users.createdAt` and redirecting to `/onboarding/welcome` if within `NEW_USER_THRESHOLD_MS`.

- [ ] **Step 3: Typecheck**

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 AUTH_URL=http://localhost:3000 WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod pnpm --filter @perfin/web typecheck
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/auth.ts
git commit -m "feat(auth): Google signIn callback (verify email, auto-create user) + linking enabled"
```

---

## Task 4: Unit tests for `signIn` callback

**Files:**
- Create: `apps/web/tests/auth.test.ts`

- [ ] **Step 1: Extract the callback for testing**

The current `signIn` callback closes over `db` (created at module scope). To test it without a live DB, refactor it into a pure function. Modify `apps/web/lib/auth.ts`:

Above the `NextAuth({...})` call, add:

```ts
export interface SignInCallbackDeps {
  findUser: (email: string) => Promise<{ id: number } | null>;
  insertUser: (email: string) => Promise<void>;
}

export function makeSignInCallback(deps: SignInCallbackDeps) {
  return async function signIn({ account, profile }: {
    account: { provider?: string } | null;
    profile?: { email?: string; email_verified?: boolean };
  }) {
    if (account?.provider !== 'google') return true;
    if (!profile?.email) return false;
    if (profile.email_verified === false) return false;

    const email = profile.email.toLowerCase();
    const existing = await deps.findUser(email);
    if (!existing) await deps.insertUser(email);
    return true;
  };
}
```

Then replace the inline `async signIn(...)` callback inside `NextAuth({...})` with:

```ts
    signIn: makeSignInCallback({
      findUser: async (email) => {
        const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
        return u ?? null;
      },
      insertUser: async (email) => {
        await db.insert(users).values({ email, passwordHash: null, plan: 'free' });
      },
    }),
```

- [ ] **Step 2: Write failing test**

Create `apps/web/tests/auth.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { makeSignInCallback } from '../lib/auth';

function makeDeps(found: { id: number } | null) {
  return {
    findUser: vi.fn().mockResolvedValue(found),
    insertUser: vi.fn().mockResolvedValue(undefined),
  };
}

describe('signIn callback', () => {
  it('passes through credentials provider unchanged', async () => {
    const deps = makeDeps(null);
    const cb = makeSignInCallback(deps);
    const ok = await cb({ account: { provider: 'credentials' }, profile: undefined });
    expect(ok).toBe(true);
    expect(deps.findUser).not.toHaveBeenCalled();
    expect(deps.insertUser).not.toHaveBeenCalled();
  });

  it('rejects Google sign-in with no email', async () => {
    const deps = makeDeps(null);
    const cb = makeSignInCallback(deps);
    const ok = await cb({ account: { provider: 'google' }, profile: {} });
    expect(ok).toBe(false);
    expect(deps.insertUser).not.toHaveBeenCalled();
  });

  it('rejects Google sign-in with unverified email', async () => {
    const deps = makeDeps(null);
    const cb = makeSignInCallback(deps);
    const ok = await cb({
      account: { provider: 'google' },
      profile: { email: 'a@b.com', email_verified: false },
    });
    expect(ok).toBe(false);
    expect(deps.insertUser).not.toHaveBeenCalled();
  });

  it('creates new user for first-time verified Google sign-in', async () => {
    const deps = makeDeps(null);
    const cb = makeSignInCallback(deps);
    const ok = await cb({
      account: { provider: 'google' },
      profile: { email: 'NEW@b.com', email_verified: true },
    });
    expect(ok).toBe(true);
    expect(deps.findUser).toHaveBeenCalledWith('new@b.com');
    expect(deps.insertUser).toHaveBeenCalledWith('new@b.com');
  });

  it('does not create user for existing Google email', async () => {
    const deps = makeDeps({ id: 7 });
    const cb = makeSignInCallback(deps);
    const ok = await cb({
      account: { provider: 'google' },
      profile: { email: 'existing@b.com', email_verified: true },
    });
    expect(ok).toBe(true);
    expect(deps.insertUser).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Configure vitest for the web app**

Check whether `apps/web` has a vitest setup:

```bash
ls apps/web/vitest.config.ts apps/web/vitest.config.mjs 2>/dev/null
```

If none exists, create `apps/web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
  },
});
```

Add a `test` script to `apps/web/package.json` (in the `scripts` block):

```json
"test": "vitest run"
```

If `vitest` isn't already a devDependency in `apps/web`, add it:

```json
"vitest": "2.1.4"
```

Run:
```bash
pnpm install
```

- [ ] **Step 4: Run test (expect fail)**

```bash
pnpm --filter @perfin/web test
```
Expected: fails — `makeSignInCallback` import error or first assertion fails.

- [ ] **Step 5: Run test (expect pass)**

After Task 3's refactor in Step 1 above, the callback exists. Re-run:

```bash
pnpm --filter @perfin/web test
```
Expected: 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/auth.ts apps/web/tests/auth.test.ts apps/web/vitest.config.ts apps/web/package.json
git commit -m "test(auth): unit tests for signIn callback (Google email verification + auto-create)"
```

---

## Task 5: New-user redirect to onboarding

**Files:**
- Modify: `apps/web/app/(app)/app/page.tsx`

- [ ] **Step 1: Read the current home page**

```bash
cat apps/web/app/\(app\)/app/page.tsx | head -20
```
Expected: a client component that renders the bento dashboard via `useHome`.

- [ ] **Step 2: Add a server component shim that detects new users**

Replace the existing client `apps/web/app/(app)/app/page.tsx` with the following pattern. First, rename the current file to `_HomeClient.tsx`:

```bash
mv apps/web/app/\(app\)/app/page.tsx apps/web/app/\(app\)/app/_HomeClient.tsx
```

Then create a new `apps/web/app/(app)/app/page.tsx` (server component):

```tsx
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { createDb, users } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';
import HomeClient from './_HomeClient';

const { db } = createDb(env.DATABASE_URL);
export const dynamic = 'force-dynamic';

const NEW_USER_WINDOW_MS = 60_000;

export default async function HomeShell() {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) redirect('/login');

  const userId = Number(userIdStr);
  const [user] = await db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId));
  if (user && Date.now() - user.createdAt.getTime() < NEW_USER_WINDOW_MS) {
    redirect('/onboarding/welcome');
  }

  return <HomeClient />;
}
```

> The `_HomeClient.tsx` keeps the `'use client'` directive and the existing dashboard logic — no changes to its body.

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @perfin/web typecheck
```
Expected: clean.

- [ ] **Step 4: Manual smoke**

Bring up dev:
```bash
pnpm --filter @perfin/web dev
```

Sign up with credentials (existing flow) — confirm you still land on `/onboarding/welcome` (the existing signup action does this; `/app` is only hit after onboarding). After completing onboarding, visiting `/app` should render the bento dashboard, not redirect to onboarding.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(app\)/app
git commit -m "feat(web): server-side shim on /app routes brand-new users to onboarding"
```

---

## Task 6: `GoogleButton` shared component

**Files:**
- Create: `apps/web/components/auth/GoogleButton.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { Button } from '@perfin/ui';

interface GoogleButtonProps {
  callbackUrl?: string;
}

export function GoogleButton({ callbackUrl = '/app' }: GoogleButtonProps) {
  return (
    <form action="/api/auth/signin/google" method="POST" className="w-full">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <Button type="submit" variant="secondary" size="lg" className="w-full">
        <GoogleIcon className="w-4 h-4" /> Continue with Google
      </Button>
    </form>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84c-.21 1.13-.84 2.08-1.79 2.72v2.26h2.9c1.7-1.56 2.69-3.86 2.69-6.62z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.46-.8 5.95-2.18l-2.9-2.26c-.81.54-1.83.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A8.99 8.99 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.97 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.16.29-1.71V4.96H.96A8.99 8.99 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.34l2.58-2.58A8.97 8.97 0 0 0 9 0 8.99 8.99 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
    </svg>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @perfin/web typecheck
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/auth
git commit -m "feat(web): GoogleButton shared component (POST to /api/auth/signin/google)"
```

---

## Task 7: Render button on `/login` (server-gated by env)

**Files:**
- Modify: `apps/web/app/(auth)/login/page.tsx`

- [ ] **Step 1: Read current `login/page.tsx`**

```bash
cat apps/web/app/\(auth\)/login/page.tsx
```
Expected: a `'use client'` component with `useFormState(loginAction, ...)` rendering the credentials form.

- [ ] **Step 2: Split into server + client**

The page currently is a client component. To gate the Google button on the server (read env without exposing it to the browser), split it. Rename the existing page to a client child:

```bash
mv apps/web/app/\(auth\)/login/page.tsx apps/web/app/\(auth\)/login/_LoginForm.tsx
```

In `_LoginForm.tsx`, change the `default export` name from `LoginPage` to `LoginForm`:

Replace the line `export default function LoginPage() {` with:

```tsx
export default function LoginForm() {
```

Now create a new server `apps/web/app/(auth)/login/page.tsx`:

```tsx
import Link from 'next/link';
import { GoogleButton } from '@/components/auth/GoogleButton';
import LoginForm from './_LoginForm';
import { env } from '@/lib/env';

export default async function LoginPage(props: { searchParams: Promise<{ error?: string }> }) {
  const sp = await props.searchParams;
  const googleEnabled = !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET;
  const errorMessage = errorBanner(sp.error);

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="text-sm text-negative bg-negative-soft border border-negative rounded-md p-3">
          {errorMessage}
        </div>
      )}
      {googleEnabled && (
        <>
          <GoogleButton callbackUrl="/app" />
          <div className="flex items-center gap-2 text-xs text-text-subtle">
            <span className="flex-1 border-t border-border" />
            <span>or</span>
            <span className="flex-1 border-t border-border" />
          </div>
        </>
      )}
      <LoginForm />
      <p className="text-sm text-text-muted text-center">
        New here? <Link className="text-accent" href="/signup">Create an account</Link>
      </p>
    </div>
  );
}

function errorBanner(code: string | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case 'OAuthSignin':
    case 'OAuthCallback': return 'Sign-in was cancelled or failed. Please try again.';
    case 'AccessDenied':  return "We couldn't verify your Google email. Try a different account.";
    case 'OAuthAccountNotLinked': return 'That email is already registered with a password. Sign in with email + password instead.';
    default: return 'Something went wrong. Please try again.';
  }
}
```

The "Already have an account?" / "New here?" link in the original `_LoginForm.tsx` is now redundant — remove it from `_LoginForm.tsx`:

In `_LoginForm.tsx`, remove the trailing `<p className="text-sm text-text-muted text-center">...</p>` block (the page-level wrapper above renders it).

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @perfin/web typecheck
```
Expected: clean.

- [ ] **Step 4: Manual smoke (without Google env)**

Restart dev:
```bash
pnpm --filter @perfin/web dev
```
Open `/login`. Expected: only the email/password form, no Google button. Stop dev.

- [ ] **Step 5: Manual smoke (with Google env)**

Set placeholder env vars and restart:
```bash
GOOGLE_CLIENT_ID=placeholder GOOGLE_CLIENT_SECRET=placeholder pnpm --filter @perfin/web dev
```
Open `/login`. Expected: "Continue with Google" button visible above the form. Visit `/login?error=OAuthSignin` — banner shows "Sign-in was cancelled or failed." Stop dev.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(auth\)/login
git commit -m "feat(web): /login renders Google button (env-gated) + error banner"
```

---

## Task 8: Render button on `/signup` (server-gated by env)

**Files:**
- Modify: `apps/web/app/(auth)/signup/page.tsx`

- [ ] **Step 1: Split current `/signup` into server + client**

```bash
mv apps/web/app/\(auth\)/signup/page.tsx apps/web/app/\(auth\)/signup/_SignupForm.tsx
```

In `_SignupForm.tsx`, change `export default function SignupPage() {` to:

```tsx
export default function SignupForm() {
```

…and remove the trailing "Already have an account? Log in" paragraph (the new server page-level wrapper renders it).

Create a new server `apps/web/app/(auth)/signup/page.tsx`:

```tsx
import Link from 'next/link';
import { GoogleButton } from '@/components/auth/GoogleButton';
import SignupForm from './_SignupForm';
import { env } from '@/lib/env';

export default async function SignupPage(props: { searchParams: Promise<{ error?: string }> }) {
  const sp = await props.searchParams;
  const googleEnabled = !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET;
  const errorMessage = errorBanner(sp.error);

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="text-sm text-negative bg-negative-soft border border-negative rounded-md p-3">
          {errorMessage}
        </div>
      )}
      {googleEnabled && (
        <>
          <GoogleButton callbackUrl="/app" />
          <div className="flex items-center gap-2 text-xs text-text-subtle">
            <span className="flex-1 border-t border-border" />
            <span>or</span>
            <span className="flex-1 border-t border-border" />
          </div>
        </>
      )}
      <SignupForm />
      <p className="text-sm text-text-muted text-center">
        Already have an account? <Link className="text-accent" href="/login">Log in</Link>
      </p>
    </div>
  );
}

function errorBanner(code: string | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case 'OAuthSignin':
    case 'OAuthCallback': return 'Sign-in was cancelled or failed. Please try again.';
    case 'AccessDenied':  return "We couldn't verify your Google email. Try a different account.";
    case 'OAuthAccountNotLinked': return 'That email is already registered with a password. Log in with email + password instead.';
    default: return 'Something went wrong. Please try again.';
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @perfin/web typecheck
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(auth\)/signup
git commit -m "feat(web): /signup renders Google button (env-gated) + error banner"
```

---

## Task 9: E2E button visibility + README + acceptance

**Files:**
- Modify: `apps/web/tests/e2e/happy-path.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Append e2e assertion**

Read existing file:
```bash
cat apps/web/tests/e2e/happy-path.spec.ts
```

Append the following test:

```ts
test.describe('Google button visibility', () => {
  test.skip(!process.env.GOOGLE_CLIENT_ID, 'requires GOOGLE_CLIENT_ID');

  test('Continue with Google button visible on /login when env is set', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
  });

  test('Continue with Google button visible on /signup when env is set', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
  });
});
```

- [ ] **Step 2: Update `README.md` — add Google OAuth setup subsection**

Find the "Optional integrations" section. Under it, locate the "Anthropic Claude (AI)" subsection (the first one). Insert this block immediately above it:

```md
### Google OAuth (sign-in / sign-up)

Add a "Continue with Google" button to `/login` and `/signup`.

1. Visit <https://console.cloud.google.com>, create or select a project.
2. APIs & Services → Credentials → **Create Credentials** → **OAuth client ID**.
3. Application type: **Web application**. Name: `Perfin` (or whatever you like).
4. Authorized redirect URIs: add `http://localhost:3000/api/auth/callback/google` for dev, and your production URL `<AUTH_URL>/api/auth/callback/google` for prod.
5. Click **Create**. Copy the Client ID and Client Secret.
6. Set in `.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```
7. Restart `pnpm dev`. The "Continue with Google" button now appears on `/login` and `/signup`.

The first time a user signs in with Google, a `users` row is created (with `password_hash = null`) and they go through the standard 3-step onboarding. If the email already exists with a credentials password, providers are auto-linked (one account, two sign-in methods).

```

- [ ] **Step 3: Run unit tests**

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 AUTH_URL=http://localhost:3000 WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod pnpm test
```
Expected: ≥ 158 prior tests + 5 new auth-callback tests = ≥ 163 total, all passing.

- [ ] **Step 4: Run typecheck and build**

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 AUTH_URL=http://localhost:3000 WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod pnpm typecheck
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 AUTH_URL=http://localhost:3000 WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod pnpm build
```
Expected: both succeed.

- [ ] **Step 5: Run e2e (Google tests will skip without env)**

```bash
DATABASE_URL=postgres://perfin:perfin@localhost:5433/perfin AUTH_SECRET=dev-only-replace-in-prod-with-openssl-rand-hex-32 AUTH_URL=http://localhost:3000 WORKER_HMAC_SECRET=dev-shared-secret-replace-in-prod CRON_DISABLED=1 pnpm --filter @perfin/web test:e2e
```
Expected: all prior e2e tests pass; the two Google-button tests are auto-skipped without env.

- [ ] **Step 6: Manual end-to-end smoke (with real Google credentials)**

This step is the only one that requires real Google credentials. Skip if you haven't created a Google OAuth client yet — the rest of the plan still verifies cleanly.

Set real `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`, restart dev:
```bash
pnpm dev
```

1. Open `http://localhost:3000/signup` → click **Continue with Google** → consent at Google → land on `/onboarding/welcome` → complete the 3-step flow → land on `/app/transactions`.
2. Sign out. Open `http://localhost:3000/login` → click **Continue with Google** with the same email → land on `/app` directly (no second onboarding).

- [ ] **Step 7: Commit**

```bash
git add apps/web/tests/e2e README.md
git commit -m "test(web): e2e Google button visibility; docs(readme): Google OAuth setup"
```

- [ ] **Step 8: Push**

```bash
git push origin main
```

---

## Definition of done

- [ ] All 9 tasks committed
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm build` clean
- [ ] 5 new unit tests pass (`apps/web/tests/auth.test.ts`)
- [ ] E2E: prior tests still pass; new Google-button tests auto-skip without env, run when env is set
- [ ] Manual smoke (with real Google client): signup → onboarding → app; sign-in → app
- [ ] README has the "Google OAuth (sign-in / sign-up)" subsection
- [ ] All changes pushed to `origin/main`

---

## Self-review notes

**Spec coverage check.** Spec §0 (summary) → all tasks. §1 decisions (auto-link, same onboarding, minimal approach) → reflected in Tasks 3, 5, 6. §2 flow → Tasks 3 (signIn callback) + 5 (new-user redirect) + 6-8 (UI). §3 file list — every file mentioned in the spec is touched in this plan: `auth.ts` (T3), `password.ts` (T2), `users.ts` schema (T1), migration (T1), `GoogleButton.tsx` (T6), `login/page.tsx` (T7), `signup/page.tsx` (T8), `auth.test.ts` (T4), `e2e/happy-path.spec.ts` (T9), `README.md` (T9). §4 callback contract → Task 3 + 4. §5 edge cases — verified-Google created (T4 test 4), unverified rejected (T4 test 3), missing email rejected (T4 test 2), credentials passthrough (T4 test 1), env-gated button (T7 + T8), error banner (T7 + T8). §6 configuration → Task 9 README block. §7 testing → Tasks 4 + 9. §8 risks → acknowledged in commit messages and README.

**Type-consistency check.** `users.passwordHash` becomes `string | null` after Task 1, propagating cleanly: `verifyPassword(plain: string, hash: string | null)` in Task 2 accepts the new shape; the Credentials provider's `authorize` callback passes `user.passwordHash` directly into it. `makeSignInCallback`'s `SignInCallbackDeps` interface (Task 4) is consumed only inside `auth.ts` (Task 3). `GoogleButton`'s `callbackUrl` prop is consumed in Tasks 7 and 8.

**Out of scope (deferred to future stories, per spec §9):** Settings → Account page, profile picture / avatar from Google, other OAuth providers (would motivate the Drizzle adapter), Workspace-only domain restriction.

**Risk callout.** Task 3's `redirect` callback no longer runs the new-user-detection logic inline — that moved to Task 5's server shim. This is intentional (Auth.js v5's `redirect` callback doesn't expose user/session) and is the only architectural deviation from the spec; the spec's intent (route brand-new Google users through onboarding) is preserved.
