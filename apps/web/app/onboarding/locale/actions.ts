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
  const userId = userIdStr;
  const currency = String(formData.get('currency') ?? 'INR');

  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) redirect('/login');

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

  if (!u.onboardedAt) {
    await db.update(users).set({ onboardedAt: new Date() }).where(eq(users.id, userId));
  }

  redirect('/onboarding/connect');
}
