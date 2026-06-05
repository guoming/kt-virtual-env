import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

export interface RunResult {
  code: number | null;
  signal: NodeJS.Signals | null;
}

export class ProcessRunner extends EventEmitter {
  private proc?: ChildProcess;

  start(bin: string, args: string[], env?: Record<string, string>): void {
    this.proc = spawn(bin, args, { env: { ...process.env, ...env } });
    this.proc.stdout?.on('data', (d) => this.emit('log', d.toString()));
    this.proc.stderr?.on('data', (d) => this.emit('log', d.toString()));
    this.proc.on('exit', (code, signal) => this.emit('exit', { code, signal } satisfies RunResult));
  }

  stop(): void {
    this.proc?.kill('SIGTERM');
  }

  get pid(): number | undefined {
    return this.proc?.pid;
  }
}
