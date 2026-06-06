import type { Session, SessionType } from '@kt-virtual-env/shared';

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
