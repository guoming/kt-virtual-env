import { describe, expect, it } from 'vitest';
import { parseDockerPublishedPorts, parseLsofListenLine } from './local-dev-ports.js';

describe('parseLsofListenLine', () => {
  it('parses java listen line', () => {
    const row = parseLsofListenLine(
      'java    12345 guoming  123u  IPv6 0x0  0t0  TCP 127.0.0.1:8080 (LISTEN)',
    );
    expect(row?.port).toBe(8080);
    expect(row?.runtime).toBe('java');
  });

  it('parses node listen line', () => {
    const row = parseLsofListenLine(
      'node    99 guoming  12u  IPv4 0x0  0t0  TCP *:5173 (LISTEN)',
    );
    expect(row?.port).toBe(5173);
    expect(row?.runtime).toBe('node');
  });

  it('parses docker-proxy listen line', () => {
    const row = parseLsofListenLine(
      'com.docke 20000 guoming  88u  IPv4 0x0  0t0  TCP *:3306 (LISTEN)',
    );
    expect(row?.port).toBe(3306);
    expect(row?.runtime).toBe('docker');
  });

  it('parses OrbStack listen line', () => {
    const row = parseLsofListenLine(
      'OrbStack  18248 guoming  164u  IPv4 0x0  0t0  TCP *:61209 (LISTEN)',
    );
    expect(row?.port).toBe(61209);
    expect(row?.runtime).toBe('docker');
  });
});

describe('parseDockerPublishedPorts', () => {
  it('extracts host ports from docker ps PORTS column', () => {
    const rows = parseDockerPublishedPorts(
      'determined_borg',
      '0.0.0.0:61200->61200/tcp, [::]:61200->61200/tcp, 0.0.0.0:61209->8088/tcp',
    );
    expect(rows.map((r) => r.port).sort((a, b) => a - b)).toEqual([61200, 61209]);
    expect(rows[0]?.serviceName).toBe('determined_borg');
    expect(rows[0]?.runtime).toBe('docker');
  });

  it('ignores unpublished container ports', () => {
    const rows = parseDockerPublishedPorts('ccx', '3000/tcp');
    expect(rows).toEqual([]);
  });
});
