import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { createDb, users } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';
import HomeClient from './_HomeClient';

const { db } = createDb(env.DATABASE_URL);
export const dynamic = 'force-dynamic';

export default async function HomeShell() {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) redirect('/login');

  const userId = userIdStr;
  const [user] = await db.select({ onboardedAt: users.onboardedAt }).from(users).where(eq(users.id, userId));
  if (user && !user.onboardedAt) {
    redirect('/onboarding/welcome');
  }

  return <HomeClient />;
}
