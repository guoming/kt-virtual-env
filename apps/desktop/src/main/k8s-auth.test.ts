import { describe, expect, it } from 'vitest';
import { parseAuthCanI } from './k8s-auth.js';

describe('parseAuthCanI', () => {
  it('returns true for yes', () => {
    expect(parseAuthCanI('yes\n')).toBe(true);
    expect(parseAuthCanI('Yes')).toBe(true);
  });

  it('returns false for no or empty', () => {
    expect(parseAuthCanI('no')).toBe(false);
    expect(parseAuthCanI('')).toBe(false);
  });
});
