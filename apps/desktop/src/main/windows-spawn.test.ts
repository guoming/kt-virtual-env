import { describe, expect, it } from 'vitest';
import {
  getWindowsExecOptions,
  getWindowsSpawnOptions,
  withWindowsExecOptions,
  WINDOWS_CREATE_NO_WINDOW,
} from './windows-spawn.js';

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

describe('withWindowsExecOptions', () => {
  it('merges hide flags on windows', () => {
    if (process.platform !== 'win32') return;
    expect(withWindowsExecOptions({ timeout: 1000 })).toEqual({
      timeout: 1000,
      windowsHide: true,
      creationFlags: WINDOWS_CREATE_NO_WINDOW,
    });
  });

  it('returns options unchanged on non-windows', () => {
    if (process.platform === 'win32') return;
    expect(withWindowsExecOptions({ timeout: 1000 })).toEqual({ timeout: 1000 });
  });
});

describe('getWindowsExecOptions', () => {
  it('includes creationFlags on windows', () => {
    if (process.platform !== 'win32') return;
    expect(getWindowsExecOptions()).toEqual({
      windowsHide: true,
      creationFlags: WINDOWS_CREATE_NO_WINDOW,
    });
  });
});
