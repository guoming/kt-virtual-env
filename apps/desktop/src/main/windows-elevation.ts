import { execFileSync } from 'node:child_process';

// [AI-GEN] scope:windows-elevation, model:auto, reviewed:false
/** 当前进程是否已具备管理员权限（Windows） */
export function isWindowsProcessElevated(): boolean {
  if (process.platform !== 'win32') return false;
  try {
    execFileSync('net', ['session'], { windowsHide: true, timeout: 3000, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** PowerShell 5.1 -EncodedCommand 需要 UTF-16LE */
export function encodePowerShellCommand(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64');
}
// [/AI-GEN]
