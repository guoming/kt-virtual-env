export function parseAuthCanI(stdout: string): boolean {
  return stdout.trim().toLowerCase() === 'yes';
}

export const CONNECT_BASELINE_CHECKS = [
  { verb: 'create', resource: 'pods', label: '创建 Pod' },
  { verb: 'get', resource: 'pods', label: '读取 Pod' },
] as const;
