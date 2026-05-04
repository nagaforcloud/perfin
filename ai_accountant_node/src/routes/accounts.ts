import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Ledger } from '../db.js';
import { getUserFromRequest } from './auth.js';

/** Extract userId from JWT, default to 1 for backward compat (no auth). */
function uid(req: FastifyRequest): number {
  return getUserFromRequest(req)?.userId ?? 1;
}

const createSchema = z.object({
  name: z.string().min(1),
  bank: z.string().optional(),
  account_type: z.string().optional(),
  currency: z.string().optional(),
  color: z.string().optional(),
});

const updateSchema = z.object({
  bank: z.string().optional(),
  account_type: z.string().optional(),
  currency: z.string().optional(),
  color: z.string().optional(),
});

export function accountsRoutes(app: FastifyInstance, ledger: Ledger): void {
  app.get('/api/accounts', async (req) => ledger.getAccounts(uid(req)));

  app.post('/api/accounts', async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.issues[0]?.message ?? 'Invalid body' };
    }
    const account = ledger.createAccount(parsed.data, uid(req));
    reply.code(201);
    return account;
  });

  app.put('/api/accounts/:name', async (req, reply) => {
    const { name } = req.params as { name: string };
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.issues[0]?.message ?? 'Invalid body' };
    }
    const ok = ledger.updateAccount(name, parsed.data);
    if (!ok) {
      reply.code(404);
      return { error: `Account '${name}' not found` };
    }
    return ledger.getAccountByName(name);
  });

  app.delete('/api/accounts/:name', async (req, reply) => {
    const { name } = req.params as { name: string };
    const ok = ledger.deleteAccount(name);
    if (!ok) {
      reply.code(404);
      return { error: `Account '${name}' not found` };
    }
    reply.code(204);
    return null;
  });
}
