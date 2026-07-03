import { buildMeshCommand, meshTargetName } from '@kt-virtual-env/shared';
import { isProcessAlive, isLocalPortOpen } from './process-utils.js';
import type { ForwardParams, MeshProfile } from '@kt-virtual-env/shared';
import { getBundledBinary } from './binary-resolver.js';
import { ProcessRunner } from './process-runner.js';
import { SessionManager } from './session-manager.js';
import { loadConfig } from './config-store.js';
import type { RestartSpecRegistry } from './restart-spec-registry.js';
import { probeKtctlSessionPid } from './ktctl-session-probe.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildKtctlSpawnEnv, withWindowsExecOptions } from './windows-spawn.js';

const execFileAsync = promisify(execFile);

export class KtctlService {
  private runners = new Map<string, ProcessRunner>();

  constructor(
    private sessions: SessionManager,
    private registry: RestartSpecRegistry,
  ) {}

  startForward(params: ForwardParams): string {
    const args = this.buildForwardArgs(params);
    const sessionId = this.spawnKtctl('forward', params.service, params.namespace, args, {
      localPort: params.localPort,
      remotePort: params.remotePort,
    });
    this.registry.setForward(sessionId, params);
    return sessionId;
  }

  startMesh(
    profile: MeshProfile,
    localPort: number,
    userId: string,
    versionMarkBaseVirtualEnv?: string,
  ): string {
    const { args, display, meshVersion } = this.buildMeshArgs(
      profile,
      localPort,
      userId,
      versionMarkBaseVirtualEnv,
    );
    const sessionId = this.spawnKtctl('mesh', meshTargetName(profile), profile.namespace, args, {
      localPort,
      virtualEnv: meshVersion,
      commandOverride: display,
    });
    this.registry.setMesh(sessionId, profile, localPort, userId, versionMarkBaseVirtualEnv);
    return sessionId;
  }

  private buildForwardArgs(params: ForwardParams): string[] {
    const args = [
      'forward',
      params.service,
      `${params.localPort}:${params.remotePort}`,
      '--namespace',
      params.namespace,
      '--kubeconfig',
      params.kubeconfig,
    ];
    if (params.context) args.push('--context', params.context);
    return args;
  }

  private buildMeshArgs(
    profile: MeshProfile,
    localPort: number,
    userId: string,
    versionMarkBaseVirtualEnv?: string,
  ) {
    const cfg = loadConfig();
    const { args, display, meshVersion } = buildMeshCommand(
      profile,
      localPort,
      userId,
      versionMarkBaseVirtualEnv,
    );
    args.push('--kubeconfig', cfg.kubeconfig);
    if (cfg.context) args.push('--context', cfg.context);
    return { args, display, meshVersion };
  }

  private spawnKtctl(
    type: 'forward' | 'mesh',
    target: string,
    namespace: string,
    args: string[],
    extra: { localPort?: number; remotePort?: number; virtualEnv?: string; commandOverride?: string },
  ): string {
    const session = this.sessions.create({
      type,
      target,
      namespace,
      command: extra.commandOverride ?? `ktctl ${args.join(' ')}`,
      localPort: extra.localPort,
      remotePort: extra.remotePort,
      virtualEnv: extra.virtualEnv,
    });
    this.startRunner(session.id, args);
    return session.id;
  }

  private startRunner(sessionId: string, args: string[]): void {
    const ktctl = getBundledBinary('ktctl');
    const runner = new ProcessRunner();
    this.bindRunner(sessionId, runner);
    this.sessions.markStarting(sessionId);
    runner.start(ktctl, args);
    this.sessions.markRunning(sessionId, runner.pid ?? 0);
    this.runners.set(sessionId, runner);
  }

  private bindRunner(sessionId: string, runner: ProcessRunner): void {
    runner.on('log', (line: string) => this.sessions.appendLog(sessionId, line));
    runner.on('exit', ({ code, signal }) => {
      void this.handleRunnerExit(sessionId, runner, code, signal);
    });
  }

  private async handleRunnerExit(
    sessionId: string,
    runner: ProcessRunner,
    code: number | null,
    signal: NodeJS.Signals | null,
  ): Promise<void> {
    const current = this.sessions.get(sessionId);
    if (!current) {
      this.runners.delete(sessionId);
      return;
    }
    if (current.state === 'stopped') {
      this.registry.delete(sessionId);
      this.sessions.remove(sessionId);
      this.runners.delete(sessionId);
      return;
    }

    const gracefulExit =
      runner.stoppedByUser ||
      code === 0 ||
      signal === 'SIGTERM' ||
      signal === 'SIGINT' ||
      signal === 'SIGKILL';

    if (gracefulExit && (current.type === 'mesh' || current.type === 'forward')) {
      const pid = await probeKtctlSessionPid(current);
      if (pid) {
        this.sessions.markRunning(sessionId, pid);
        this.runners.delete(sessionId);
        return;
      }
      if (current.localPort && (await isLocalPortOpen(current.localPort))) {
        this.sessions.markRunning(sessionId, 0);
        this.runners.delete(sessionId);
        return;
      }
    }

    if (gracefulExit) {
      this.registry.delete(sessionId);
      this.sessions.remove(sessionId);
    } else {
      this.sessions.markFailed(sessionId);
    }
    this.runners.delete(sessionId);
  }

  async restartSession(sessionId: string): Promise<boolean> {
    const spec = this.registry.getSession(sessionId);
    const session = this.sessions.get(sessionId);
    if (!spec || !session) return false;

    this.runners.get(sessionId)?.stop();
    this.runners.delete(sessionId);

    try {
      await this.recover(session.target, session.namespace);
    } catch {
      // recover 尽力而为
    }

    const args =
      spec.type === 'forward'
        ? this.buildForwardArgs(spec.params)
        : this.buildMeshArgs(
            spec.profile,
            spec.localPort,
            spec.userId,
            spec.versionMarkBaseVirtualEnv,
          ).args;

    try {
      this.startRunner(sessionId, args);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.sessions.appendLog(sessionId, `[retry] 重启失败：${msg}`);
      this.sessions.markFailed(sessionId);
      return false;
    }
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
    await execFileAsync(ktctl, args, withWindowsExecOptions({ env: buildKtctlSpawnEnv() }));
  }

  async clean(): Promise<void> {
    const ktctl = getBundledBinary('ktctl');
    const cfg = loadConfig();
    const args = ['clean', '--kubeconfig', cfg.kubeconfig];
    if (cfg.context) args.push('--context', cfg.context);
    await execFileAsync(ktctl, args, withWindowsExecOptions({ env: buildKtctlSpawnEnv() }));
  }

  async isProcessRunning(id: string): Promise<boolean> {
    const runner = this.runners.get(id);
    if (runner?.pid && isProcessAlive(runner.pid)) return true;

    const session = this.sessions.get(id);
    if (!session) return false;

    if (session.type === 'mesh' || session.type === 'forward') {
      const pid = await probeKtctlSessionPid(session);
      if (pid) {
        if (session.pid !== pid) this.sessions.markRunning(id, pid);
        return true;
      }
    }

    return isProcessAlive(session.pid);
  }
}
