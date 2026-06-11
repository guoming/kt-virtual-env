import { afterEach, describe, expect, it, vi } from 'vitest';
import { isProcessAlive } from './process-utils.js';

describe('isProcessAlive', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true for current process', () => {
    expect(isProcessAlive(process.pid)).toBe(true);
  });

  it('returns false for invalid pid', () => {
    expect(isProcessAlive(0)).toBe(false);
    expect(isProcessAlive(-1)).toBe(false);
  });

  it('treats EPERM as alive for root-owned processes', () => {
    vi.spyOn(process, 'kill').mockImplementation(() => {
      const err = new Error('kill EPERM') as NodeJS.ErrnoException;
      err.code = 'EPERM';
      throw err;
    });
    expect(isProcessAlive(99_999)).toBe(true);
  });

  it('returns false when process does not exist', () => {
    vi.spyOn(process, 'kill').mockImplementation(() => {
      const err = new Error('kill ESRCH') as NodeJS.ErrnoException;
      err.code = 'ESRCH';
      throw err;
    });
    expect(isProcessAlive(99_999)).toBe(false);
  });
});
