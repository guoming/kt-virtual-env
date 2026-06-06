import { useCallback, useEffect, useState } from 'react';
import { requireKtveApi } from '../lib/api';

export type FavoriteKind = 'mesh' | 'forward';

const CONFIG_KEY: Record<FavoriteKind, 'favoriteMeshKeys' | 'favoriteForwardKeys'> = {
  mesh: 'favoriteMeshKeys',
  forward: 'favoriteForwardKeys',
};

export function useServiceFavorites(kind: FavoriteKind) {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void requireKtveApi()
      .config.get()
      .then((cfg) => {
        const keys = (cfg[CONFIG_KEY[kind]] as string[] | undefined) ?? [];
        setFavorites(new Set(keys));
        setReady(true);
      });
  }, [kind]);

  const toggleFavorite = useCallback(
    async (key: string) => {
      const next = new Set(favorites);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setFavorites(next);
      await requireKtveApi().config.save({ [CONFIG_KEY[kind]]: [...next] });
    },
    [favorites, kind],
  );

  const isFavorite = useCallback((key: string) => favorites.has(key), [favorites]);

  return { favorites, toggleFavorite, isFavorite, ready, favoriteCount: favorites.size };
}
