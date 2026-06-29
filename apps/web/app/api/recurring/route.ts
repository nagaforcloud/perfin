import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { recurringSeries } from '@perfin/db';
import { formatCurrency } from '@perfin/core';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';

const { db } = getDb();
export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = userIdStr;

  const rows = await db.select().from(recurringSeries).where(eq(recurringSeries.userId, userId));
  return NextResponse.json({
    rows: rows.map((r) => ({ ...r, amountFormatted: formatCurrency(r.amountCents, 'INR') })),
  });
}
