import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify, { type FastifyInstance } from 'fastify';
import { config } from './config.js';
import { Ledger } from './db.js';
import { accountsRoutes } from './routes/accounts.js';
import { transactionsRoutes } from './routes/transactions.js';
import { uploadRoutes } from './routes/upload.js';
import { analyticsRoutes } from './routes/analytics.js';
import { budgetRoutes } from './routes/budgets.js';
import { authRoutes } from './routes/auth.js';

export interface AppHandle {
  app: FastifyInstance;
  ledger: Ledger;
}

export async function buildApp(overrides: { ledger?: Ledger } = {}): Promise<AppHandle> {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
  const ledger = overrides.ledger ?? new Ledger();

  await app.register(cors, { origin: true });
  await app.register(multipart, { limits: { fileSize: config.maxUploadBytes } });

  // Auth middleware — skip if no API key configured
  if (config.apiKey) {
    app.addHook('onRequest', async (request, reply) => {
      if (request.url === '/api/health') return;
      if (request.url?.startsWith('/api/auth/')) return;
      if (request.method === 'OPTIONS') return;
      const auth = request.headers.authorization ?? '';
      const expected = `Bearer ${config.apiKey}`;
      if (auth !== expected) {
        reply.code(401).send({ error: 'Unauthorized — valid API key required' });
      }
    });
  }

  app.get('/api/health', async () => ({ ok: true }));
  app.get('/api/categories', async () => config.validCategories);

  accountsRoutes(app, ledger);
  transactionsRoutes(app, ledger);
  uploadRoutes(app, ledger);
  analyticsRoutes(app);
  budgetRoutes(app, ledger);
  authRoutes(app, ledger);

  app.addHook('onClose', async () => { ledger.close(); });

  return { app, ledger };
}
