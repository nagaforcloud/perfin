import { describe, expect, it } from 'vitest';
import { sign, verify } from '../src/lib/hmac';

describe('hmac', () => {
  it('sign and verify round-trip', () => {
    const sig = sign('secret', 'hello');
    expect(verify('secret', 'hello', sig)).toBe(true);
  });
  it('rejects tampered body', () => {
    const sig = sign('secret', 'hello');
    expect(verify('secret', 'hello!', sig)).toBe(false);
  });
  it('rejects wrong secret', () => {
    const sig = sign('secret', 'hello');
    expect(verify('other', 'hello', sig)).toBe(false);
  });
});
