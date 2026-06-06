import { useCallback, useEffect, useState } from 'react';
import type { HealthCheckResult } from '@kt-virtual-env/shared';

export function useHealthPolling(
  runCheck: () => Promise<HealthCheckResult>,
  enabled: boolean,
  intervalMs = 10_000,
) {
  const [result, setResult] = useState<HealthCheckResult | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setResult(await runCheck());
    } finally {
      setLoading(false);
    }
  }, [runCheck]);

  useEffect(() => {
    if (!enabled) {
      setResult(null);
      return;
    }
    void refresh();
    const timer = setInterval(() => void refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [enabled, refresh, intervalMs]);

  return { result, loading, refresh };
}

export function useSessionsHealthPolling(
  runCheck: () => Promise<Record<string, HealthCheckResult>>,
  sessionIds: string[],
  intervalMs = 10_000,
) {
  const [map, setMap] = useState<Record<string, HealthCheckResult>>({});
  const [loading, setLoading] = useState(false);
  const key = sessionIds.join(',');

  const refresh = useCallback(async () => {
    if (sessionIds.length === 0) {
      setMap({});
      return;
    }
    setLoading(true);
    try {
      setMap(await runCheck());
    } finally {
      setLoading(false);
    }
  }, [runCheck, key]);

  useEffect(() => {
    void refresh();
    if (sessionIds.length === 0) return;
    const timer = setInterval(() => void refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [refresh, key, intervalMs, sessionIds.length]);

  return { map, loading, refresh };
}
