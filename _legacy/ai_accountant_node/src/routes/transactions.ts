import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import type { Ledger } from '../db.js';
import { getUserFromRequest } from './auth.js';

function uid(req: FastifyRequest): number {
  return getUserFromRequest(req)?.userId ?? 1;
}

const filtersSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(500).optional().default(50),
  account: z.string().optional(),
  category: z.string().optional(),
  type: z.enum(['income', 'expense']).optional(),
  search: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

const updateSchema = z.object({
  category: z.string().optional(),
  description: z.string().optional(),
});

const bulkSchema = z.object({
  ids: z.array(z.number().int()).min(1),
});

export function transactionsRoutes(app: FastifyInstance, ledger: Ledger): void {
  app.get('/api/transactions', async (req, reply) => {
    const parsed = filtersSchema.safeParse(req.query);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.issues[0]?.message ?? 'Invalid query' };
    }
    const { page, per_page, ...filters } = parsed.data;
    const all = ledger.listTransactions(filters, uid(req));
    const total = all.length;
    const pages = Math.max(1, Math.ceil(total / per_page));
    const start = (page - 1) * per_page;
    return {
      transactions: all.slice(start, start + per_page),
      total,
      page,
      per_page,
      pages,
    };
  });

  app.get('/api/transactions/categories', async () => {
    const inUse = ledger.listCategoriesInUse();
    const merged = new Set<string>([...config.validCategories, ...inUse]);
    return Array.from(merged);
  });

  app.get('/api/transactions/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const row = ledger.getTransaction(id);
    if (!row) {
      reply.code(404);
      return { error: `Transaction ${id} not found` };
    }
    return row;
  });

  app.put('/api/transactions/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.issues[0]?.message ?? 'Invalid body' };
    }
    if (parsed.data.category !== undefined && !(config.validCategories as readonly string[]).includes(parsed.data.category)) {
      reply.code(400);
      return { error: `Invalid category '${parsed.data.category}'` };
    }
    const ok = ledger.updateTransaction(id, parsed.data);
    if (!ok) {
      reply.code(404);
      return { error: `Transaction ${id} not found` };
    }
    return ledger.getTransaction(id);
  });

  app.delete('/api/transactions/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const ok = ledger.deleteTransaction(id);
    if (!ok) {
      reply.code(404);
      return { error: `Transaction ${id} not found` };
    }
    reply.code(204);
    return null;
  });

  app.post('/api/transactions/bulk-delete', async (req, reply) => {
    const parsed = bulkSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.issues[0]?.message ?? 'Invalid body' };
    }
    const deleted = ledger.deleteTransactionsBulk(parsed.data.ids);
    return { deleted };
  });

  // ─── Export ─────────────────────────────────────────────────────────

  app.get('/api/transactions/export', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const format = q.format || 'csv';
    const txns = ledger.listTransactions({
      account: q.account,
      category: q.category,
      start_date: q.start_date,
      end_date: q.end_date,
      search: q.search,
    }, uid(req));

    if (format === 'json') {
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', 'attachment; filename="transactions.json"');
      return txns;
    }

    // CSV export
    const header = 'Date,Description,Amount,Type,Category,Account';
    const rows = txns.map(t =>
      [t.date, `"${t.description.replace(/"/g, '""')}"`, t.amount, t.type, t.category, t.account].join(',')
    );
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="transactions.csv"');
    return [header, ...rows].join('\n');
  });
}
