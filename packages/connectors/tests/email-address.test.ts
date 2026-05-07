import { describe, expect, it } from 'vitest';
import { addressForUser, parseUserHash } from '../src/email-address';

describe('addressForUser', () => {
  it('derives a stable u_<hash>@domain', () => {
    const a = addressForUser({ userId: 1, secret: 'secret', domain: 'in.perfin.app' });
    const b = addressForUser({ userId: 1, secret: 'secret', domain: 'in.perfin.app' });
    expect(a).toBe(b);
    expect(a).toMatch(/^u_[a-f0-9]{16}@in\.perfin\.app$/);
  });
  it('changes with userId', () => {
    const a = addressForUser({ userId: 1, secret: 'secret', domain: 'in.perfin.app' });
    const b = addressForUser({ userId: 2, secret: 'secret', domain: 'in.perfin.app' });
    expect(a).not.toBe(b);
  });
  it('changes with secret', () => {
    const a = addressForUser({ userId: 1, secret: 'one', domain: 'in.perfin.app' });
    const b = addressForUser({ userId: 1, secret: 'two', domain: 'in.perfin.app' });
    expect(a).not.toBe(b);
  });
});

describe('parseUserHash', () => {
  it('extracts hash from full address', () => {
    expect(parseUserHash('u_a1b2c3d4e5f60708@in.perfin.app')).toBe('a1b2c3d4e5f60708');
  });
  it('returns null for non-perfin addresses', () => {
    expect(parseUserHash('user@example.com')).toBeNull();
  });
});
