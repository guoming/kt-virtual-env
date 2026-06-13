import type { HealthCheckResult, Session } from '@kt-virtual-env/shared';

/** 连续 N 次探测不到进程后再同步会话，避免 pgrep 瞬时误判 */
export const PROCESS_MISSING_SYNC_THRESHOLD = 2;

const CONNECT_PROCESS_MISSING = '未找到 ktctl connect 进程';
const SESSION_PROCESS_MISSING = 'ktctl 进程未运行';
const HELPER_NOT_RUNNING = '组网 Helper 未运行';

export function healthResultIndicatesConnectProcessMissing(result: HealthCheckResult): boolean {
  return result.details.some((line) => line.includes(CONNECT_PROCESS_MISSING));
}

export function healthResultIndicatesSessionProcessMissing(result: HealthCheckResult): boolean {
  return result.details.some((line) => line.includes(SESSION_PROCESS_MISSING));
}

// [AI-GEN] scope:healthResultIndicatesHelperMissing, model:auto, reviewed:false
export function healthResultIndicatesHelperMissing(result: HealthCheckResult): boolean {
  return result.details.some((line) => line.includes(HELPER_NOT_RUNNING));
}
// [/AI-GEN]

// [AI-GEN] scope:buildHelperMissingLog, model:auto, reviewed:false
export function buildHelperMissingLog(): string {
  return '[connect] 组网 Helper 已停止，正在尝试自动恢复连接…';
}

export function buildHelperRecoveryFailedLog(message: string): string {
  return `[connect] 自动恢复失败：${message}。请在「设置 → 环境检测」点击「授权组网」完成一次性授权。`;
}
// [/AI-GEN]

export function shouldTrackProcessMissing(session: Session, result: HealthCheckResult): boolean {
  if (session.state !== 'running') return false;
  if (result.level === 'unknown') return false;
  return true;
}

export class ProcessMissingTracker {
  private streaks = new Map<string, number>();

  recordMissing(sessionId: string): number {
    const next = (this.streaks.get(sessionId) ?? 0) + 1;
    this.streaks.set(sessionId, next);
    return next;
  }

  recordPresent(sessionId: string): void {
    this.streaks.delete(sessionId);
  }

  clear(sessionId: string): void {
    this.streaks.delete(sessionId);
  }

  shouldSync(sessionId: string): boolean {
    return (this.streaks.get(sessionId) ?? 0) >= PROCESS_MISSING_SYNC_THRESHOLD;
  }

  prune(activeSessionIds: Iterable<string>): void {
    const active = new Set(activeSessionIds);
    for (const id of this.streaks.keys()) {
      if (!active.has(id)) {
        this.streaks.delete(id);
      }
    }
  }
}

export function buildProcessMissingLog(session: Session): string {
  if (session.type === 'connect') {
    return '[connect] ktctl connect 进程已消失，请点击「重试」重新连接';
  }
  const label = session.type === 'mesh' ? '流量转发' : '端口转发';
  return `[health] ${label} ${session.target} 的 ktctl 进程已消失，请点击「重试」重新启动`;
}
