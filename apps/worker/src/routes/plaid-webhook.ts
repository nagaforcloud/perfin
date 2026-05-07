import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { connections, createDb } from '@perfin/db';
import { createPlaid, verifyPlaidWebhook } from '@perfin/connectors';
import { env } from '../env.js';
import { syncOnePlaidConnection } from '../lib/plaid-sync.js';

const { db } = createDb(env.DATABASE_URL);

export async function plaidWebhookRoutes(app: FastifyInstance) {
  app.post('/webhooks/plaid', async (req, reply) => {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (env.PLAID_CLIENT_ID && env.PLAID_SECRET) {
      const client = createPlaid({ clientId: env.PLAID_CLIENT_ID, secret: env.PLAID_SECRET, env: env.PLAID_ENV });
      const ok = await verifyPlaidWebhook({ client, env: env.PLAID_ENV, signatureHeader: req.headers['plaid-verification'] as string | undefined, rawBody: raw });
      if (!ok) return reply.code(401).send({ error: 'invalid signature' });
    }

    const body = req.body as { webhook_type?: string; webhook_code?: string; item_id?: string; error?: { error_code?: string } };

    if (body.webhook_type === 'TRANSACTIONS' && body.webhook_code?.startsWith('SYNC_UPDATES_AVAILABLE')) {
      const [conn] = await db.select().from(connections).where(eq(connections.providerAccountId, body.item_id ?? ''));
      if (conn) {
        try { await syncOnePlaidConnection({ db, connectionId: conn.id }); }
        catch (err) { app.log.error({ err }, 'plaid sync from webhook failed'); }
      } else {
        app.log.warn({ itemId: body.item_id }, 'webhook for unknown item');
      }
    }

    if (body.webhook_type === 'ITEM' && body.webhook_code === 'ERROR') {
      const [conn] = await db.select().from(connections).where(eq(connections.providerAccountId, body.item_id ?? ''));
      if (conn) {
        await db.update(connections).set({ status: 'error', error: body.error?.error_code ?? 'unknown' }).where(eq(connections.id, conn.id));
      }
    }

    return reply.send({ ok: true });
  });
}
