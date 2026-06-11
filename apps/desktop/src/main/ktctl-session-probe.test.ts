import { describe, expect, it } from 'vitest';
import type { Session } from '@kt-virtual-env/shared';
import { isConnectCommandLine } from './ktctl-session-probe.js';

describe('isConnectCommandLine', () => {
  it('matches bundled ktctl connect command lines', () => {
    expect(isConnectCommandLine('/opt/ktve/bin/ktctl connect --namespace app-ai')).toBe(true);
  });

  it('matches elevated staging ktctl paths', () => {
    expect(
      isConnectCommandLine(
        '/tmp/kt-virtual-env-ktctl-501 connect --namespace app-ai --dnsMode hosts:app-ai',
      ),
    ).toBe(true);
  });

  it('does not match mesh or forward sessions', () => {
    expect(isConnectCommandLine('/opt/ktve/bin/ktctl mesh demo-api --namespace app-ai')).toBe(
      false,
    );
    expect(
      isConnectCommandLine('/opt/ktve/bin/ktctl forward svc 8080:80 --namespace app-ai'),
    ).toBe(false);
  });
});

describe('ktctl session probe helpers', () => {
  it('documents mesh session shape used for probing', () => {
    const session: Session = {
      id: 's1',
      type: 'mesh',
      target: 'demo-api',
      namespace: 'app-demo',
      state: 'running',
      startedAt: new Date().toISOString(),
      logs: [],
      command: 'ktctl mesh demo-api',
      localPort: 8080,
    };
    expect(session.type).toBe('mesh');
    expect(session.target).toBe('demo-api');
  });
});
