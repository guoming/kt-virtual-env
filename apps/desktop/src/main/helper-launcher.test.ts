import { describe, expect, it } from 'vitest';
import { buildWindowsElevatedLaunchCommand } from './helper-launcher.js';

describe('buildWindowsElevatedLaunchCommand', () => {
  it('uses RunAs with single ArgumentList string for socket flag', () => {
    const cmd = buildWindowsElevatedLaunchCommand(
      'C:\\Program Files\\kt-virtual-env\\helper-windows-amd64.exe',
      'tcp:127.0.0.1:51234',
    );
    expect(cmd).toContain('-Verb RunAs');
    expect(cmd).toContain("$a='-socket tcp:127.0.0.1:51234'");
    expect(cmd).toContain('-ArgumentList $a');
    expect(cmd).not.toContain('-Environment');
  });

  it('escapes single quotes in helper path', () => {
    const cmd = buildWindowsElevatedLaunchCommand(
      "C:\\Users\\O'Brien\\helper-windows-amd64.exe",
      'tcp:127.0.0.1:51234',
    );
    expect(cmd).toContain("O''Brien");
  });
});
