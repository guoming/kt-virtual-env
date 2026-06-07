// [AI-GEN] scope:health, model:auto, reviewed:false
export type HealthLevel = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface HealthCheckResult {
  level: HealthLevel;
  ok: boolean;
  message: string;
  details: string[];
  checkedAt: string;
  recovering?: boolean;
  autoRecoveryCount?: number;
}

export interface HealthSnapshot {
  connect: HealthCheckResult | null;
  sessions: Record<string, HealthCheckResult>;
}

export function buildHealthResult(
  level: HealthLevel,
  message: string,
  details: string[] = [],
  extras?: Pick<HealthCheckResult, 'recovering' | 'autoRecoveryCount'>,
): HealthCheckResult {
  return {
    level,
    ok: level === 'healthy',
    message,
    details,
    checkedAt: new Date().toISOString(),
    ...extras,
  };
}
// [/AI-GEN]
