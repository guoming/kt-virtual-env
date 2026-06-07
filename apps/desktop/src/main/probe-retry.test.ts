import { describe, it, expect, vi } from 'vitest';
import { retryUntilPass } from './probe-retry.js';

describe('retryUntilPass', () => {
  it('returns true on first success', async () => {
    const fn = vi.fn().mockResolvedValue(true);
    expect(await retryUntilPass(fn)).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries until success', async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    expect(await retryUntilPass(fn, { attempts: 5, intervalMs: 1 })).toBe(true);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('returns false after all attempts fail', async () => {
    const fn = vi.fn().mockResolvedValue(false);
    expect(await retryUntilPass(fn, { attempts: 3, intervalMs: 1 })).toBe(false);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
