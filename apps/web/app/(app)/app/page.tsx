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
