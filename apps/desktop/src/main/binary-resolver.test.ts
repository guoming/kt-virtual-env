import { describe, it, expect } from 'vitest';
import { resolveBinaryName, platformKey } from './platform-key.js';

describe('platformKey', () => {
  it('maps darwin arm64', () => {
    expect(platformKey('darwin', 'arm64')).toBe('darwin-arm64');
  });
  it('maps win32 x64', () => {
    expect(platformKey('win32', 'x64')).toBe('windows-amd64');
  });
});

describe('resolveBinaryName', () => {
  it('maps darwin arm64 ktctl path', () => {
    expect(resolveBinaryName('ktctl', 'darwin', 'arm64')).toMatch(/darwin-arm64\/ktctl$/);
  });
  it('maps win32 ktctl.exe path', () => {
    expect(resolveBinaryName('ktctl.exe', 'win32', 'x64')).toMatch(/windows-amd64\/ktctl.exe$/);
  });
});
