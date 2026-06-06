export const STAIN_URL_HISTORY_MAX = 20;

export function normalizeStainUrlHistoryEntry(url: string): string {
  return url.trim();
}

export function migrateStainUrlHistory(
  history: string[] | undefined,
  lastStainUrl?: string,
): string[] {
  const items = [...(history ?? [])];
  if (lastStainUrl) {
    return pushStainUrlHistory(items, lastStainUrl);
  }
  return items
    .map(normalizeStainUrlHistoryEntry)
    .filter(Boolean)
    .slice(0, STAIN_URL_HISTORY_MAX);
}

export function pushStainUrlHistory(history: string[], url: string): string[] {
  const entry = normalizeStainUrlHistoryEntry(url);
  if (!entry) return history;
  const next = [entry, ...history.filter((item) => item !== entry)];
  return next.slice(0, STAIN_URL_HISTORY_MAX);
}

export function removeStainUrlHistory(history: string[], url: string): string[] {
  const entry = normalizeStainUrlHistoryEntry(url);
  return history.filter((item) => item !== entry);
}

export function filterStainUrlHistory(history: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return history;
  return history.filter((item) => item.toLowerCase().includes(q));
}
