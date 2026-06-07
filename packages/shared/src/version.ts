/** 从 CLI 输出或版本字符串中提取 semver（如 0.3.7、1.28.15） */
export function parseSemver(text: string): string | undefined {
  const match = text.match(/v?(\d+\.\d+\.\d+(?:[-+][\w.]*)?)/i);
  return match?.[1]?.replace(/^v/i, '');
}

export function compareSemver(a: string, b: string): number {
  const parts = (v: string) =>
    v
      .replace(/^v/i, '')
      .split(/[-+]/)[0]!
      .split('.')
      .map((n) => Number.parseInt(n, 10) || 0);
  const av = parts(a);
  const bv = parts(b);
  const len = Math.max(av.length, bv.length);
  for (let i = 0; i < len; i++) {
    const diff = (av[i] ?? 0) - (bv[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

export function isVersionNewer(latest: string, current: string): boolean {
  return compareSemver(latest, current) > 0;
}
