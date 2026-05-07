import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encryptString, decryptString } from '../src/crypto';

const key = randomBytes(32).toString('hex');

describe('encryptString / decryptString', () => {
  it('round-trips a value', () => {
    const ct = encryptString(key, 'access-sandbox-abc123');
    expect(ct).not.toContain('access');
    expect(decryptString(key, ct)).toBe('access-sandbox-abc123');
  });
  it('produces different ciphertext each call (random iv)', () => {
    const a = encryptString(key, 'same-input');
    const b = encryptString(key, 'same-input');
    expect(a).not.toBe(b);
    expect(decryptString(key, a)).toBe('same-input');
    expect(decryptString(key, b)).toBe('same-input');
  });
  it('rejects tampered ciphertext', () => {
    const ct = encryptString(key, 'secret');
    const tampered = ct.slice(0, -2) + 'aa';
    expect(() => decryptString(key, tampered)).toThrow();
  });
  it('rejects wrong key', () => {
    const ct = encryptString(key, 'secret');
    const otherKey = randomBytes(32).toString('hex');
    expect(() => decryptString(otherKey, ct)).toThrow();
  });
});
