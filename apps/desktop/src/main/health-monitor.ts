import {
  type HealthCheckResult,
  type HealthSnapshot,
  type Session,
} from '@kt-virtual-env/shared';
import { checkConnectHealth, checkSessionHealth } from './health-check.js';
import type { K8sService } from './k8s-service.js';
import type { KtctlService } from './ktctl-service.js';

export class HealthMonitor {
  private timer: ReturnType<typeof setInterval> | null = null;
  private snapshot: HealthSnapshot = { connect: null, sessions: {} };

  constructor(
    private deps: {
      intervalMs: number;
      getConnectSession: () => Session | undefined;
      isHelperRunning: () => Promise<boolean>;
      k8s: () => K8sService;
      listActiveSessions: () => Session[];
      ktctl: KtctlService;
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
    const connectSession = this.deps.getConnectSession();
    let connectResult: HealthCheckResult | null = null;

    if (connectSession) {
      connectResult = await checkConnectHealth(
        connectSession,
        await this.deps.isHelperRunning(),
        this.deps.k8s(),
      );
    }

    this.snapshot = { ...this.snapshot, connect: connectResult };

    const sessions = this.deps
      .listActiveSessions()
      .filter((s) => s.type !== 'connect' && s.state === 'running');
    const nextSessions: Record<string, HealthCheckResult> = { ...this.snapshot.sessions };

    for (const id of Object.keys(nextSessions)) {
      if (!sessions.some((s) => s.id === id)) {
        delete nextSessions[id];
      }
    }

    await Promise.all(
      sessions.map(async (s) => {
        nextSessions[s.id] = await checkSessionHealth(s, this.deps.ktctl);
      }),
    );

    this.snapshot = { ...this.snapshot, sessions: nextSessions };
    this.deps.onChanged(this.snapshot);
  }
}
