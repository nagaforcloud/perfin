import type { FastifyInstance } from 'fastify';
import { isDone, subscribe } from '../lib/jobs';

export async function streamRoutes(app: FastifyInstance) {
  app.get('/jobs/:id/stream', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'bad id' });

    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });

    const send = (e: unknown) => {
      reply.raw.write(`data: ${JSON.stringify(e)}\n\n`);
    };

    const unsubscribe = subscribe(id, (event) => {
      send(event);
      if (event.status === 'done' || event.status === 'failed') {
        reply.raw.end();
      }
    });

    if (isDone(id)) reply.raw.end();

    req.raw.on('close', unsubscribe);
  });
}
