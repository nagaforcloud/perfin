import { createHmac, timingSafeEqual } from 'node:crypto';

export function sign(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export function verify(secret: string, body: string, signature: string): boolean {
  const expected = sign(secret, body);
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}
