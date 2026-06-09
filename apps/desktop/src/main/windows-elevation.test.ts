import { describe, expect, it } from 'vitest';
import { encodePowerShellCommand } from './windows-elevation.js';

describe('encodePowerShellCommand', () => {
  it('encodes UTF-16LE base64 for PowerShell -EncodedCommand', () => {
    const encoded = encodePowerShellCommand('Write-Output ok');
    expect(encoded).toBeTruthy();
    expect(Buffer.from(encoded, 'base64').toString('utf16le')).toBe('Write-Output ok');
  });
});
