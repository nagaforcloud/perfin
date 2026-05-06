import { z } from 'zod';
import { resolve } from 'node:path';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  WORKER_PORT: z.coerce.number().int().positive().default(8001),
  WORKER_HMAC_SECRET: z.string().min(8),
  UPLOAD_DIR: z.string().default(resolve(process.cwd(), 'data/uploads')),
  ANTHROPIC_API_KEY: z.string().optional(),
});

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  WORKER_PORT: process.env.WORKER_PORT,
  WORKER_HMAC_SECRET: process.env.WORKER_HMAC_SECRET,
  UPLOAD_DIR: process.env.UPLOAD_DIR,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
});
