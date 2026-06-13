import { describe, expect, it, vi, afterEach } from 'vitest';
import os from 'node:os';
import { detectLocalExcludeIps } from './local-exclude-ips.js';

describe('detectLocalExcludeIps', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns CIDRs from non-internal IPv4 interfaces', () => {
    vi.spyOn(os, 'networkInterfaces').mockReturnValue({
      en0: [
        {
          address: '192.168.1.42',
          netmask: '255.255.255.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: false,
          cidr: '192.168.1.42/24',
        },
      ],
      lo0: [
        {
          address: '127.0.0.1',
          netmask: '255.0.0.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: true,
          cidr: '127.0.0.1/8',
        },
      ],
    });

    const result = detectLocalExcludeIps();
    expect(result.ok).toBe(true);
    expect(result.cidrs).toEqual(['192.168.1.0/24']);
    expect(result.excludeIps).toBe('192.168.1.0/24');
  });

  it('returns failure when no usable interfaces', () => {
    vi.spyOn(os, 'networkInterfaces').mockReturnValue({});
    const result = detectLocalExcludeIps();
    expect(result.ok).toBe(false);
    expect(result.excludeIps).toBe('');
  });
});
