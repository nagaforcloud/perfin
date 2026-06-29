import webPush from 'web-push';
import { eq } from 'drizzle-orm';
import { createDb, pushSubscriptions } from '@perfin/db';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPushNotification(
  payload: PushPayload,
  opts: { userId: string },
): Promise<number> {
  const { db } = createDb(process.env.DATABASE_URL!);
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, opts.userId));
  if (!subs.length) return 0;

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return 0;
  webPush.setVapidDetails(VAPID_SUBJECT ?? 'mailto:hello@perfin.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  let sent = 0;
  for (const sub of subs) {
    try {
      await webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: payload.title, body: payload.body, url: payload.url ?? '/' }),
      );
      sent++;
    } catch (err) {
      // If 410 Gone, remove the subscription
      if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint));
      }
    }
  }
  return sent;
}
