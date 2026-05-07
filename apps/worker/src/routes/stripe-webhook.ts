import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { createDb, subscriptions, users } from '@perfin/db';
import { createStripe, interpretEvent } from '@perfin/billing';
import { env } from '../env.js';

const { db } = createDb(env.DATABASE_URL);

export async function stripeWebhookRoutes(app: FastifyInstance) {
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
