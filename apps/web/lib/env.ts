import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(16),
  AUTH_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  WORKER_URL: z.string().url().default('http://localhost:8001'),
  WORKER_HMAC_SECRET: z.string().min(8),
  ANTHROPIC_API_KEY: z.string().optional(),
});

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_URL: process.env.AUTH_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  WORKER_URL: process.env.WORKER_URL,
  WORKER_HMAC_SECRET: process.env.WORKER_HMAC_SECRET,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
});
