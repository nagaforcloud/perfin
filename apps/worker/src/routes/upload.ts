import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { env } from '../env';
import { verify } from '../lib/hmac';
import { createJob, emit } from '../lib/jobs';
import { runPipeline } from '../lib/pipeline';

const Body = z.object({
  userId: z.number().int().positive(),
  uploadJobId: z.number().int().nonnegative(),
  filePath: z.string().min(1),
  fileName: z.string().min(1),
});

export async function uploadRoutes(app: FastifyInstance) {
  app.post('/jobs/upload', async (req: FastifyRequest, reply) => {
    const sig = req.headers['x-perfin-sig'];
    if (typeof sig !== 'string') {
      return reply.code(401).send({ error: 'missing signature' });
    }
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!verify(env.WORKER_HMAC_SECRET, raw, sig)) {
      return reply.code(401).send({ error: 'invalid signature' });
    }

    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { userId, uploadJobId, filePath, fileName } = parsed.data;

    createJob(uploadJobId);
    emit(uploadJobId, { status: 'queued' });

    void (async () => {
      try {
        const buffer = await readFile(filePath);
        await runPipeline({ buffer, fileName, userId, uploadJobId });
      } catch (err) {
        emit(uploadJobId, {
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    return reply.code(202).send({ accepted: true, uploadJobId });
  });
}
