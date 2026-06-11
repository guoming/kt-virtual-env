import { describe, expect, it } from 'vitest';
import { formatKubectlError, isKubectlReachabilityError } from './kubectl-error.js';

describe('formatKubectlError', () => {
  it('formats dial tcp timeout', () => {
    const msg = formatKubectlError(
      new Error(
        'Command failed: /path/kubectl get ns: Unable to connect to the server: dial tcp 10.81.48.251:16443: i/o timeout',
      ),
    );
    expect(msg).toContain('无法连接集群');
    expect(msg).toContain('10.81.48.251:16443');
  });
});

describe('isKubectlReachabilityError', () => {
  it('detects timeout', () => {
    expect(
      isKubectlReachabilityError(
        new Error('Unable to connect to the server: dial tcp 10.0.0.1:443: i/o timeout'),
      ),
    ).toBe(true);
  });
});
