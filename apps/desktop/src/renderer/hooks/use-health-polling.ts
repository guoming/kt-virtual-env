import { useCallback, useEffect, useState } from 'react';
import type { HealthCheckResult, HealthSnapshot } from '@kt-virtual-env/shared';
import { requireKtveApi } from '../lib/api';

export function useHealthPolling(
  select: (snapshot: HealthSnapshot) => HealthCheckResult | null,
  enabled: boolean,
) {
  const [result, setResult] = useState<HealthCheckResult | null>(null);
  const [loading, setLoading] = useState(false);

  const applySnapshot = useCallback(
    (snapshot: HealthSnapshot) => {
      setResult(select(snapshot));
    },
    [select],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await requireKtveApi().health.forceCheck();
      applySnapshot(snapshot);
    } finally {
      setLoading(false);
    }
  }, [applySnapshot]);

  useEffect(() => {
    if (!enabled) {
      setResult(null);
      return;
    }
    const api = requireKtveApi();
    void api.health.getSnapshot().then(applySnapshot);
    return api.health.onChanged(applySnapshot);
  }, [enabled, applySnapshot]);

  return { result, loading, refresh };
}

export function useSessionsHealthPolling(sessionIds: string[]) {
  const [map, setMap] = useState<Record<string, HealthCheckResult>>({});
  const [loading, setLoading] = useState(false);
  const key = sessionIds.join(',');

  const applySnapshot = useCallback(
    (snapshot: HealthSnapshot) => {
      if (sessionIds.length === 0) {
        setMap({});
        return;
      }
      const out: Record<string, HealthCheckResult> = {};
      for (const id of sessionIds) {
        const hit = snapshot.sessions[id];
        if (hit) out[id] = hit;
      }
      setMap(out);
    },
    [key],
  );

  const refresh = useCallback(async () => {
    if (sessionIds.length === 0) {
      setMap({});
      return;
    }
    setLoading(true);
    try {
      const snapshot = await requireKtveApi().health.forceCheck();
      applySnapshot(snapshot);
    } finally {
      setLoading(false);
    }
  }, [applySnapshot, key, sessionIds.length]);

  useEffect(() => {
    const api = requireKtveApi();
    void api.health.getSnapshot().then(applySnapshot);
    return api.health.onChanged(applySnapshot);
  }, [applySnapshot, key, sessionIds.length]);

  return { map, loading, refresh };
}
