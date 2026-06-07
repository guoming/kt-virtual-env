const APP_REPO = 'guoming/kt-virtual-env';
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedLatest: string | undefined;
let cachedAt = 0;

export async function fetchLatestAppVersion(): Promise<string | undefined> {
  if (cachedLatest && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedLatest;
  }
  try {
    const res = await fetch(`https://api.github.com/repos/${APP_REPO}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'kt-virtual-env',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return cachedLatest;
    const data = (await res.json()) as { tag_name?: string };
    const latest = data.tag_name?.replace(/^v/i, '');
    if (latest) {
      cachedLatest = latest;
      cachedAt = Date.now();
    }
    return latest;
  } catch {
    return cachedLatest;
  }
}
