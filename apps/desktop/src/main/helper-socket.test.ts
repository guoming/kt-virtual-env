import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHelperSocketPath, isTcpHelperEndpoint } from './helper-socket.js';

describe('getHelperSocketPath', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses tcp loopback on Windows', () => {
    vi.stubGlobal('process', {
      ...process,
      platform: 'win32',
    });
    expect(getHelperSocketPath()).toMatch(/^tcp:127\.0\.0\.1:\d+$/);
    expect(isTcpHelperEndpoint(getHelperSocketPath())).toBe(true);
  });

  it('uses unix socket on darwin', () => {
    vi.stubGlobal('process', {
      ...process,
      platform: 'darwin',
      getuid: () => 501,
    });
    expect(getHelperSocketPath()).toContain('kt-virtual-env-helper-501.sock');
    expect(isTcpHelperEndpoint(getHelperSocketPath())).toBe(false);
  });
});
