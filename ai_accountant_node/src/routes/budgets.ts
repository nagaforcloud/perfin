import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Ledger } from '../db.js';
import { config } from '../config.js';
import { getUserFromRequest } from './auth.js';

function uid(req: FastifyRequest): number {
  return getUserFromRequest(req)?.userId ?? 1;
}

const budgetSchema = z.object({
  category: z.string().min(1),
  amount: z.number().positive(),
  period: z.enum(['monthly', 'weekly', 'yearly']).optional(),
  account: z.string().optional(),
});

export function budgetRoutes(app: FastifyInstance, ledger: Ledger): void {
  // ─── List budgets ──────────────────────────────────────────────────────

  app.get('/api/budgets', async (req) => {
    const account = (req.query as Record<string, string>).account;
    return ledger.listBudgets(account || undefined, uid(req));
  });

  // ─── Budget status — current month spend vs budget ─────────────────────

  app.get('/api/budgets/status', async (req) => {
    const account = (req.query as Record<string, string>).account;
    return ledger.getBudgetStatus(account || undefined, uid(req));
  });

  // ─── Create/update budget ──────────────────────────────────────────────

  app.post('/api/budgets', async (req, reply) => {
    const parsed = budgetSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.issues[0]?.message ?? 'Invalid body' };
    }
    // Validate category
    if (!config.validCategories.includes(parsed.data.category)) {
      reply.code(400);
      return { error: `Invalid category '${parsed.data.category}'` };
    }
    const budget = ledger.upsertBudget(parsed.data, uid(req));
    reply.code(201);
    return budget;
  });

  // ─── Delete budget ─────────────────────────────────────────────────────

  app.delete('/api/budgets/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ok = ledger.deleteBudget(Number(id));
    if (!ok) {
      reply.code(404);
      return { error: `Budget ${id} not found` };
    }
    reply.code(204);
    return null;
  });
}
