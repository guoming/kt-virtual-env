import { describe, expect, it } from 'vitest';
import type { Session } from '@kt-virtual-env/shared';
import {
  countActiveByType,
  getConnectNavStatus,
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
