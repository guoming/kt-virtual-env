// [AI-GEN] scope:health, model:auto, reviewed:false
export type HealthLevel = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface HealthCheckResult {
  level: HealthLevel;
  ok: boolean;
  message: string;
  details: string[];
  checkedAt: string;
}

export function buildHealthResult(
  level: HealthLevel,
  message: string,
  details: string[] = [],
): HealthCheckResult {
  return {
    level,
    ok: level === 'healthy',
    message,
    details,
    checkedAt: new Date().toISOString(),
  };
}
// [/AI-GEN]
