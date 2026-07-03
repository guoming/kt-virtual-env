import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Session } from '@kt-virtual-env/shared';
import { getElevatedKtHome, getUserKtDir, readAnyPidFromKtDir, readPidFromKtDir } from './kt-state.js';
import { isProcessAlive } from './process-utils.js';
import { getWindowsExecOptions } from './windows-spawn.js';

const execFileAsync = promisify(execFile);

/** 提权 connect 使用 staging 路径，命令行不含字面量 "ktctl connect" */
const CONNECT_PGREP_PATTERNS = [' connect --namespace', 'kt-virtual-env-ktctl'];

export function isConnectCommandLine(commandLine: string): boolean {
  return CONNECT_PGREP_PATTERNS.some((pattern) => commandLine.includes(pattern));
}

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
        { timeout: 5000, ...getWindowsExecOptions() },
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

async function pgrepConnectPid(): Promise<number | undefined> {
  for (const pattern of CONNECT_PGREP_PATTERNS) {
    const pid = await pgrepKtctlPid(pattern);
    if (pid) return pid;
  }
  return undefined;
}

function readConnectPidFromKtDirs(): number | undefined {
  for (const ktHome of [getElevatedKtHome(), getUserKtDir()]) {
    for (const read of [
      () => readPidFromKtDir(ktHome, 'connect'),
      () => readAnyPidFromKtDir(ktHome),
    ]) {
      const pid = read();
      if (pid && isProcessAlive(pid)) return pid;
    }
  }
  return undefined;
}

/** 探测 connect 实际 ktctl 进程（含提权 Helper 启动的 staging 二进制） */
export async function probeKtctlConnectPid(): Promise<number | undefined> {
  const fromPidFile = readConnectPidFromKtDirs();
  if (fromPidFile) return fromPidFile;
  return pgrepConnectPid();
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
