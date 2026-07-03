import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { LocalDevPort, MeshProfile } from '@kt-virtual-env/shared';
import {
  classifyDevRuntime,
  deriveServiceName,
  isSupportedDevRuntime,
  suggestMeshPortFromDiscovery,
} from '@kt-virtual-env/shared';
import { isLocalPortOpen } from './process-utils.js';
import { resolvePowershellPath } from './powershell-path.js';
import { withWindowsExecOptions } from './windows-spawn.js';

const execFileAsync = promisify(execFile);

const SKIP_PROCESS = new Set([
  'ktctl',
  'kubectl',
  'electron',
  'cursor',
  'kt-virtual-env',
  'privileged-helper',
]);

function shouldSkipProcess(name: string): boolean {
  const lower = name.toLowerCase();
  return [...SKIP_PROCESS].some((s) => lower.includes(s));
}

function parseListenAddress(name: string): { host: string; port: number } | null {
  // *:8080  127.0.0.1:8080  [::1]:5173
  const m = name.match(/(?:\*|([\d.]+)|\[([^\]]+)\]):(\d+)$/);
  if (!m) return null;
  const host = m[1] ?? m[2] ?? '*';
  const port = Number.parseInt(m[3]!, 10);
  if (!Number.isFinite(port) || port <= 0) return null;
  return { host, port };
}

function dedupePorts(rows: LocalDevPort[]): LocalDevPort[] {
  const map = new Map<number, LocalDevPort>();
  for (const row of rows) {
    const existing = map.get(row.port);
    if (!existing) {
      map.set(row.port, row);
      continue;
    }
    const preferNew =
      !isSupportedDevRuntime(existing.runtime) && isSupportedDevRuntime(row.runtime);
    const preferNamedService =
      existing.serviceName === existing.processName &&
      row.serviceName !== row.processName;
    if (preferNew || preferNamedService) {
      map.set(row.port, row);
    }
  }
  return [...map.values()].sort((a, b) => a.port - b.port);
}

/** 解析 docker ps PORTS 列，例如 0.0.0.0:8080->80/tcp */
export function parseDockerPublishedPorts(
  containerName: string,
  portsField: string,
): LocalDevPort[] {
  const rows: LocalDevPort[] = [];
  const seen = new Set<number>();
  for (const segment of portsField.split(',')) {
    const trimmed = segment.trim();
    const match = trimmed.match(/:(\d+)->\d+\/(?:tcp|udp)/i);
    if (!match) continue;
    const port = Number.parseInt(match[1]!, 10);
    if (!Number.isFinite(port) || port <= 0 || seen.has(port)) continue;
    seen.add(port);
    const hostMatch = trimmed.match(/^([\d.]+|\[::\]|\[::1\]|0\.0\.0\.0):/);
    const host = hostMatch?.[1]?.replace(/^\[|\]$/g, '') ?? '*';
    rows.push({
      port,
      host: host === '::' ? '*' : host,
      runtime: 'docker',
      processName: 'docker',
      serviceName: containerName,
      pid: 0,
    });
  }
  return rows;
}

async function discoverDockerPublishedPorts(): Promise<LocalDevPort[]> {
  try {
    const { stdout } = await execFileAsync(
      'docker',
      ['ps', '--format', '{{.Names}}\t{{.Ports}}'],
      withWindowsExecOptions({ timeout: 10_000, maxBuffer: 2 * 1024 * 1024 }),
    );
    const rows: LocalDevPort[] = [];
    for (const line of stdout.split('\n')) {
      const tab = line.indexOf('\t');
      if (tab <= 0) continue;
      const name = line.slice(0, tab).trim();
      const ports = line.slice(tab + 1).trim();
      if (!name || !ports) continue;
      rows.push(...parseDockerPublishedPorts(name, ports));
    }
    return rows;
  } catch {
    return [];
  }
}

// [AI-GEN] scope:parseLsofListenLine, model:auto, reviewed:false
export function parseLsofListenLine(line: string): LocalDevPort | null {
  if (!line.includes('(LISTEN)')) return null;
  const listenMatch = line.match(/\s(\S+:\d+)\s+\(LISTEN\)/);
  if (!listenMatch) return null;
  const parts = line.trim().split(/\s+/);
  if (parts.length < 3) return null;
  const processName = parts[0]!;
  const pid = Number.parseInt(parts[1]!, 10);
  if (shouldSkipProcess(processName) || !Number.isFinite(pid)) return null;
  const parsed = parseListenAddress(listenMatch[1]!);
  if (!parsed) return null;
  if (
    parsed.host !== '*' &&
    parsed.host !== '0.0.0.0' &&
    parsed.host !== '127.0.0.1' &&
    parsed.host !== '::1'
  ) {
    return null;
  }
  return {
    port: parsed.port,
    host: parsed.host,
    runtime: classifyDevRuntime(processName),
    processName,
    serviceName: processName,
    pid,
  };
}

function getPowershellExecutable(): string {
  return resolvePowershellPath();
}

