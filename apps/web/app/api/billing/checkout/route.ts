import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { users } from '@perfin/db';
import { getDb } from '@/lib/db';
import { createStripe, createCheckoutSession } from '@perfin/billing';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = getDb();
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_PLUS || !env.STRIPE_PRICE_PRO) {
    return NextResponse.json({ error: 'billing not configured' }, { status: 503 });
  }
  const userId = userIdStr;
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
