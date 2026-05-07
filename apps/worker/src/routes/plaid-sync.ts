import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createDb } from '@perfin/db';
import { env } from '../env.js';
import { verify } from '../lib/hmac.js';
import { syncOnePlaidConnection } from '../lib/plaid-sync.js';

const Body = z.object({ connectionId: z.number().int().positive() });

const { db } = createDb(env.DATABASE_URL);

export async function plaidSyncRoutes(app: FastifyInstance) {
  app.post('/jobs/plaid-sync', async (req, reply) => {
    const sig = req.headers['x-perfin-sig'];
    if (typeof sig !== 'string') return reply.code(401).send({ error: 'missing signature' });
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!verify(env.WORKER_HMAC_SECRET, raw, sig)) return reply.code(401).send({ error: 'invalid signature' });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const out = await syncOnePlaidConnection({ db, connectionId: parsed.data.connectionId });
      return reply.send({ ok: true, ...out });
    } catch (err) {
      return reply.code(500).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });
}
