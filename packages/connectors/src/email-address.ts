import { createHmac } from 'node:crypto';

export interface AddressInput {
  userId: string;
  secret: string;
  domain: string;
}

export function addressForUser({ userId, secret, domain }: AddressInput): string {
  const hash = createHmac('sha256', secret).update(`user:${userId}`).digest('hex').slice(0, 16);
  return `u_${hash}@${domain}`;
}

export function parseUserHash(address: string): string | null {
  const m = /^u_([a-f0-9]{16})@/i.exec(address);
  return m?.[1] ?? null;
}

export function findUserByAddress<T extends { id: string }>(
  users: T[],
  address: string,
  secret: string,
  domain: string,
): T | null {
  const hash = parseUserHash(address);
  if (!hash) return null;
  for (const u of users) {
    if (addressForUser({ userId: u.id, secret, domain }).startsWith(`u_${hash}@`)) return u;
  }
  return null;
}
