import { describe, expect, it } from 'vitest';
import { getWindowsSpawnOptions, WINDOWS_CREATE_NO_WINDOW } from './windows-spawn.js';

describe('getWindowsSpawnOptions', () => {
  it('returns empty object on non-windows', () => {
    if (process.platform === 'win32') return;
    expect(getWindowsSpawnOptions()).toEqual({});
  });

  it('returns CREATE_NO_WINDOW on windows', () => {
    if (process.platform !== 'win32') return;
    expect(getWindowsSpawnOptions()).toEqual({
      windowsHide: true,
      creationFlags: WINDOWS_CREATE_NO_WINDOW,
    });
  });
});
