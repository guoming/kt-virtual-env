import {
  type HealthCheckResult,
  type HealthSnapshot,
  type Session,
} from '@kt-virtual-env/shared';
import { checkConnectHealth, checkSessionHealth } from './health-check.js';
import type { K8sService } from './k8s-service.js';
import type { KtctlService } from './ktctl-service.js';
import {
  buildProcessMissingLog,
  healthResultIndicatesConnectProcessMissing,
  healthResultIndicatesHelperMissing,
  healthResultIndicatesSessionProcessMissing,
  ProcessMissingTracker,
  shouldTrackProcessMissing,
} from './session-process-sync.js';

export class HealthMonitor {
  private timer: ReturnType<typeof setInterval> | null = null;
  private snapshot: HealthSnapshot = { connect: null, sessions: {} };
  private processMissingTracker = new ProcessMissingTracker();
  private helperMissingTracker = new ProcessMissingTracker();

  constructor(
    private deps: {
      intervalMs: number;
      getConnectSession: () => Session | undefined;
      isHelperRunning: () => Promise<boolean>;
      k8s: () => K8sService;
      listActiveSessions: () => Session[];
      ktctl: KtctlService;
      onChanged: (snapshot: HealthSnapshot) => void;
      onSessionProcessMissing?: (session: Session) => void;
      onConnectHelperMissing?: (session: Session) => void;
      isIntentionalConnectStop?: () => boolean;
      isConnectRecovering?: () => boolean;
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
      if (healthResultIndicatesHelperMissing(connectResult)) {
        this.trackHelperMissing(connectSession, connectResult);
      } else {
        this.helperMissingTracker.clear(connectSession.id);
        this.trackProcessPresence(
          connectSession,
          connectResult,
          healthResultIndicatesConnectProcessMissing,
        );
      }
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
        const result = await checkSessionHealth(s, this.deps.ktctl);
        nextSessions[s.id] = result;
        this.trackProcessPresence(s, result, healthResultIndicatesSessionProcessMissing);
      }),
    );

    this.processMissingTracker.prune(
      this.deps.listActiveSessions().map((s) => s.id),
    );
    this.helperMissingTracker.prune(
      this.deps.listActiveSessions().map((s) => s.id),
    );

    this.snapshot = { ...this.snapshot, sessions: nextSessions };
    this.deps.onChanged(this.snapshot);
  }

  private trackProcessPresence(
    session: Session,
    result: HealthCheckResult,
    isMissing: (result: HealthCheckResult) => boolean,
  ): void {
    if (!shouldTrackProcessMissing(session, result)) {
      this.processMissingTracker.clear(session.id);
      return;
    }

    if (session.type === 'connect' && this.deps.isIntentionalConnectStop?.()) {
      this.processMissingTracker.clear(session.id);
      return;
    }

    if (isMissing(result)) {
      this.processMissingTracker.recordMissing(session.id);
      if (this.processMissingTracker.shouldSync(session.id)) {
        this.processMissingTracker.clear(session.id);
        this.deps.onSessionProcessMissing?.(session);
      }
      return;
    }

    this.processMissingTracker.recordPresent(session.id);
  }

  // [AI-GEN] scope:trackHelperMissing, model:auto, reviewed:false
  private trackHelperMissing(session: Session, result: HealthCheckResult): void {
    if (!shouldTrackProcessMissing(session, result)) {
      this.helperMissingTracker.clear(session.id);
      return;
    }

    if (session.type === 'connect' && this.deps.isIntentionalConnectStop?.()) {
      this.helperMissingTracker.clear(session.id);
      return;
    }

    if (this.deps.isConnectRecovering?.()) {
      return;
    }

    this.helperMissingTracker.recordMissing(session.id);
    if (this.helperMissingTracker.shouldSync(session.id)) {
      this.helperMissingTracker.clear(session.id);
      this.deps.onConnectHelperMissing?.(session);
    }
  }
  // [/AI-GEN]
}
