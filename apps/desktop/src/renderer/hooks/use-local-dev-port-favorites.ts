import { useCallback, useEffect, useState } from 'react';
import { requireKtveApi } from '../lib/api';

export function useLocalDevPortFavorites() {
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void requireKtveApi()
      .config.get()
      .then((cfg) => {
        const ports = (cfg.favoriteLocalDevPorts as number[] | undefined) ?? [];
        setFavorites(new Set(ports));
        setReady(true);
      });
  }, []);

  const toggleFavorite = useCallback(
    async (port: number) => {
      const next = new Set(favorites);
      if (next.has(port)) next.delete(port);
      else next.add(port);
      setFavorites(next);
      await requireKtveApi().config.save({
        favoriteLocalDevPorts: [...next].sort((a, b) => a - b),
      });
    },
    [favorites],
  );

  const isFavorite = useCallback((port: number) => favorites.has(port), [favorites]);

  return { favorites, toggleFavorite, isFavorite, ready, favoriteCount: favorites.size };
};
