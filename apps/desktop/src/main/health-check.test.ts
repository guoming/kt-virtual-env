import { describe, expect, it } from 'vitest';
import { buildHealthResult, type Session } from '@kt-virtual-env/shared';
import { CONNECT_HEALTH_GRACE_MS, isWithinConnectGracePeriod } from './health-check.js';

function connectSession(partial: Partial<Session> = {}): Session {
  return {
    id: 'c1',
    type: 'connect',
    target: 'app-ai',
    namespace: 'app-ai',
    state: 'running',
    startedAt: new Date().toISOString(),
    logs: [],
    command: 'ktctl connect',
    ...partial,
  };
}

describe('isWithinConnectGracePeriod', () => {
  it('returns true shortly after runningAt', () => {
    const session = connectSession({
      runningAt: new Date(Date.now() - 5_000).toISOString(),
    });
    expect(isWithinConnectGracePeriod(session)).toBe(true);
  });

  it('returns false after grace window', () => {
    const session = connectSession({
      runningAt: new Date(Date.now() - CONNECT_HEALTH_GRACE_MS - 1).toISOString(),
    });
    expect(isWithinConnectGracePeriod(session)).toBe(false);
  });

  it('returns false without runningAt', () => {
    expect(isWithinConnectGracePeriod(connectSession())).toBe(false);
  });
});

describe('connect health levels', () => {
  it('treats unknown grace as non-recoverable', () => {
    const result = buildHealthResult('unknown', '集群网络连接稳定中', []);
    expect(result.level).toBe('unknown');
    expect(result.ok).toBe(false);
  });
});
