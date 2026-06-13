import { describe, expect, it } from 'vitest';
import { buildHealthResult, type Session } from '@kt-virtual-env/shared';
import {
  buildHelperMissingLog,
  buildProcessMissingLog,
  healthResultIndicatesConnectProcessMissing,
  healthResultIndicatesHelperMissing,
  healthResultIndicatesSessionProcessMissing,
  ProcessMissingTracker,
  PROCESS_MISSING_SYNC_THRESHOLD,
  shouldTrackProcessMissing,
} from './session-process-sync.js';

describe('healthResultIndicatesConnectProcessMissing', () => {
  it('detects missing connect process detail', () => {
    const result = buildHealthResult('degraded', '部分异常', ['✗ 未找到 ktctl connect 进程']);
    expect(healthResultIndicatesConnectProcessMissing(result)).toBe(true);
  });

  it('returns false when process is alive', () => {
    const result = buildHealthResult('healthy', '正常', ['✓ ktctl connect 进程存活 (pid 1)']);
    expect(healthResultIndicatesConnectProcessMissing(result)).toBe(false);
  });
});

describe('ProcessMissingTracker', () => {
  it('requires threshold consecutive misses before sync', () => {
    const tracker = new ProcessMissingTracker();
    expect(tracker.recordMissing('s1')).toBe(1);
    expect(tracker.shouldSync('s1')).toBe(false);
    expect(tracker.recordMissing('s1')).toBe(PROCESS_MISSING_SYNC_THRESHOLD);
    expect(tracker.shouldSync('s1')).toBe(true);
  });

  it('resets streak when process is present again', () => {
    const tracker = new ProcessMissingTracker();
    tracker.recordMissing('s1');
    tracker.recordPresent('s1');
    expect(tracker.shouldSync('s1')).toBe(false);
  });
});

describe('shouldTrackProcessMissing', () => {
  const session: Session = {
    id: 's1',
    type: 'connect',
    target: 'app-ai',
    namespace: 'app-ai',
    state: 'running',
    startedAt: new Date().toISOString(),
    logs: [],
    command: 'ktctl connect',
  };

  it('skips unknown health during grace', () => {
    const result = buildHealthResult('unknown', '检测中', []);
    expect(shouldTrackProcessMissing(session, result)).toBe(false);
  });

  it('tracks running session with definitive health', () => {
    const result = buildHealthResult('degraded', '部分异常', ['✗ 未找到 ktctl connect 进程']);
    expect(shouldTrackProcessMissing(session, result)).toBe(true);
  });
});

describe('buildProcessMissingLog', () => {
  it('formats connect message', () => {
    expect(
      buildProcessMissingLog({
        id: '1',
        type: 'connect',
        target: 'app-ai',
        namespace: 'app-ai',
        state: 'running',
        startedAt: '',
        logs: [],
        command: '',
      }),
    ).toContain('[connect]');
  });

  it('formats mesh message', () => {
    expect(
      buildProcessMissingLog({
        id: '1',
        type: 'mesh',
        target: 'demo',
        namespace: 'app-ai',
        state: 'running',
        startedAt: '',
        logs: [],
        command: '',
      }),
    ).toContain('流量转发');
  });
});

describe('healthResultIndicatesSessionProcessMissing', () => {
  it('detects missing mesh/forward process detail', () => {
    const result = buildHealthResult('unhealthy', '不可用', ['✗ ktctl 进程未运行']);
    expect(healthResultIndicatesSessionProcessMissing(result)).toBe(true);
  });
});

// [AI-GEN] scope:helperMissing, model:auto, reviewed:false
describe('healthResultIndicatesHelperMissing', () => {
  it('detects helper not running detail', () => {
    const result = buildHealthResult('unhealthy', '组网 Helper 未运行', ['✗ 组网 Helper 未运行']);
    expect(healthResultIndicatesHelperMissing(result)).toBe(true);
  });

  it('returns false when helper is running', () => {
    const result = buildHealthResult('healthy', '正常', ['✓ 组网 Helper 已运行']);
    expect(healthResultIndicatesHelperMissing(result)).toBe(false);
  });
});

describe('buildHelperMissingLog', () => {
  it('mentions auto recovery', () => {
    expect(buildHelperMissingLog()).toContain('自动恢复');
  });
});
// [/AI-GEN]
