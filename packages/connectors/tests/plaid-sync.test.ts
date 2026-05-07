import { describe, expect, it, vi } from 'vitest';
import { syncTransactions } from '../src/plaid/sync';

describe('syncTransactions', () => {
  it('iterates pages until has_more is false and accumulates', async () => {
    const mock = {
      transactionsSync: vi.fn()
        .mockResolvedValueOnce({ data: { added: [makeTxn('t1')], modified: [], removed: [], next_cursor: 'c1', has_more: true } })
        .mockResolvedValueOnce({ data: { added: [makeTxn('t2'), makeTxn('t3')], modified: [], removed: [], next_cursor: 'c2', has_more: false } }),
    } as unknown as Parameters<typeof syncTransactions>[0]['client'];

    const out = await syncTransactions({ client: mock, accessToken: 'tok', cursor: null });
    expect(out.cursor).toBe('c2');
    expect(out.added).toHaveLength(3);
    expect(mock.transactionsSync).toHaveBeenCalledTimes(2);
  });

  it('passes the previous cursor on the first call', async () => {
    const mock = {
      transactionsSync: vi.fn()
        .mockResolvedValueOnce({ data: { added: [], modified: [], removed: [], next_cursor: 'c1', has_more: false } }),
    } as unknown as Parameters<typeof syncTransactions>[0]['client'];

    await syncTransactions({ client: mock, accessToken: 'tok', cursor: 'prev' });
    expect(mock.transactionsSync).toHaveBeenCalledWith(expect.objectContaining({ access_token: 'tok', cursor: 'prev' }));
  });
});

function makeTxn(id: string) {
  return {
    transaction_id: id, account_id: 'acc', date: '2026-04-01', name: 'X',
    merchant_name: null, amount: 12.34, pending: false, category: null, iso_currency_code: 'USD',
  };
}
