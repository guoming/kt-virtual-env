import { describe, expect, it } from 'vitest';
import { resolveStainVirtualEnv } from './stain-virtual-env.js';

describe('resolveStainVirtualEnv', () => {
  it('appends mesh user id for cluster base', () => {
    expect(resolveStainVirtualEnv('dev.v1', 'guoming')).toBe('dev.v1.guoming');
  });

  it('keeps full value unchanged', () => {
    expect(resolveStainVirtualEnv('dev.v1.guoming', 'guoming')).toBe('dev.v1.guoming');
  });

  it('returns trimmed custom value when user id missing', () => {
    expect(resolveStainVirtualEnv('dev.v1.custom', '')).toBe('dev.v1.custom');
  });
});
