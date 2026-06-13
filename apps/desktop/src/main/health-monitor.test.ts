import { describe, expect, it, vi } from 'vitest';
import { buildHealthResult, type Session } from '@kt-virtual-env/shared';
import { HealthMonitor } from './health-monitor.js';

function connectSession(): Session {
  return {
    id: 'connect-1',
    type: 'connect',
    target: 'app-ai',
    namespace: 'app-ai',
    state: 'running',
    startedAt: new Date().toISOString(),
    runningAt: new Date(Date.now() - 60_000).toISOString(),
    logs: ['All looks good, now you can access to resources in the kubernetes cluster'],
    command: 'ktctl connect',
  };
}

describe('HealthMonitor process missing sync', () => {
  it('marks connect session failed after consecutive missing probes', async () => {
    const session = connectSession();
    const onSessionProcessMissing = vi.fn();
    const degraded = buildHealthResult('degraded', '部分异常', [
      '✓ 集群连接正常',
      '✓ 组网 Helper 已运行',
      '✗ 未找到 ktctl connect 进程',
      '✓ 集群 DNS 可解析：svc.app-ai',
    ]);

    const monitor = new HealthMonitor({
      intervalMs: 10_000,
      getConnectSession: () => session,
      isHelperRunning: async () => true,
      k8s: () =>
        ({
          testConnection: async () => ({ ok: true, message: 'ok' }),
        }) as never,
      listActiveSessions: () => [session],
      ktctl: {} as never,
      onChanged: () => {},
      onSessionProcessMissing,
    });

    vi.spyOn(await import('./health-check.js'), 'checkConnectHealth').mockResolvedValue(degraded);
    vi.spyOn(await import('./health-check.js'), 'checkSessionHealth').mockResolvedValue(
      buildHealthResult('healthy', 'ok', []),
    );

    await monitor.forceCheck();
    expect(onSessionProcessMissing).not.toHaveBeenCalled();

    await monitor.forceCheck();
    expect(onSessionProcessMissing).toHaveBeenCalledTimes(1);
    expect(onSessionProcessMissing).toHaveBeenCalledWith(session);
  });

  it('triggers helper recovery after consecutive helper-missing probes', async () => {
    const session = connectSession();
    const onSessionProcessMissing = vi.fn();
    const onConnectHelperMissing = vi.fn();
    const unhealthy = buildHealthResult('unhealthy', '组网 Helper 未运行', [
      '✓ 集群连接正常',
      '✗ 组网 Helper 未运行',
    ]);

    const monitor = new HealthMonitor({
      intervalMs: 10_000,
      getConnectSession: () => session,
      isHelperRunning: async () => false,
      k8s: () =>
        ({
          testConnection: async () => ({ ok: true, message: 'ok' }),
        }) as never,
      listActiveSessions: () => [session],
      ktctl: {} as never,
      onChanged: () => {},
      onSessionProcessMissing,
      onConnectHelperMissing,
    });

    vi.spyOn(await import('./health-check.js'), 'checkConnectHealth').mockResolvedValue(unhealthy);
    vi.spyOn(await import('./health-check.js'), 'checkSessionHealth').mockResolvedValue(
      buildHealthResult('healthy', 'ok', []),
    );

    await monitor.forceCheck();
    expect(onConnectHelperMissing).not.toHaveBeenCalled();
    expect(onSessionProcessMissing).not.toHaveBeenCalled();

    await monitor.forceCheck();
    expect(onConnectHelperMissing).toHaveBeenCalledTimes(1);
    expect(onConnectHelperMissing).toHaveBeenCalledWith(session);
    expect(onSessionProcessMissing).not.toHaveBeenCalled();
  });
});
