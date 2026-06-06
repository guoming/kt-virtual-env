import { buildHealthResult, type HealthCheckResult, type HealthLevel } from '@kt-virtual-env/shared';

const LEVEL_RANK: Record<HealthLevel, number> = {
  unknown: 0,
  healthy: 1,
  degraded: 2,
  unhealthy: 3,
};

export function summarizeHealth(results: HealthCheckResult[]): HealthCheckResult | null {
  if (results.length === 0) return null;

  let worst: HealthLevel = 'healthy';
  const details: string[] = [];

  for (const r of results) {
    if (LEVEL_RANK[r.level] > LEVEL_RANK[worst]) worst = r.level;
    details.push(`${r.ok ? '✓' : '✗'} ${r.message}`);
  }

  const healthyCount = results.filter((r) => r.level === 'healthy').length;
  const message =
    worst === 'healthy'
      ? `全部 ${results.length} 项正常`
      : `${healthyCount}/${results.length} 项正常`;

  return buildHealthResult(worst, message, details);
}
