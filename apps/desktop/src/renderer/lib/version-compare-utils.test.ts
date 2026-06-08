import { describe, expect, it } from 'vitest';
import { formatUpdateErrorMessage, mapUpdatePhase } from './version-compare-utils';

describe('mapUpdatePhase', () => {
  it('maps checking and error', () => {
    expect(mapUpdatePhase('checking')).toBe('checking');
    expect(mapUpdatePhase('error')).toBe('failed');
  });

  it('maps success phases to ready', () => {
    expect(mapUpdatePhase('not-available')).toBe('ready');
    expect(mapUpdatePhase('downloaded')).toBe('ready');
  });
});

describe('formatUpdateErrorMessage', () => {
  it('shortens gateway timeout html', () => {
    expect(formatUpdateErrorMessage('504 Gateway Time-out nginx')).toMatch(/无法连接更新服务器/);
    expect(formatUpdateErrorMessage('<html><body>504</body></html>')).toMatch(/无法连接更新服务器/);
  });

  it('keeps short actionable messages', () => {
    expect(formatUpdateErrorMessage('No published versions')).toBe('No published versions');
  });
});
