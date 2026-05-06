import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { createDb, uploadJobs, users } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';
import { callWorker } from '@/lib/worker';

const UPLOAD_DIR = resolve(process.cwd(), '../..', 'data/uploads');
const { db } = createDb(env.DATABASE_URL);

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);

  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) return NextResponse.json({ error: 'user not found' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file required' }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'file too large (10MB max)' }, { status: 413 });

  await mkdir(UPLOAD_DIR, { recursive: true });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = resolve(UPLOAD_DIR, `${randomUUID()}-${safeName}`);
  await writeFile(path, Buffer.from(await file.arrayBuffer()));

  const [job] = await db.insert(uploadJobs).values({
    userId,
    fileName: file.name,
    mime: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    status: 'queued',
  }).returning();
  if (!job) return NextResponse.json({ error: 'job create failed' }, { status: 500 });

  await callWorker('/jobs/upload', {
    userId,
    uploadJobId: job.id,
    filePath: path,
    fileName: file.name,
  });

  return NextResponse.json({ uploadJobId: job.id });
}
