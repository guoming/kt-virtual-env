import { describe, expect, it } from 'vitest';
import { isProcessAlive } from './process-utils.js';

describe('isProcessAlive', () => {
  it('returns true for current process', () => {
    expect(isProcessAlive(process.pid)).toBe(true);
  });

  it('returns false for invalid pid', () => {
    expect(isProcessAlive(0)).toBe(false);
    expect(isProcessAlive(-1)).toBe(false);
  });
});
