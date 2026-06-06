import { describe, expect, it } from 'vitest';
import { buildHealthResult } from '@kt-virtual-env/shared';
import { summarizeHealth } from './health-utils';

describe('summarizeHealth', () => {
  it('returns healthy when all checks pass', () => {
    const summary = summarizeHealth([
      buildHealthResult('healthy', 'a', []),
      buildHealthResult('healthy', 'b', []),
    ]);
    expect(summary?.level).toBe('healthy');
    expect(summary?.message).toContain('2');
  });

  it('returns worst level among results', () => {
    const summary = summarizeHealth([
      buildHealthResult('healthy', 'a', []),
      buildHealthResult('unhealthy', 'b', []),
    ]);
    expect(summary?.level).toBe('unhealthy');
  });
});
