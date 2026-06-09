import { describe, expect, it } from 'vitest';
import { parseLsofListenLine } from './local-dev-ports.js';

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
});
