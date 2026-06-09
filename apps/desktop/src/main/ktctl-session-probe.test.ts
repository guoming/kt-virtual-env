import { describe, expect, it } from 'vitest';
import type { Session } from '@kt-virtual-env/shared';

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
