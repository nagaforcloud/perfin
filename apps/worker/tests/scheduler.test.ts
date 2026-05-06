import { describe, expect, it, vi } from 'vitest';
import { startScheduler } from '../src/lib/scheduler';

describe('startScheduler', () => {
  it('does nothing when disabled', () => {
    const job = vi.fn();
    const stop = startScheduler({ disabled: true, schedule: '* * * * *', job });
    expect(typeof stop).toBe('function');
    stop();
    expect(job).not.toHaveBeenCalled();
  });
  it('returns a stop function when enabled', () => {
    const stop = startScheduler({ disabled: false, schedule: '0 2 * * *', job: () => undefined });
    expect(typeof stop).toBe('function');
    stop();
  });
});
