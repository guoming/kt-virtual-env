import { describe, expect, it } from 'vitest';
import { resolvePowershellPath } from './powershell-path.js';

describe('resolvePowershellPath', () => {
  it('throws on non-Windows platforms', () => {
    if (process.platform === 'win32') return;
    expect(() => resolvePowershellPath()).toThrow(/仅适用于 Windows/);
  });
});
