import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { and, eq, desc } from 'drizzle-orm';
import { accounts, chatMessages, chatThreads, transactions } from '@perfin/db';
import { getDb } from '@/lib/db';
import { buildSystemPrompt, buildTools } from '@perfin/agent';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = getDb();
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return new Response('unauthorized', { status: 401 });
  const userId = userIdStr;

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response('ANTHROPIC_API_KEY not configured', { status: 500 });
  }

  const body = await req.json() as { messages: Array<{ role: string; content: string }>; threadId?: number };

  let threadId = body.threadId;
  if (!threadId) {
    const title = (body.messages[body.messages.length - 1]?.content ?? 'New chat').slice(0, 60);
    const [t] = await db.insert(chatThreads).values({ userId, title }).returning();
    threadId = t!.id;
  } else {
    // Verify the thread belongs to this user — prevents cross-user message injection
    const [t] = await db.select({ id: chatThreads.id })
      .from(chatThreads)
      .where(and(eq(chatThreads.id, threadId), eq(chatThreads.userId, userId)));
    if (!t) return new Response('thread not found', { status: 404 });
  }

  const lastUser = [...body.messages].reverse().find((m) => m.role === 'user');
  if (lastUser) {
    await db.insert(chatMessages).values({
      threadId,
      role: 'user',
      content: lastUser.content,
    });
  }

  const accs = await db.select({ name: accounts.name, currency: accounts.currency }).from(accounts).where(eq(accounts.userId, userId));
  const currency = accs[0]?.currency ?? 'INR';
  const topCats = await db
    .select({ category: transactions.category })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.date))
    .limit(50);
  const uniqueCats = [...new Set(topCats.map((t) => t.category))].slice(0, 8);

  const systemPrompt = buildSystemPrompt({
    currency,
    topCategories: uniqueCats,
    accountNames: accs.map((a) => a.name),
    todayIso: new Date().toISOString().slice(0, 10),
  });

  const tools = buildTools({ userId, db, threadId, currency });

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: systemPrompt,
    messages: body.messages as any,
    tools: tools as any,
    maxSteps: 5,
    onFinish: async ({ text, toolCalls, toolResults }) => {
      await db.insert(chatMessages).values({
        threadId,
        role: 'assistant',
        content: text,
        toolCalls: toolCalls.length ? (toolCalls as unknown as Record<string, unknown>) : null,
        toolResults: toolResults.length ? (toolResults as unknown as Record<string, unknown>) : null,
      });
      await db.update(chatThreads).set({ updatedAt: new Date() }).where(eq(chatThreads.id, threadId));
    },
  });

  return result.toDataStreamResponse({ headers: { 'X-Thread-Id': String(threadId) } });
}
