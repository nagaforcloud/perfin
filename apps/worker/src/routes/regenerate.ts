import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { users, type Db } from '@perfin/db';
import { env } from '../env';
import { verify } from '../lib/hmac';
import { regenerateForUser } from '../lib/regenerate';

const Body = z.object({
  userId: z.string().min(1),
  withNarrative: z.boolean().optional(),
});

export async function regenerateRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;
  app.post('/jobs/regenerate', async (req, reply) => {
    const sig = req.headers['x-perfin-sig'];
    if (typeof sig !== 'string') return reply.code(401).send({ error: 'missing signature' });
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!verify(env.WORKER_HMAC_SECRET, raw, sig)) return reply.code(401).send({ error: 'invalid signature' });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const [user] = await db.select().from(users).where(eq(users.id, parsed.data.userId));
    if (!user) return reply.code(404).send({ error: 'user not found' });
    const out = await regenerateForUser({
      userId: user.id,
      db,
      currency: 'INR',
      withNarrative: parsed.data.withNarrative,
    });
    return reply.send({ ok: true, ...out });
  });
}
