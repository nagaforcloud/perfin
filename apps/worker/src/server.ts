import Fastify from 'fastify';
import { eq } from 'drizzle-orm';
import { connections, createDb, users } from '@perfin/db';
import { env } from './env';
import { healthRoutes } from './routes/health';
import { uploadRoutes } from './routes/upload';
import { streamRoutes } from './routes/stream';
import { regenerateRoutes } from './routes/regenerate';
import { plaidSyncRoutes } from './routes/plaid-sync';
import { plaidWebhookRoutes } from './routes/plaid-webhook';
import { postmarkWebhookRoutes } from './routes/postmark-webhook';
import { startScheduler } from './lib/scheduler';
import { regenerateForUser } from './lib/regenerate';
import { syncOnePlaidConnection } from './lib/plaid-sync';

export async function buildServer() {
  const app = Fastify({ logger: true });
  await app.register(healthRoutes);
  await app.register(uploadRoutes);
  await app.register(streamRoutes);
  await app.register(regenerateRoutes);
  await app.register(plaidSyncRoutes);
  await app.register(plaidWebhookRoutes);
  await app.register(postmarkWebhookRoutes);
  return app;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  buildServer()
    .then(async (app) => {
      const { db } = createDb(env.DATABASE_URL);

      const stopNightly = startScheduler({
        disabled: !!env.CRON_DISABLED,
        schedule: env.CRON_NIGHTLY,
        job: async () => {
          app.log.info('nightly: regenerating insights for all users');
          const all = await db.select().from(users);
          for (const u of all) {
            try { await regenerateForUser({ userId: u.id, db, currency: 'INR', withNarrative: true }); }
            catch (err) { app.log.error({ err, userId: u.id }, 'nightly regenerate failed'); }
          }
        },
      });

      const stopHourly = startScheduler({
        disabled: !!env.CRON_DISABLED,
        schedule: env.CRON_HOURLY,
        job: async () => {
          app.log.info('hourly: syncing Plaid connections');
          const conns = await db.select().from(connections).where(eq(connections.status, 'active'));
          for (const c of conns) {
            if (c.provider !== 'plaid') continue;
            try { await syncOnePlaidConnection({ db, connectionId: c.id }); }
            catch (err) { app.log.error({ err, connectionId: c.id }, 'hourly Plaid sync failed'); }
          }
        },
      });

      app.addHook('onClose', async () => { stopNightly(); stopHourly(); });
      return app.listen({ port: env.WORKER_PORT, host: '0.0.0.0' });
    })
    .catch((err) => { console.error(err); process.exit(1); });
}
