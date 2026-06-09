import type { MeshProfile } from './types.js';

// [AI-GEN] scope:local-dev-port, model:auto, reviewed:false
export type DevRuntime = 'docker' | 'java' | 'php' | 'node' | 'dotnet' | 'go' | 'other';

export const SUPPORTED_DEV_RUNTIMES: DevRuntime[] = [
  'docker',
  'java',
  'php',
  'node',
  'dotnet',
  'go',
];

export interface LocalDevPort {
  port: number;
  host: string;
  runtime: DevRuntime;
  processName: string;
  /** 从启动命令解析出的服务/项目名，便于识别端口归属 */
  serviceName: string;
  pid: number;
}

export function isSupportedDevRuntime(runtime: DevRuntime): boolean {
  return SUPPORTED_DEV_RUNTIMES.includes(runtime);
}

export function classifyDevRuntime(processName: string, commandLine?: string): DevRuntime {
  const name = processName.toLowerCase();
  const cmd = commandLine?.toLowerCase() ?? '';

  if (
    name.includes('docker') ||
    name.includes('com.docke') ||
    name.includes('docker-pr') ||
    name.includes('vpnkit') ||
    /\bdocker\s+(run|compose|proxy)\b/.test(cmd)
  ) {
    return 'docker';
  }

  if (
    name === 'php' ||
    name.startsWith('php-') ||
    name.includes('php-fpm') ||
    name.includes('php-cgi') ||
    /\bphp\b/.test(cmd)
  ) {
    return 'php';
  }

  if (
    name === 'go' ||
    /\bgo\s+run\b/.test(cmd) ||
    /\bgo-build\b/.test(cmd) ||
    /\/\.cache\/go-build\//.test(cmd)
  ) {
    return 'go';
  }

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

  if (
    name.includes('dotnet') ||
    name === 'dotnet' ||
    name.includes('servicehub') ||
    name.includes('iisexpress') ||
    name === 'w3wp' ||
    name.includes('mono')
  ) {
    return 'dotnet';
  }

  return 'other';
}

function pathBaseName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.split('/').pop() ?? filePath;
}

function stripKnownExt(name: string): string {
  return name.replace(/\.(jar|dll|exe|js|ts|mjs|cjs|go|php)$/i, '');
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
    const seg = segments[i]!;
    if (!GENERIC_DIR_NAMES.has(seg.toLowerCase()) && !seg.startsWith('.')) {
      return seg;
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

  if (runtime === 'php') {
    const artisanMatch = cmd.match(/\bartisan\b/i);
    if (artisanMatch) {
      const project = projectNameFromPath(cmd);
      if (project) return project;
      return 'laravel';
    }
    const scriptMatch = cmd.match(/\bphp\s+(?:-S\s+\S+\s+)?["']?([^\s"']+\.php)/i);
    if (scriptMatch?.[1]) {
      const base = stripKnownExt(pathBaseName(scriptMatch[1]));
      if (!GENERIC_SCRIPT_NAMES.has(base.toLowerCase())) return base;
      const project = projectNameFromPath(scriptMatch[1]);
      if (project) return project;
    }
  }

  if (runtime === 'go') {
    const goRunMatch = cmd.match(/\bgo\s+run\s+([^\s]+)/i);
    if (goRunMatch?.[1]) {
      const target = goRunMatch[1];
      if (target.startsWith('./') || target.includes('/')) {
        const base = stripKnownExt(pathBaseName(target));
        if (!GENERIC_SCRIPT_NAMES.has(base.toLowerCase())) return base;
        const project = projectNameFromPath(target);
        if (project) return project;
      }
      return stripKnownExt(target);
    }
    const project = projectNameFromPath(cmd);
    if (project) return project;
  }

  if (runtime === 'docker') {
    const containerMatch = cmd.match(/(?:^|\s)(?:[^/\\]+:)?([^/\\:]+):/);
    if (containerMatch?.[1] && !containerMatch[1].includes(' ')) {
      return containerMatch[1];
    }
    if (processName.toLowerCase().includes('proxy')) return 'docker-proxy';
  }

  return processName;
}

/** 收藏端口优先，同组内按端口号升序 */
export function sortLocalDevPortsByFavorites(
  ports: LocalDevPort[],
  favoritePorts: Iterable<number>,
): LocalDevPort[] {
  const favorites = new Set(favoritePorts);
  return [...ports].sort((a, b) => {
    const aFav = favorites.has(a.port) ? 0 : 1;
    const bFav = favorites.has(b.port) ? 0 : 1;
    if (aFav !== bFav) return aFav - bFav;
    return a.port - b.port;
  });
}

/** 已收藏但当前未监听的端口 */
export function listOfflineFavoritePorts(
  discovered: LocalDevPort[],
  favoritePorts: Iterable<number>,
): number[] {
  const live = new Set(discovered.map((d) => d.port));
  return [...new Set(favoritePorts)]
    .filter((port) => !live.has(port))
    .sort((a, b) => a - b);
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
    case 'docker':
      return 'Docker';
    case 'java':
      return 'Java';
    case 'php':
      return 'PHP';
    case 'node':
      return 'Node';
    case 'dotnet':
      return 'C#';
    case 'go':
      return 'Go';
    default:
      return '其他';
  }
}

/** 按端口号前缀或服务/进程/运行时名称过滤本地端口 */
export function filterLocalDevPorts(ports: LocalDevPort[], query: string): LocalDevPort[] {
  const q = query.trim();
  if (!q) return ports;

  if (/^\d+$/.test(q)) {
    return ports.filter((d) => String(d.port).startsWith(q));
  }

  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  return ports.filter((d) => {
    const fields = [
      String(d.port),
      d.serviceName,
      d.processName,
      runtimeLabel(d.runtime),
      d.runtime,
    ].map((s) => s.toLowerCase());
    return tokens.every(
      (token) =>
        fields.some((field) => field.includes(token)) ||
        String(d.port).includes(token),
    );
  });
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
