import { describe, it, expect } from 'vitest';
import { compareSemver, isVersionNewer, parseSemver } from './version.js';

describe('parseSemver', () => {
  it('extracts from ktctl output', () => {
    expect(parseSemver('ktctl version 0.3.7')).toBe('0.3.7');
  });

  it('extracts from kubectl output', () => {
    expect(parseSemver('Client Version: v1.28.15')).toBe('1.28.15');
  });
});

describe('compareSemver', () => {
  it('detects newer version', () => {
    expect(isVersionNewer('0.2.0', '0.1.0')).toBe(true);
    expect(isVersionNewer('0.1.0', '0.1.0')).toBe(false);
    expect(isVersionNewer('1.28.16', '1.28.15')).toBe(true);
  });

  it('orders versions', () => {
    expect(compareSemver('0.10.0', '0.9.0')).toBeGreaterThan(0);
  });
});
