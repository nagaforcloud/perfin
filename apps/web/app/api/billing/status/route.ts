import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { subscriptions, users } from '@perfin/db';
import { getDb } from '@/lib/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = getDb();
export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = userIdStr;
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
