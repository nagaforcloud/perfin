import Fastify from 'fastify';
import { env } from './env';
import { healthRoutes } from './routes/health';
import { uploadRoutes } from './routes/upload';
import { streamRoutes } from './routes/stream';

export async function buildServer() {
  const app = Fastify({ logger: true });
  await app.register(healthRoutes);
  await app.register(uploadRoutes);
  await app.register(streamRoutes);
  return app;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  buildServer()
    .then((app) => app.listen({ port: env.WORKER_PORT, host: '0.0.0.0' }))
    .catch((err) => { console.error(err); process.exit(1); });
}
