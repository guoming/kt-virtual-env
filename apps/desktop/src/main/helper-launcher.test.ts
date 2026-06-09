import { describe, expect, it } from 'vitest';
import {
  buildWindowsElevatedLaunchCommand,
  buildWindowsElevatedLaunchScript,
} from './helper-launcher.js';

describe('buildWindowsElevatedLaunchCommand', () => {
  it('uses RunAs with -socket= and -log= flags', () => {
    const cmd = buildWindowsElevatedLaunchCommand(
      'C:\\Program Files\\kt-virtual-env\\helper-windows-amd64.exe',
      'tcp:127.0.0.1:51234',
      'C:\\Users\\dev\\.kt-virtual-env\\helper.log',
    );
    expect(cmd).toContain('-Verb RunAs');
    expect(cmd).toContain("-socket=tcp:127.0.0.1:51234");
    expect(cmd).toContain('-log=C:\\Users\\dev\\.kt-virtual-env\\helper.log');
    expect(cmd).not.toContain('-Environment');
  });
});

describe('buildWindowsElevatedLaunchScript', () => {
  it('writes launcher diagnostics and uses equals-style args', () => {
    const script = buildWindowsElevatedLaunchScript(
      'C:\\Program Files\\kt-virtual-env\\helper-windows-amd64.exe',
      'tcp:127.0.0.1:51234',
      'C:\\Users\\dev\\.kt-virtual-env\\helper.log',
    );
    expect(script).toContain('Write-HelperLog');
    expect(script).toContain("-socket=tcp:127.0.0.1:51234");
    expect(script).toContain('-log=C:\\Users\\dev\\.kt-virtual-env\\helper.log');
    expect(script).toContain('-Verb RunAs');
  });
});
