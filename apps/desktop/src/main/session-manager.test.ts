import { describe, it, expect } from 'vitest';
import { SessionManager } from './session-manager.js';

describe('SessionManager', () => {
  it('transitions pending → starting → running', () => {
    const sm = new SessionManager();
    const s = sm.create({ type: 'mesh', target: 'ark', namespace: 'app-ark', command: 'ktctl mesh...' });
    sm.markStarting(s.id);
    sm.markRunning(s.id, 1234);
    expect(sm.get(s.id)?.state).toBe('running');
    expect(sm.get(s.id)?.pid).toBe(1234);
  });

  it('caps logs at 2000 lines', () => {
    const sm = new SessionManager();
    const s = sm.create({ type: 'forward', target: 'svc', namespace: 'ns', command: 'cmd' });
    for (let i = 0; i < 2100; i++) sm.appendLog(s.id, `line ${i}`);
    expect(sm.get(s.id)!.logs.length).toBe(2000);
  });
});
