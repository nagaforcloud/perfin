import Fastify from 'fastify';
import { eq } from 'drizzle-orm';
import { createDb, users } from '@perfin/db';
import { env } from './env';
import { healthRoutes } from './routes/health';
import { uploadRoutes } from './routes/upload';
import { streamRoutes } from './routes/stream';
import { regenerateRoutes } from './routes/regenerate';
import { startScheduler } from './lib/scheduler';
import { regenerateForUser } from './lib/regenerate';

export async function buildServer() {
  const app = Fastify({ logger: true });
  await app.register(healthRoutes);
  await app.register(uploadRoutes);
  await app.register(streamRoutes);
  await app.register(regenerateRoutes);
  return app;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  buildServer()
    .then(async (app) => {
      const { db } = createDb(env.DATABASE_URL);
      const stop = startScheduler({
        disabled: !!env.CRON_DISABLED,
        schedule: env.CRON_NIGHTLY,
        job: async () => {
          app.log.info('nightly: regenerating insights for all users');
          const all = await db.select().from(users);
          for (const u of all) {
            try {
              await regenerateForUser({ userId: u.id, db, currency: 'INR', withNarrative: true });
            } catch (err) {
              app.log.error({ err, userId: u.id }, 'nightly regenerate failed');
            }
          }
        },
      });
      app.addHook('onClose', async () => stop());
      return app.listen({ port: env.WORKER_PORT, host: '0.0.0.0' });
    })
    .catch((err) => { console.error(err); process.exit(1); });
}
