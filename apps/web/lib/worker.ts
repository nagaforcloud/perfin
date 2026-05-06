import { createHmac } from 'node:crypto';

const SECRET = process.env.WORKER_HMAC_SECRET ?? '';
const BASE   = process.env.WORKER_URL ?? 'http://localhost:8001';

export async function callWorker<T>(path: string, body: unknown): Promise<T> {
  if (!SECRET) throw new Error('WORKER_HMAC_SECRET not set');
  const payload = JSON.stringify(body);
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-perfin-sig': sig },
    body: payload,
  });
  if (!res.ok) throw new Error(`worker ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}
