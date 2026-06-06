import { buildMeshVersion } from './mesh-command.js';

/** 将输入解析为最终注入的 x-virtual-env 值 */
export function resolveStainVirtualEnv(input: string, meshUserId: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  const id = meshUserId.trim();
  if (!id) return trimmed;
  if (trimmed.endsWith(`.${id}`)) return trimmed;

  try {
    return buildMeshVersion(trimmed, id);
  } catch {
    return trimmed;
  }
}

export function filterMeshSessionsByQuery<T extends { virtualEnv?: string; target: string; namespace: string }>(
  sessions: T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return sessions;
  return sessions.filter((s) => {
    const env = (s.virtualEnv ?? '').toLowerCase();
    const label = `${s.target} ${s.namespace}`.toLowerCase();
    return env.includes(q) || label.includes(q);
  });
}
