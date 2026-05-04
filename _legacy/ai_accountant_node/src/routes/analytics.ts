import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';

/**
 * Proxy a request to the Python backend, forwarding auth and query params.
 * Returns the parsed JSON body from Python, or throws on failure.
 */
async function proxyToPython(
  path: string,
  req: FastifyRequest,
  reply: FastifyReply,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown,
): Promise<unknown> {
  const url = new URL(path, config.analyticsBackend);

  // Forward query parameters
  const rawQuery = req.query as Record<string, string | undefined>;
  for (const [k, v] of Object.entries(rawQuery)) {
    if (v !== undefined) url.searchParams.set(k, v);
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  // Forward auth header so the Python server can validate it
  const auth = req.headers.authorization;
  if (auth) {
    headers['Authorization'] = auth;
  }

  const fetchInit: RequestInit = { method, headers };
  if (method === 'POST' && body !== undefined) {
    headers['Content-Type'] = 'application/json';
    fetchInit.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(url.toString(), fetchInit);
    const data = await res.json();

    reply.code(res.status);
    return data;
  } catch (err) {
    reply.code(502);
    return { error: `Analytics backend unreachable: ${(err as Error).message}` };
  }
}

export function analyticsRoutes(app: FastifyInstance): void {
  // ─── Analytics ──────────────────────────────────────────────────────────

  app.get('/api/analytics/summary', async (req, reply) =>
    proxyToPython('/api/analytics/summary', req, reply));

  app.get('/api/analytics/monthly', async (req, reply) =>
    proxyToPython('/api/analytics/monthly', req, reply));

  app.get('/api/analytics/categories', async (req, reply) =>
    proxyToPython('/api/analytics/categories', req, reply));

  app.get('/api/analytics/merchants', async (req, reply) =>
    proxyToPython('/api/analytics/merchants', req, reply));

  app.get('/api/analytics/health', async (req, reply) =>
    proxyToPython('/api/analytics/health', req, reply));

  // ─── Detection ──────────────────────────────────────────────────────────

  app.get('/api/anomalies', async (req, reply) =>
    proxyToPython('/api/anomalies', req, reply));

  app.get('/api/recurring', async (req, reply) =>
    proxyToPython('/api/recurring', req, reply));

  // ─── Categorization ─────────────────────────────────────────────────────

  app.post('/api/categorize', async (req, reply) =>
    proxyToPython('/api/categorize', req, reply, 'POST', req.body));
}
