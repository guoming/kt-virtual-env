import type { HealthCheckResult, HealthSnapshot, Session, SessionType } from '@kt-virtual-env/shared';

export type ConnectNavStatus = 'disconnected' | 'connecting' | 'connected' | 'failed';

/** 右侧面板展示的会话：进行中或异常退出，不含已停止 */
export function isPanelSession(s: Session): boolean {
  return (
    s.state === 'running' ||
    s.state === 'starting' ||
    s.state === 'pending' ||
    s.state === 'failed'
  );
}

export function isActiveSession(s: Session): boolean {
  return s.state === 'running' || s.state === 'starting' || s.state === 'pending';
}

export function canStopSession(s: Session): boolean {
  return isActiveSession(s) || s.state === 'failed';
}

export function getSessionHealth(
  session: Session,
  snapshot: HealthSnapshot,
): HealthCheckResult | undefined {
  if (session.type === 'connect') {
    return snapshot.connect ?? undefined;
  }
  return snapshot.sessions[session.id];
}

export function canRetrySession(s: Session, health?: HealthCheckResult): boolean {
  if (s.state === 'failed') return true;
  if (s.state !== 'running') return false;
  if (!health) return false;
  return health.level === 'unhealthy' || health.level === 'degraded';
}

export function showSessionActions(s: Session, health?: HealthCheckResult): boolean {
  return canStopSession(s) || canRetrySession(s, health);
}

export function getConnectNavStatus(sessions: Session[]): ConnectNavStatus {
  const connect = sessions.find((s) => s.type === 'connect' && s.state !== 'stopped');
  if (!connect) return 'disconnected';
  if (connect.state === 'running') return 'connected';
  if (connect.state === 'failed') return 'failed';
  return 'connecting';
}

export function countActiveByType(sessions: Session[], type: SessionType): number {
  return sessions.filter((s) => s.type === type && isActiveSession(s)).length;
}
