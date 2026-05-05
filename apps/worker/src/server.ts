import Fastify from 'fastify';
import { env } from './env.js';
import { healthRoutes } from './routes/health.js';

export async function buildServer() {
  const app = Fastify({ logger: true });
  await app.register(healthRoutes);
  return app;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  buildServer()
    .then((app) => app.listen({ port: env.WORKER_PORT, host: '0.0.0.0' }))
    .catch((err) => { console.error(err); process.exit(1); });
}
