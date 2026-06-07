import { describe, it, expect } from 'vitest';
import { buildHealthResult } from './health.js';

describe('buildHealthResult', () => {
  it('includes optional recovery fields when provided', () => {
    const r = buildHealthResult('degraded', '部分异常', ['detail'], {
      recovering: true,
      autoRecoveryCount: 2,
    });
    expect(r.recovering).toBe(true);
    expect(r.autoRecoveryCount).toBe(2);
  });
});
