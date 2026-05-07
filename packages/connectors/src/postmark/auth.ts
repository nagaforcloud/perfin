import { timingSafeEqual } from 'node:crypto';

export function verifyBasicAuth(headerValue: string | undefined, expectedUser: string, expectedPass: string): boolean {
  if (!headerValue || !headerValue.startsWith('Basic ')) return false;
  const decoded = Buffer.from(headerValue.slice(6), 'base64').toString('utf8');
  const [user, ...rest] = decoded.split(':');
  const pass = rest.join(':');
  if (!user || !pass) return false;
  const userOk = bufferEq(Buffer.from(user), Buffer.from(expectedUser));
  const passOk = bufferEq(Buffer.from(pass), Buffer.from(expectedPass));
  return userOk && passOk;
}

function bufferEq(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
