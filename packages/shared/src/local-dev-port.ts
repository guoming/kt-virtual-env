import type { MeshProfile } from './types.js';

// [AI-GEN] scope:local-dev-port, model:auto, reviewed:false
export type DevRuntime = 'java' | 'node' | 'dotnet' | 'other';

export interface LocalDevPort {
  port: number;
  host: string;
  runtime: DevRuntime;
  processName: string;
  /** 从启动命令解析出的服务/项目名，便于识别端口归属 */
  serviceName: string;
  pid: number;
}

export function classifyDevRuntime(processName: string): DevRuntime {
  const name = processName.toLowerCase();
  if (
    name.includes('java') ||
    name === 'javaw' ||
    name.includes('spring') ||
    name.includes('maven') ||
    name.includes('gradle')
  ) {
    return 'java';
  }
  if (
    name === 'node' ||
    name.includes('node') ||
    name === 'npm' ||
    name === 'npx' ||
    name === 'bun' ||
    name === 'deno' ||
    name.includes('vite')
  ) {
    return 'node';
  }
  if (name.includes('dotnet') || name === 'dotnet' || name.includes('servicehub')) {
    return 'dotnet';
  }
  return 'other';
}

function pathBaseName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.split('/').pop() ?? filePath;
}

function stripKnownExt(name: string): string {
  return name.replace(/\.(jar|dll|exe|js|ts|mjs|cjs)$/i, '');
}

const GENERIC_SCRIPT_NAMES = new Set(['index', 'main', 'server', 'app', 'start', 'dev']);
const GENERIC_DIR_NAMES = new Set([
  'dist',
  'build',
  'out',
  'target',
  'bin',
  'lib',
  'src',
  'node_modules',
  '.',
  '..',
]);

function projectNameFromPath(filePath: string): string | undefined {
  const segments = filePath.replace(/\\/g, '/').split('/').filter(Boolean);
  if (segments.length < 2) return undefined;
  for (let i = segments.length - 2; i >= 0; i--) {
    const name = segments[i]!;
    if (!GENERIC_DIR_NAMES.has(name.toLowerCase()) && !name.startsWith('.')) {
      return name;
    }
  }
  return undefined;
}

/** 从进程命令行推断可读的本地服务名 */
export function deriveServiceName(
  runtime: DevRuntime,
  processName: string,
  commandLine?: string,
): string {
  const cmd = commandLine?.trim();
  if (!cmd) return processName;

  if (runtime === 'java') {
    const jarMatch = cmd.match(/-jar\s+["']?([^"'\s]+)/i);
    if (jarMatch?.[1]) {
      return stripKnownExt(pathBaseName(jarMatch[1]));
    }
    const tokens = cmd.split(/\s+/).filter((t) => t && !t.startsWith('-'));
    for (let i = tokens.length - 1; i >= 0; i--) {
      const token = tokens[i]!;
      if (!token.includes('.') || token.includes('/')) continue;
      if (/^[a-z][\w.]*$/i.test(token)) {
        const simple = token.split('.').pop()!;
        if (simple.length > 2 && !['jar', 'java'].includes(simple.toLowerCase())) {
          return simple;
        }
      }
    }
  }

  if (runtime === 'node') {
    const scriptMatch = cmd.match(
      /(?:^|\s)(?:node|bun|deno|npm|npx|pnpm|yarn)\s+(?:run\s+)?["']?([^\s"']+)/i,
    );
    if (scriptMatch?.[1]) {
      const target = scriptMatch[1];
      if (!target.startsWith('-')) {
        if (!target.includes('/') && !target.includes('\\')) {
          return target;
        }
        const base = stripKnownExt(pathBaseName(target));
        if (!GENERIC_SCRIPT_NAMES.has(base.toLowerCase())) {
          return base;
        }
        const project = projectNameFromPath(target);
        if (project) return project;
      }
    }
  }

  if (runtime === 'dotnet') {
    const dllMatch = cmd.match(/([^\s/\\]+)\.dll/i);
    if (dllMatch?.[1]) return dllMatch[1];
    const projectMatch = cmd.match(/--project\s+["']?([^"'\s]+)/i);
    if (projectMatch?.[1]) {
      return stripKnownExt(pathBaseName(projectMatch[1]));
    }
  }

  return processName;
}

export function formatLocalDevPortLabel(port: LocalDevPort): string {
  const runtime = runtimeLabel(port.runtime);
  if (port.serviceName && port.serviceName !== port.processName) {
    return `${port.port} · ${port.serviceName} (${runtime})`;
  }
  return `${port.port} (${runtime})`;
}

export function runtimeLabel(runtime: DevRuntime): string {
  switch (runtime) {
    case 'java':
      return 'Java';
    case 'node':
      return 'Node';
    case 'dotnet':
      return '.NET';
    default:
      return '其他';
  }
}

/** 为 Mesh 从已发现的本地开发端口中选择最匹配的一项 */
export function suggestMeshPortFromDiscovery(
  profile: MeshProfile,
  discovered: LocalDevPort[],
  reserved: number[],
): LocalDevPort | undefined {
  const taken = new Set(reserved);
  const available = discovered.filter((d) => !taken.has(d.port));
  if (available.length === 0) return undefined;

  const byPort = (port: number) => available.find((d) => d.port === port);

  return (
    byPort(profile.containerPort) ??
    byPort(profile.suggestedLocalPort) ??
    available[0]
  );
}
// [/AI-GEN]
