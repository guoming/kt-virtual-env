import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { getWindowsSpawnOptions } from './windows-spawn.js';

export interface RunResult {
  code: number | null;
  signal: NodeJS.Signals | null;
}

const KILL_GRACE_MS = 3000;

export class ProcessRunner extends EventEmitter {
  private proc?: ChildProcess;
  private intentionalStop = false;
  private killTimer?: NodeJS.Timeout;

  start(bin: string, args: string[], env?: Record<string, string>): void {
    this.proc = spawn(bin, args, {
      env: { ...process.env, ...env },
      ...getWindowsSpawnOptions(),
    });
    this.proc.stdout?.on('data', (d) => this.emit('log', d.toString()));
    this.proc.stderr?.on('data', (d) => this.emit('log', d.toString()));
    this.proc.on('exit', (code, signal) => this.emit('exit', { code, signal } satisfies RunResult));
  }

  stop(): void {
    if (!this.proc || this.intentionalStop) return;
    this.intentionalStop = true;
    this.proc.kill('SIGTERM');
    this.killTimer = setTimeout(() => {
      if (this.proc && !this.proc.killed) {
        this.proc.kill('SIGKILL');
      }
    }, KILL_GRACE_MS);
  }

  get stoppedByUser(): boolean {
    return this.intentionalStop;
  }

  get pid(): number | undefined {
    return this.proc?.pid;
  }
}
