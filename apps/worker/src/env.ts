import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  WORKER_PORT: z.coerce.number().int().positive().default(8001),
  WORKER_HMAC_SECRET: z.string().min(8),
});

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  WORKER_PORT: process.env.WORKER_PORT,
  WORKER_HMAC_SECRET: process.env.WORKER_HMAC_SECRET,
});
