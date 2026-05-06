import { describe, expect, it } from 'vitest';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { buildServer } from '../src/server';
import { sign } from '../src/lib/hmac';

const SECRET = process.env.WORKER_HMAC_SECRET ?? 'dev-shared-secret-replace-in-prod';

describe('POST /jobs/upload', () => {
  it('rejects without signature', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'POST', url: '/jobs/upload', payload: {} });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('accepts signed payload, returns job id', async () => {
    const dir = resolve(tmpdir(), `perfin-test-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    const path = resolve(dir, 'apr.csv');
    await writeFile(path, 'Date,Description,Amount\n2026-04-01,Swiggy,-450\n');
    const body = { userId: 1, uploadJobId: 0, filePath: path, fileName: 'apr.csv' };
    const payload = JSON.stringify(body);
    const sig = sign(SECRET, payload);

    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/jobs/upload',
      headers: { 'content-type': 'application/json', 'x-perfin-sig': sig },
      payload,
    });
    expect(res.statusCode).toBe(202);
    const json = res.json();
    expect(json.accepted).toBe(true);
    await app.close();
  });
});
