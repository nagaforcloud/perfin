import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { users } from '@perfin/db';
import { getDb } from '@/lib/db';
import { createStripe, createPortalSession } from '@perfin/billing';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = getDb();
export const runtime = 'nodejs';

export async function POST() {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'billing not configured' }, { status: 503 });
  const userId = userIdStr;
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
