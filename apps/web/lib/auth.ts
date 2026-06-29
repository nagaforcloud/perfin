import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { eq } from 'drizzle-orm';
import { createDb, users } from '@perfin/db';
import { env } from './env';
import { verifyPassword } from './password';
import { makeSignInCallback } from './auth-callbacks';

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
      ? [Google({
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        })]
      : []),
  ],
  callbacks: {
    signIn: makeSignInCallback({
      findUser: async (email) => {
        const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
        return u ?? null;
      },
      insertUser: async (email) => {
        await db.insert(users).values({ email, passwordHash: null, plan: 'free' });
      },
    }),
    async jwt({ token, user, trigger }) {
      // On sign-in/sign-up: record the token issue timestamp for revocation support
      if (user && (trigger === 'signIn' || trigger === 'signUp')) {
        const now = new Date();
        await db.update(users).set({ lastTokenIssuedAt: now }).where(eq(users.id, String(user.id)));
        token.id = user.id;
        return token;
      }

      // On every request: verify the token hasn't been revoked
      if (token.id && token.iat) {
        const [u] = await db.select({ lastTokenIssuedAt: users.lastTokenIssuedAt })
          .from(users).where(eq(users.id, String(token.id)));
        if (u?.lastTokenIssuedAt) {
          const issuedAtMs = token.iat * 1000;
          const revokedMs = u.lastTokenIssuedAt.getTime();
          // If the token was issued before the last revocation, invalidate it
          if (issuedAtMs < revokedMs) {
            return null;
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) (session.user as { id?: string }).id = String(token.id);
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) {
        const path = url.slice(baseUrl.length);
        if (path === '/' || path === '') return `${baseUrl}/app`;
      }
      return url;
    },
  },
});