async function resolveCommandLine(pid: number): Promise<string | undefined> {
  try {
    if (process.platform === 'win32') {
      const script = `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CommandLine`;
      const { stdout } = await execFileAsync(getPowershellExecutable(), ['-NoProfile', '-Command', script], withWindowsExecOptions({
        maxBuffer: 1024 * 1024,
      }));
      const line = stdout.trim();
      return line || undefined;
    }
    const { stdout } = await execFileAsync('ps', ['-p', String(pid), '-o', 'command='], {
      maxBuffer: 1024 * 1024,
    });
    const line = stdout.trim();
    return line || undefined;
  } catch {
    return undefined;
  }
}

async function enrichServiceNames(rows: LocalDevPort[]): Promise<LocalDevPort[]> {
  const commandCache = new Map<number, string | undefined>();
  const enriched: LocalDevPort[] = [];
  for (const row of rows) {
    let commandLine: string | undefined;
    if (row.pid > 0) {
      let cached = commandCache.get(row.pid);
      if (cached === undefined) {
        cached = await resolveCommandLine(row.pid);
        commandCache.set(row.pid, cached);
      }
      commandLine = cached;
    }
    const runtime =
      row.runtime === 'docker' && row.serviceName !== row.processName
        ? 'docker'
        : classifyDevRuntime(row.processName, commandLine);
    enriched.push({
      ...row,
      runtime,
      serviceName:
        row.runtime === 'docker' && row.serviceName !== row.processName
          ? row.serviceName
          : deriveServiceName(runtime, row.processName, commandLine),
    });
  }
  return enriched;
}

async function finalizeDiscoveredPorts(rows: LocalDevPort[]): Promise<LocalDevPort[]> {
  const enriched = await enrichServiceNames(dedupePorts(rows));
  return enriched.filter((row) => isSupportedDevRuntime(row.runtime));
}

async function discoverDarwin(): Promise<LocalDevPort[]> {
  const { stdout } = await execFileAsync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'], {
    maxBuffer: 4 * 1024 * 1024,
  });
  const rows: LocalDevPort[] = [];
  for (const line of stdout.split('\n').slice(1)) {
    const row = parseLsofListenLine(line);
    if (row) rows.push(row);
  }
  const dockerRows = await discoverDockerPublishedPorts();
  return finalizeDiscoveredPorts([...rows, ...dockerRows]);
}
// [/AI-GEN]

async function discoverWindows(): Promise<LocalDevPort[]> {
  const script = [
    'Get-NetTCPConnection -State Listen |',
    'Where-Object { $_.LocalPort -ge 1024 } |',
    'ForEach-Object {',
    '  $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue;',
    '  if ($p) { [PSCustomObject]@{ Port=$_.LocalPort; Host=$_.LocalAddress; Name=$p.ProcessName; Pid=$p.Id } }',
    '}',
  ].join(' ');
  const { stdout } = await execFileAsync(
    getPowershellExecutable(),
    ['-NoProfile', '-Command', script],
    withWindowsExecOptions({ maxBuffer: 4 * 1024 * 1024 }),
  );
  const rows: LocalDevPort[] = [];
  for (const line of stdout.split('\n')) {
    const m = line.trim().match(/(\d+)\s+([\d.:]+)\s+(\S+)\s+(\d+)/);
    if (!m) continue;
    const port = Number.parseInt(m[1]!, 10);
    const host = m[2]!;
    const processName = m[3]!;
    const pid = Number.parseInt(m[4]!, 10);
    if (shouldSkipProcess(processName)) continue;
    rows.push({
      port,
      host,
      runtime: classifyDevRuntime(processName),
      processName,
      serviceName: processName,
      pid,
    });
  }
  const dockerRows = await discoverDockerPublishedPorts();
  return finalizeDiscoveredPorts([...rows, ...dockerRows]);
}

export async function discoverLocalDevPorts(): Promise<LocalDevPort[]> {
  try {
    if (process.platform === 'win32') {
      return await discoverWindows();
    }
    return await discoverDarwin();
  } catch {
    return [];
  }
}

export async function pickMeshLocalPort(
  profile: MeshProfile,
  reserved: number[],
): Promise<LocalDevPort> {
  const discovered = await discoverLocalDevPorts();
  const hit = suggestMeshPortFromDiscovery(profile, discovered, reserved);
  if (!hit) {
    const runtimes = 'Docker / Java / PHP / Node / C# / Go';
    throw new Error(
      `未检测到 ${runtimes} 本地监听端口，请先在本机启动应用。`,
    );
  }
  await validateMeshLocalPort(hit.port);
  return hit;
}

/** Mesh 转发目标须为本机已有服务监听的端口（占用是预期状态） */
export async function validateMeshLocalPort(port: number): Promise<void> {
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error('端口无效，请输入 1–65535 之间的数字');
  }
  const listening = await isLocalPortOpen(port, '127.0.0.1');
  if (!listening) {
    throw new Error(`本地端口 ${port} 无服务监听，请先启动应用或检查端口是否正确`);
  }
}
