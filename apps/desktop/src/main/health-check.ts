import { execFile } from 'node:child_process';
import dns from 'node:dns/promises';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  buildHealthResult,
  type HealthCheckResult,
  type Session,
} from '@kt-virtual-env/shared';
import { getBundledBinary } from './binary-resolver.js';
import { loadConfig } from './config-store.js';
import type { K8sService } from './k8s-service.js';
import { getElevatedKtHome } from './kt-state.js';
import type { KtctlService } from './ktctl-service.js';
import { retryUntilPass } from './probe-retry.js';
import { isLocalPortOpen, isProcessAlive } from './process-utils.js';

const execFileAsync = promisify(execFile);

const PROBE_RETRY = { attempts: 5, intervalMs: 1000 };

function readPidFromKtDir(ktHome: string, nameHint: string): number | undefined {
  const pidDir = path.join(ktHome, '.kt', 'pid');
  if (!fs.existsSync(pidDir)) return undefined;
  for (const file of fs.readdirSync(pidDir)) {
    if (!file.toLowerCase().includes(nameHint)) continue;
    try {
      const raw = fs.readFileSync(path.join(pidDir, file), 'utf8').trim();
      const pid = Number.parseInt(raw, 10);
      if (pid > 0 && isProcessAlive(pid)) return pid;
    } catch {
      // ignore unreadable pid files
    }
  }
  return undefined;
}

async function probeClusterDns(namespace: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const kubectl = getBundledBinary('kubectl');
    const cfg = loadConfig();
    const args = [
      'get',
      'svc',
      '-n',
      namespace,
      '-o',
      'jsonpath={.items[0].metadata.name}',
      '--kubeconfig',
      cfg.kubeconfig,
    ];
    if (cfg.context) args.push('--context', cfg.context);
    const { stdout } = await execFileAsync(kubectl, args, { timeout: 8000 });
    const service = stdout.trim();
    if (!service) {
      return { ok: false, detail: `命名空间 ${namespace} 下无 Service，跳过 DNS 探测` };
    }
    const host = `${service}.${namespace}`;
    await dns.lookup(host);
    return { ok: true, detail: `集群 DNS 可解析：${host}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, detail: `集群 DNS 解析失败：${msg}` };
  }
}

// [AI-GEN] scope:checkConnectHealth, model:auto, reviewed:false
export async function checkConnectHealth(
  connectSession: Session | undefined,
  helperRunning: boolean,
  k8s: K8sService,
): Promise<HealthCheckResult> {
  const details: string[] = [];

  if (!connectSession) {
    return buildHealthResult('unknown', '未建立集群网络连接', ['请先点击「连接集群网络」']);
  }

  if (connectSession.state === 'starting' || connectSession.state === 'pending') {
    return buildHealthResult('unknown', '集群网络连接建立中', [
      `会话状态：${connectSession.state}`,
    ]);
  }

  if (connectSession.state === 'failed') {
    return buildHealthResult('unhealthy', '集群网络连接失败', [
      '请查看右侧会话日志',
    ]);
  }

  if (connectSession.state !== 'running') {
    return buildHealthResult('unknown', '集群网络未连接', []);
  }

  let clusterLine = '✗ 集群连接失败';
  const clusterOk = await retryUntilPass(async () => {
    const cluster = await k8s.testConnection();
    clusterLine = cluster.ok ? `✓ ${cluster.message}` : `✗ ${cluster.message}`;
    return cluster.ok;
  }, PROBE_RETRY);
  details.push(clusterLine);

  if (!helperRunning) {
    details.push('✗ 组网 Helper 未运行');
    return buildHealthResult('unhealthy', '组网 Helper 未运行', details);
  }
  details.push('✓ 组网 Helper 已运行');

  let connectPidLine = '✗ 未找到存活的 ktctl connect 进程';
  const connectPidOk = await retryUntilPass(async () => {
    const connectPid = readPidFromKtDir(getElevatedKtHome(), 'connect');
    if (connectPid) {
      connectPidLine = `✓ ktctl connect 进程存活 (pid ${connectPid})`;
      return true;
    }
    return false;
  }, PROBE_RETRY);
  details.push(connectPidLine);

  const cfg = loadConfig();
  const dnsNs =
    cfg.connectDnsNamespaces.length > 0
      ? cfg.connectDnsNamespaces[0]!
      : connectSession.namespace;
  let dnsLine = '✗ 集群 DNS 解析失败';
  const dnsOk = await retryUntilPass(async () => {
    const dnsResult = await probeClusterDns(dnsNs);
    dnsLine = dnsResult.ok ? `✓ ${dnsResult.detail}` : `✗ ${dnsResult.detail}`;
    return dnsResult.ok;
  }, PROBE_RETRY);
  details.push(dnsLine);

  const checks = [clusterOk, helperRunning, connectPidOk, dnsOk];
  const passCount = checks.filter(Boolean).length;

  if (passCount === checks.length) {
    return buildHealthResult('healthy', '集群网络连接正常', details);
  }
  if (passCount >= 2) {
    return buildHealthResult('degraded', '集群网络部分异常', details);
  }
  return buildHealthResult('unhealthy', '集群网络连接异常', details);
}
// [/AI-GEN]

// [AI-GEN] scope:checkSessionHealth, model:auto, reviewed:false
export async function checkSessionHealth(
  session: Session | undefined,
  ktctl: KtctlService,
): Promise<HealthCheckResult> {
  if (!session) {
    return buildHealthResult('unknown', '会话不存在', []);
  }

  const label =
    session.type === 'mesh'
      ? `流量转发 ${session.target}`
      : `端口转发 ${session.target}`;

  if (session.state === 'starting' || session.state === 'pending') {
    return buildHealthResult('unknown', `${label} 启动中`, [
      `会话状态：${session.state}`,
    ]);
  }

  if (session.state === 'failed') {
    return buildHealthResult('unhealthy', `${label} 已失败`, ['请查看右侧会话日志']);
  }

  if (session.state !== 'running') {
    return buildHealthResult('unknown', `${label} 未运行`, []);
  }

  const details: string[] = [];
  const processOk = await retryUntilPass(
    async () => ktctl.isProcessRunning(session.id),
    PROBE_RETRY,
  );
  details.push(
    processOk
      ? `✓ ktctl 进程存活${session.pid ? ` (pid ${session.pid})` : ''}`
      : '✗ ktctl 进程未运行',
  );

  let portOk = false;
  if (session.localPort) {
    portOk = await retryUntilPass(
      () => isLocalPortOpen(session.localPort!),
      PROBE_RETRY,
    );
    details.push(
      portOk
        ? `✓ 本地端口 ${session.localPort} 可连接`
        : `✗ 本地端口 ${session.localPort} 不可达`,
    );
  } else {
    details.push('○ 未配置本地端口');
  }

  if (processOk && (portOk || !session.localPort)) {
    return buildHealthResult('healthy', `${label} 运行正常`, details);
  }
  if (processOk || portOk) {
    return buildHealthResult('degraded', `${label} 部分异常`, details);
  }
  return buildHealthResult('unhealthy', `${label} 不可用`, details);
}
// [/AI-GEN]

export async function checkSessionsHealth(
  sessions: Session[],
  ktctl: KtctlService,
): Promise<Record<string, HealthCheckResult>> {
  const out: Record<string, HealthCheckResult> = {};
  await Promise.all(
    sessions.map(async (s) => {
      out[s.id] = await checkSessionHealth(s, ktctl);
    }),
  );
  return out;
}
