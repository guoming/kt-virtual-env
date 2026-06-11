import { describe, expect, it } from 'vitest';
import type { HealthCheckResult, Session } from '@kt-virtual-env/shared';
import { buildHealthResult } from '@kt-virtual-env/shared';
import {
  canRetrySession,
  canStopSession,
  countActiveByType,
  getConnectNavStatus,
  getSessionHealth,
  showSessionActions,
} from './session-utils';

function session(partial: Partial<Session> & Pick<Session, 'type' | 'state'>): Session {
  return {
    id: '1',
    target: 't',
    namespace: 'ns',
    command: 'cmd',
    startedAt: '',
    logs: [],
    ...partial,
  };
}

function health(level: HealthCheckResult['level']): HealthCheckResult {
  return buildHealthResult(level, level);
}

describe('getConnectNavStatus', () => {
  it('returns connected when connect session is running', () => {
    expect(
      getConnectNavStatus([session({ type: 'connect', state: 'running' })]),
    ).toBe('connected');
  });

  it('returns disconnected when no connect session', () => {
    expect(getConnectNavStatus([])).toBe('disconnected');
  });
});

describe('countActiveByType', () => {
  it('counts only active mesh sessions', () => {
    const sessions = [
      session({ type: 'mesh', state: 'running' }),
      session({ type: 'mesh', state: 'stopped' }),
      session({ type: 'forward', state: 'running' }),
    ];
    expect(countActiveByType(sessions, 'mesh')).toBe(1);
    expect(countActiveByType(sessions, 'forward')).toBe(1);
  });
});

describe('canStopSession', () => {
  it('allows stop for active and failed sessions', () => {
    expect(canStopSession(session({ type: 'mesh', state: 'running' }))).toBe(true);
    expect(canStopSession(session({ type: 'mesh', state: 'failed' }))).toBe(true);
    expect(canStopSession(session({ type: 'mesh', state: 'stopped' }))).toBe(false);
  });
});

describe('canRetrySession', () => {
  it('allows retry for failed sessions', () => {
    expect(canRetrySession(session({ type: 'mesh', state: 'failed' }))).toBe(true);
  });

  it('allows retry for running sessions only when health is bad', () => {
    const running = session({ type: 'mesh', state: 'running' });
    expect(canRetrySession(running)).toBe(false);
    expect(canRetrySession(running, health('healthy'))).toBe(false);
    expect(canRetrySession(running, health('unhealthy'))).toBe(true);
    expect(canRetrySession(running, health('degraded'))).toBe(true);
  });

  it('disallows retry while starting', () => {
    expect(canRetrySession(session({ type: 'mesh', state: 'starting' }))).toBe(false);
  });
});

describe('getSessionHealth', () => {
  it('reads connect health from snapshot root', () => {
    const connect = health('healthy');
    const s = session({ id: 'c1', type: 'connect', state: 'running' });
    expect(getSessionHealth(s, { connect, sessions: {} })).toBe(connect);
  });

  it('reads forward/mesh health from sessions map', () => {
    const meshHealth = health('unhealthy');
    const s = session({ id: 'm1', type: 'mesh', state: 'running' });
    expect(
      getSessionHealth(s, { connect: null, sessions: { m1: meshHealth } }),
    ).toBe(meshHealth);
  });
});

describe('showSessionActions', () => {
  it('shows actions when stop or retry is available', () => {
    expect(showSessionActions(session({ type: 'mesh', state: 'failed' }))).toBe(true);
    expect(
      showSessionActions(
        session({ type: 'mesh', state: 'running' }),
        health('unhealthy'),
      ),
    ).toBe(true);
    expect(showSessionActions(session({ type: 'mesh', state: 'stopped' }))).toBe(false);
  });
});
