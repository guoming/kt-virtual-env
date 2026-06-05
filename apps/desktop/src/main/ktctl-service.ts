import { buildMeshCommand } from '@zt-virtual-env/shared';
import type { ForwardParams, MeshProfile } from '@zt-virtual-env/shared';
import { getBundledBinary } from './binary-resolver.js';
import { ProcessRunner } from './process-runner.js';
import { SessionManager } from './session-manager.js';
import { loadConfig } from './config-store.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class KtctlService {
  private runners = new Map<string, ProcessRunner>();

  constructor(private sessions: SessionManager) {}

  startForward(params: ForwardParams): string {
    const ktctl = getBundledBinary('ktctl');
    const args = [
      'forward',
      params.service,
      `${params.localPort}:${params.remotePort}`,
      '--namespace',
      params.namespace,
      '--kubeconfig',
      params.kubeconfig,
    ];
    if (params.context) {
      args.push('--context', params.context);
    }
    return this.spawnKtctl('forward', params.service, params.namespace, args, {
      localPort: params.localPort,
      remotePort: params.remotePort,
    });
  }

  startMesh(profile: MeshProfile, localPort: number): string {
    const cfg = loadConfig();
    const { args, display } = buildMeshCommand(profile, localPort);
    args.push('--kubeconfig', cfg.kubeconfig);
    if (cfg.context) {
      args.push('--context', cfg.context);
    }
    return this.spawnKtctl('mesh', profile.deploymentName, profile.namespace, args, {
      localPort,
      virtualEnv: profile.virtualEnv,
      commandOverride: display,
    });
  }

  private spawnKtctl(
    type: 'forward' | 'mesh',
    target: string,
    namespace: string,
    args: string[],
    extra: { localPort?: number; remotePort?: number; virtualEnv?: string; commandOverride?: string },
  ): string {
    const ktctl = getBundledBinary('ktctl');
    const session = this.sessions.create({
      type,
      target,
      namespace,
      command: extra.commandOverride ?? `ktctl ${args.join(' ')}`,
      localPort: extra.localPort,
      remotePort: extra.remotePort,
      virtualEnv: extra.virtualEnv,
    });
    const runner = new ProcessRunner();
    runner.on('log', (line: string) => this.sessions.appendLog(session.id, line));
    runner.on('exit', ({ code }) => {
      if (code === 0) {
        this.sessions.markStopped(session.id);
      } else {
        this.sessions.markFailed(session.id);
      }
      this.runners.delete(session.id);
    });
    this.sessions.markStarting(session.id);
    runner.start(ktctl, args);
    this.sessions.markRunning(session.id, runner.pid ?? 0);
    this.runners.set(session.id, runner);
    return session.id;
  }

  stopSession(id: string): void {
    this.runners.get(id)?.stop();
    this.sessions.markStopped(id);
    this.runners.delete(id);
  }

  stopAll(): void {
    for (const id of [...this.runners.keys()]) {
      this.stopSession(id);
    }
  }

  async recover(target: string, namespace: string): Promise<void> {
    const ktctl = getBundledBinary('ktctl');
    const cfg = loadConfig();
    const args = ['recover', target, '--namespace', namespace, '--kubeconfig', cfg.kubeconfig];
    if (cfg.context) args.push('--context', cfg.context);
    await execFileAsync(ktctl, args);
  }

  async clean(): Promise<void> {
    const ktctl = getBundledBinary('ktctl');
    const cfg = loadConfig();
    const args = ['clean', '--kubeconfig', cfg.kubeconfig];
    if (cfg.context) args.push('--context', cfg.context);
    await execFileAsync(ktctl, args);
  }
}
