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
          allowDangerousEmailAccountLinking: true,
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
    async jwt({ token, user }) {
      if (user) token.id = user.id;
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
