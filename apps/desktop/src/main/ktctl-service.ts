import { buildMeshCommand } from '@kt-virtual-env/shared';
import { isProcessAlive } from './process-utils.js';
import type { ForwardParams, MeshProfile } from '@kt-virtual-env/shared';
import { getBundledBinary } from './binary-resolver.js';
import { ProcessRunner } from './process-runner.js';
import { SessionManager } from './session-manager.js';
import { loadConfig } from './config-store.js';
import type { RestartSpecRegistry } from './restart-spec-registry.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class KtctlService {
  private runners = new Map<string, ProcessRunner>();

  constructor(
    private sessions: SessionManager,
    private registry: RestartSpecRegistry,
  ) {}

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
    const sessionId = this.spawnKtctl('forward', params.service, params.namespace, args, {
      localPort: params.localPort,
      remotePort: params.remotePort,
    });
    this.registry.setForward(sessionId, params);
    return sessionId;
  }

  startMesh(profile: MeshProfile, localPort: number, userId: string): string {
    const cfg = loadConfig();
    const { args, display, meshVersion } = buildMeshCommand(profile, localPort, userId);
    args.push('--kubeconfig', cfg.kubeconfig);
    if (cfg.context) {
      args.push('--context', cfg.context);
    }
    const sessionId = this.spawnKtctl('mesh', profile.deploymentName, profile.namespace, args, {
      localPort,
      virtualEnv: meshVersion,
      commandOverride: display,
    });
    this.registry.setMesh(sessionId, profile, localPort, userId);
    return sessionId;
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
    runner.on('exit', ({ code, signal }) => {
      const current = this.sessions.get(session.id);
      if (!current) {
        this.runners.delete(session.id);
        return;
      }
      if (current.state === 'stopped') {
        this.registry.delete(session.id);
        this.sessions.remove(session.id);
        this.runners.delete(session.id);
        return;
      }
      const gracefulExit =
        runner.stoppedByUser ||
        code === 0 ||
        signal === 'SIGTERM' ||
        signal === 'SIGINT' ||
        signal === 'SIGKILL';
      if (gracefulExit) {
        this.registry.delete(session.id);
        this.sessions.remove(session.id);
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

  async stopSession(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) return;

    this.runners.get(id)?.stop();
    this.sessions.markStopped(id);
    this.runners.delete(id);

    if (session.type === 'mesh' || session.type === 'forward') {
      try {
        await this.recover(session.target, session.namespace);
      } catch {
        // recover 尽力而为，停止后会话将从面板移除
      }
    }
    this.registry.delete(id);
    this.sessions.remove(id);
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.runners.keys()].map((id) => this.stopSession(id)));
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

  isProcessRunning(id: string): boolean {
    const runner = this.runners.get(id);
    const pid = runner?.pid ?? this.sessions.get(id)?.pid;
    return isProcessAlive(pid);
  }
}
