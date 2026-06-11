import { describe, it, expect } from 'vitest';
import { buildHealthResult } from './health.js';

describe('buildHealthResult', () => {
  it('builds result with level and timestamp', () => {
    const r = buildHealthResult('degraded', '部分异常', ['detail']);
    expect(r.level).toBe('degraded');
    expect(r.ok).toBe(false);
    expect(r.message).toBe('部分异常');
    expect(r.details).toEqual(['detail']);
    expect(r.checkedAt).toBeTruthy();
  });
});
