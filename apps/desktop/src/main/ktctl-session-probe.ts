import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Session } from '@kt-virtual-env/shared';
import { getUserKtDir, readPidFromKtDir } from './kt-state.js';
import { isProcessAlive } from './process-utils.js';

const execFileAsync = promisify(execFile);

function pidFileHints(session: Session): string[] {
  const target = session.target.toLowerCase();
  if (session.type === 'mesh') return ['mesh', target, session.namespace.toLowerCase()];
  if (session.type === 'forward') return ['forward', target, session.namespace.toLowerCase()];
  return ['connect'];
}

function pgrepPattern(session: Session): string {
  if (session.type === 'mesh') {
    return `ktctl mesh ${session.target}`;
  }
  if (session.type === 'forward') {
    return `ktctl forward ${session.target}`;
  }
  return 'ktctl connect';
}

async function pgrepKtctlPid(pattern: string): Promise<number | undefined> {
  if (process.platform === 'win32') {
    try {
      const script = `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${pattern.replace(/'/g, "''")}*' } | Select-Object -ExpandProperty ProcessId -First 1`;
      const { stdout } = await execFileAsync(
        'powershell',
        ['-NoProfile', '-Command', script],
        { timeout: 5000, windowsHide: true },
      );
      const pid = Number.parseInt(stdout.trim(), 10);
      return pid > 0 && isProcessAlive(pid) ? pid : undefined;
    } catch {
      return undefined;
    }
  }

  try {
    const { stdout } = await execFileAsync('pgrep', ['-f', pattern], { timeout: 5000 });
    const pid = Number.parseInt(stdout.trim().split(/\s+/)[0] ?? '', 10);
    return pid > 0 && isProcessAlive(pid) ? pid : undefined;
  } catch {
    return undefined;
  }
}

/** 探测 mesh/forward 实际 ktctl 进程（spawn 父进程退出后仍可能存活） */
export async function probeKtctlSessionPid(session: Session): Promise<number | undefined> {
  if (session.type !== 'mesh' && session.type !== 'forward') {
    return undefined;
  }

  for (const hint of pidFileHints(session)) {
    const pid = readPidFromKtDir(getUserKtDir(), hint);
    if (pid && isProcessAlive(pid)) return pid;
  }

  return pgrepKtctlPid(pgrepPattern(session));
}
