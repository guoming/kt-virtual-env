import type { ConnectParams, HealthLevel } from '@kt-virtual-env/shared';
import type { SessionManager } from './session-manager.js';
import type { KtctlService } from './ktctl-service.js';
import type { RestartSpecRegistry } from './restart-spec-registry.js';

export class FailureTracker {
  private counts = new Map<string, number>();

  record(key: string, level: HealthLevel): boolean {
    if (level === 'healthy') {
      this.counts.set(key, 0);
      return false;
    }
    if (level === 'unknown') return false;
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    if (next >= 2) {
      this.counts.set(key, 0);
      return true;
    }
    return false;
  }

  reset(key: string): void {
    this.counts.delete(key);
  }

  get(key: string): number {
    return this.counts.get(key) ?? 0;
  }
}

export interface RecoveryDeps {
  registry: RestartSpecRegistry;
  sessions: SessionManager;
  ktctl: KtctlService;
  recoverConnect: (params: ConnectParams) => Promise<void>;
  appendLog: (id: string, line: string) => void;
}

export class SessionRecovery {
  private recovering = new Set<string>();
  private recoveryCounts = new Map<string, number>();

  constructor(private deps: RecoveryDeps) {}

  isRecovering(key: string): boolean {
    return this.recovering.has(key);
  }

  getRecoveryCount(key: string): number {
    return this.recoveryCounts.get(key) ?? 0;
  }

  reset(key: string): void {
    this.recoveryCounts.delete(key);
    this.recovering.delete(key);
  }

  async recoverConnect(): Promise<void> {
    const key = 'connect';
    if (this.recovering.has(key)) return;
    const params = this.deps.registry.getConnect();
    if (!params) return;
    this.recovering.add(key);
    const n = (this.recoveryCounts.get(key) ?? 0) + 1;
    this.recoveryCounts.set(key, n);
    try {
      await this.deps.recoverConnect(params);
    } finally {
      this.recovering.delete(key);
    }
  }

  async recoverSession(sessionId: string): Promise<void> {
    if (this.recovering.has(sessionId)) return;
    const spec = this.deps.registry.getSession(sessionId);
    const session = this.deps.sessions.get(sessionId);
    if (!spec || !session) return;
    this.recovering.add(sessionId);
    const n = (this.recoveryCounts.get(sessionId) ?? 0) + 1;
    this.recoveryCounts.set(sessionId, n);
    this.deps.appendLog(
      sessionId,
      `[auto-recovery] 健康检查连续 2 次异常，正在自动重启（第 ${n} 次）…`,
    );
    try {
      await this.deps.ktctl.stopSession(sessionId);
      if (spec.type === 'forward') {
        this.deps.ktctl.startForward(spec.params);
      } else {
        this.deps.ktctl.startMesh(spec.profile, spec.localPort, spec.userId);
      }
    } finally {
      this.recovering.delete(sessionId);
    }
  }
}
