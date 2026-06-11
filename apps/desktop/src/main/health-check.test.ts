import { describe, expect, it } from 'vitest';
import { buildHealthResult, type Session } from '@kt-virtual-env/shared';
import {
  CONNECT_HEALTH_GRACE_MS,
  CONNECT_READY_LOG_PATTERN,
  isWithinConnectGracePeriod,
} from './health-check.js';

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

describe('CONNECT_READY_LOG_PATTERN', () => {
  it('matches ktctl ready banner', () => {
    expect(
      CONNECT_READY_LOG_PATTERN.test(
        ' All looks good, now you can access to resources in the kubernetes cluster',
      ),
    ).toBe(true);
  });
});

describe('connect health levels', () => {
  it('treats unknown grace as non-recoverable', () => {
    const result = buildHealthResult('unknown', '集群网络健康检测中', []);
    expect(result.level).toBe('unknown');
    expect(result.ok).toBe(false);
  });

  it('treats dns failure as degraded when core checks pass', () => {
    const result = buildHealthResult('degraded', '集群 DNS 不可用', [
      '✓ 集群连接正常',
      '✓ 组网 Helper 已运行',
      '✓ ktctl connect 进程存活 (pid 1)',
      '○ 集群 DNS 解析失败',
    ]);
    expect(result.level).toBe('degraded');
    expect(result.ok).toBe(false);
  });
});
