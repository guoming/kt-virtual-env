import {
  buildHealthResult,
  type HealthCheckResult,
  type HealthSnapshot,
  type Session,
} from '@kt-virtual-env/shared';
import { checkConnectHealth, checkSessionHealth } from './health-check.js';
import type { K8sService } from './k8s-service.js';
import type { KtctlService } from './ktctl-service.js';
import { FailureTracker, type SessionRecovery } from './session-recovery.js';

export class HealthMonitor {
  private timer: ReturnType<typeof setInterval> | null = null;
  private snapshot: HealthSnapshot = { connect: null, sessions: {} };
  private tracker = new FailureTracker();

  constructor(
    private deps: {
      intervalMs: number;
      getConnectSession: () => Session | undefined;
      isHelperRunning: () => Promise<boolean>;
      k8s: () => K8sService;
      listActiveSessions: () => Session[];
      ktctl: KtctlService;
      recovery: SessionRecovery;
      onChanged: (snapshot: HealthSnapshot) => void;
    },
  ) {}

  start(): void {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.deps.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  getSnapshot(): HealthSnapshot {
    return this.snapshot;
  }

  async forceCheck(): Promise<HealthSnapshot> {
    await this.tick();
    return this.snapshot;
  }

  private async tick(): Promise<void> {
    if (!this.deps.recovery.isRecovering('connect')) {
      const connectSession = this.deps.getConnectSession();
      const result = await checkConnectHealth(
        connectSession,
        await this.deps.isHelperRunning(),
        this.deps.k8s(),
      );
      const enriched = this.enrich('connect', result);
      this.snapshot = { ...this.snapshot, connect: enriched };
      if (this.tracker.record('connect', enriched.level)) {
        await this.deps.recovery.recoverConnect();
      }
    }

    const sessions = this.deps
      .listActiveSessions()
      .filter((s) => s.type !== 'connect' && s.state === 'running');
    const nextSessions: Record<string, HealthCheckResult> = { ...this.snapshot.sessions };

    for (const id of Object.keys(nextSessions)) {
      if (!sessions.some((s) => s.id === id)) {
        delete nextSessions[id];
        this.tracker.reset(id);
        this.deps.recovery.reset(id);
      }
    }

    await Promise.all(
      sessions.map(async (s) => {
        if (this.deps.recovery.isRecovering(s.id)) return;
        const result = await checkSessionHealth(s, this.deps.ktctl);
        const enriched = this.enrich(s.id, result);
        nextSessions[s.id] = enriched;
        if (this.tracker.record(s.id, enriched.level)) {
          await this.deps.recovery.recoverSession(s.id);
        }
      }),
    );

    this.snapshot = { ...this.snapshot, sessions: nextSessions };
    this.deps.onChanged(this.snapshot);
  }

  private enrich(key: string, result: HealthCheckResult): HealthCheckResult {
    const count = this.deps.recovery.getRecoveryCount(key);
    return buildHealthResult(result.level, result.message, result.details, {
      recovering: this.deps.recovery.isRecovering(key),
      autoRecoveryCount: count > 0 ? count : undefined,
    });
  }
}
