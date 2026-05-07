import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { createDb, inboundEmails, transactions, users } from '@perfin/db';
import { addressForUser, parseInboundEmail, parseUserHash, verifyBasicAuth } from '@perfin/connectors';
import { rupeesToCents } from '@perfin/core';
import { env } from '../env.js';

const { db } = createDb(env.DATABASE_URL);

export async function postmarkWebhookRoutes(app: FastifyInstance) {
  app.post('/webhooks/postmark', async (req, reply) => {
    if (env.POSTMARK_INBOUND_USER && env.POSTMARK_INBOUND_PASS) {
      const ok = verifyBasicAuth(req.headers.authorization, env.POSTMARK_INBOUND_USER, env.POSTMARK_INBOUND_PASS);
      if (!ok) return reply.code(401).send({ error: 'unauthorized' });
    }

    const body = req.body as {
      ToFull?: Array<{ Email: string }>;
      From: string;
      Subject?: string;
      TextBody?: string;
      HtmlBody?: string;
      MessageID?: string;
    };

    const toAddr = body.ToFull?.[0]?.Email ?? '';
    const hash = parseUserHash(toAddr);
    if (!hash) return reply.send({ ok: true, skipped: 'no-perfin-address' });

    const allUsers = await db.select({ id: users.id }).from(users);
    const matched = allUsers.find((u) => addressForUser({ userId: u.id, secret: env.EMAIL_HASH_SECRET, domain: env.EMAIL_DOMAIN }) === toAddr);
    if (!matched) return reply.send({ ok: true, skipped: 'unknown-user' });

    const text = body.TextBody ?? body.HtmlBody ?? '';
    const parsed = parseInboundEmail({ from: body.From, subject: body.Subject ?? '', body: text });

    const [emailRow] = await db.insert(inboundEmails).values({
      userId: matched.id,
      from: body.From,
      subject: body.Subject ?? '',
      bodyHash: body.MessageID ?? Buffer.from(text).toString('base64').slice(0, 64),
      status: parsed ? 'parsed' : 'failed',
      error: parsed ? null : 'no parser matched',
    }).returning();

    if (parsed && emailRow) {
      const [txn] = await db.insert(transactions).values({
        userId: matched.id,
        date: parsed.date,
        description: parsed.description,
        rawDescription: parsed.description,
        amountCents: rupeesToCents(parsed.amount),
        category: 'Needs Review',
        sourceEmailId: emailRow.id,
      }).onConflictDoNothing().returning();

      if (txn) {
        await db.update(inboundEmails).set({ parsedTxnId: txn.id }).where(eq(inboundEmails.id, emailRow.id));
      }
    }

    return reply.send({ ok: true, parsed: !!parsed });
  });
}
