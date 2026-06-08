import { describe, expect, it } from 'vitest';
import { buildWindowsElevatedLaunchCommand } from './helper-launcher.js';

describe('buildWindowsElevatedLaunchCommand', () => {
  it('uses RunAs with socket CLI flag instead of -Environment', () => {
    const cmd = buildWindowsElevatedLaunchCommand(
      'C:\\Program Files\\kt-virtual-env\\helper-windows-amd64.exe',
      'C:\\Users\\dev\\AppData\\Local\\Temp\\kt-virtual-env-helper.sock',
    );
    expect(cmd).toContain("-Verb RunAs");
    expect(cmd).toContain("-ArgumentList '-socket'");
    expect(cmd).not.toContain('-Environment');
  });

  it('escapes single quotes in helper path', () => {
    const cmd = buildWindowsElevatedLaunchCommand(
      "C:\\Users\\O'Brien\\helper-windows-amd64.exe",
      'C:\\Temp\\kt.sock',
    );
    expect(cmd).toContain("O''Brien");
  });
});
