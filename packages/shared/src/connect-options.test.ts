import { describe, expect, it } from 'vitest';
import { DEFAULT_CONNECT_OPTIONS, normalizeConnectOptions } from './connect-options.js';

describe('normalizeConnectOptions', () => {
  it('applies defaults for empty input', () => {
    expect(normalizeConnectOptions()).toEqual(DEFAULT_CONNECT_OPTIONS);
  });

  it('clamps portForwardTimeout', () => {
    expect(normalizeConnectOptions({ portForwardTimeout: 0 }).portForwardTimeout).toBe(10);
    expect(normalizeConnectOptions({ portForwardTimeout: 30 }).portForwardTimeout).toBe(30);
    expect(normalizeConnectOptions({ portForwardTimeout: 999 }).portForwardTimeout).toBe(300);
  });

  it('normalizes mode and excludeIpsEnabled', () => {
    expect(normalizeConnectOptions({ mode: 'sshuttle' }).mode).toBe('sshuttle');
    expect(normalizeConnectOptions({ mode: 'invalid' as never }).mode).toBe('tun2socks');
    expect(normalizeConnectOptions({ excludeIpsEnabled: true }).excludeIpsEnabled).toBe(true);
  });

  it('migrates legacy excludeIps string to enabled flag', () => {
    expect(normalizeConnectOptions({ excludeIps: '192.168.1.0/24' }).excludeIpsEnabled).toBe(
      true,
    );
    expect(normalizeConnectOptions({ excludeIps: '  ' }).excludeIpsEnabled).toBe(false);
  });
});
