import { z } from 'zod';
import { resolve } from 'node:path';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  WORKER_PORT: z.coerce.number().int().positive().default(8001),
  WORKER_HMAC_SECRET: z.string().min(8),
  UPLOAD_DIR: z.string().default(resolve(process.cwd(), 'data/uploads')),
  ANTHROPIC_API_KEY: z.string().optional(),
  CRON_DISABLED: z.string().optional(),
  CRON_NIGHTLY: z.string().default('0 2 * * *'),
  CRON_HOURLY:  z.string().default('0 * * * *'),
  KMS_KEY: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  PLAID_CLIENT_ID: z.string().optional(),
  PLAID_SECRET: z.string().optional(),
  PLAID_ENV: z.enum(['sandbox', 'development', 'production']).default('sandbox'),
  POSTMARK_INBOUND_USER: z.string().optional(),
  POSTMARK_INBOUND_PASS: z.string().optional(),
  EMAIL_DOMAIN: z.string().default('in.perfin.app'),
  EMAIL_HASH_SECRET: z.string().min(8).default('dev-email-hash-secret'),
});

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  WORKER_PORT: process.env.WORKER_PORT,
  WORKER_HMAC_SECRET: process.env.WORKER_HMAC_SECRET,
  UPLOAD_DIR: process.env.UPLOAD_DIR,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  CRON_DISABLED: process.env.CRON_DISABLED,
  CRON_NIGHTLY: process.env.CRON_NIGHTLY,
  CRON_HOURLY: process.env.CRON_HOURLY,
  KMS_KEY: process.env.KMS_KEY,
  PLAID_CLIENT_ID: process.env.PLAID_CLIENT_ID,
  PLAID_SECRET: process.env.PLAID_SECRET,
  PLAID_ENV: process.env.PLAID_ENV,
  POSTMARK_INBOUND_USER: process.env.POSTMARK_INBOUND_USER,
  POSTMARK_INBOUND_PASS: process.env.POSTMARK_INBOUND_PASS,
  EMAIL_DOMAIN: process.env.EMAIL_DOMAIN,
  EMAIL_HASH_SECRET: process.env.EMAIL_HASH_SECRET,
});
