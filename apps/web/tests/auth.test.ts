import { describe, expect, it, vi } from 'vitest';
import { makeSignInCallback } from '../lib/auth-callbacks';

function makeDeps(found: { id: number } | null) {
  return {
    findUser: vi.fn().mockResolvedValue(found),
    insertUser: vi.fn().mockResolvedValue(undefined),
  };
}

describe('signIn callback', () => {
  it('passes through credentials provider unchanged', async () => {
    const deps = makeDeps(null);
    const cb = makeSignInCallback(deps);
    const ok = await cb({ account: { provider: 'credentials', type: 'credentials', providerAccountId: '' }, profile: undefined });
    expect(ok).toBe(true);
    expect(deps.findUser).not.toHaveBeenCalled();
    expect(deps.insertUser).not.toHaveBeenCalled();
  });

  it('rejects Google sign-in with no email', async () => {
    const deps = makeDeps(null);
    const cb = makeSignInCallback(deps);
    const ok = await cb({ account: { provider: 'google', type: 'oauth', providerAccountId: '123' }, profile: {} });
    expect(ok).toBe(false);
    expect(deps.insertUser).not.toHaveBeenCalled();
  });

  it('rejects Google sign-in with unverified email', async () => {
    const deps = makeDeps(null);
    const cb = makeSignInCallback(deps);
    const ok = await cb({
      account: { provider: 'google', type: 'oauth', providerAccountId: '123' },
      profile: { email: 'a@b.com', email_verified: false } as any,
    });
    expect(ok).toBe(false);
    expect(deps.insertUser).not.toHaveBeenCalled();
  });

  it('creates new user for first-time verified Google sign-in', async () => {
    const deps = makeDeps(null);
    const cb = makeSignInCallback(deps);
    const ok = await cb({
      account: { provider: 'google', type: 'oauth', providerAccountId: '123' },
      profile: { email: 'NEW@b.com', email_verified: true } as any,
    });
    expect(ok).toBe(true);
    expect(deps.findUser).toHaveBeenCalledWith('new@b.com');
    expect(deps.insertUser).toHaveBeenCalledWith('new@b.com');
  });

  it('does not create user for existing Google email', async () => {
    const deps = makeDeps({ id: 7 });
    const cb = makeSignInCallback(deps);
    const ok = await cb({
      account: { provider: 'google', type: 'oauth', providerAccountId: '123' },
      profile: { email: 'existing@b.com', email_verified: true } as any,
    });
    expect(ok).toBe(true);
    expect(deps.insertUser).not.toHaveBeenCalled();
  });
});
