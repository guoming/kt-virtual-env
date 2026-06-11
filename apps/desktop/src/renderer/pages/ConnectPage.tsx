import { useCallback, useEffect, useMemo, useState } from 'react';
import type { HealthSnapshot, NamespaceConnectAccess, Session } from '@kt-virtual-env/shared';
import { HealthStatusPanel } from '../components/HealthStatusPanel';
import { useHealthPolling } from '../hooks/use-health-polling';
import { requireKtveApi } from '../lib/api';
import { useAppStore } from '../stores/app-store';

function connectStatusLabel(session: Session | undefined): {
  text: string;
  className: string;
} {
  if (!session) {
    return { text: '○ 未连接', className: 'text-gray-600' };
  }
  switch (session.state) {
    case 'running':
      return { text: '● 已连接', className: 'text-green-700' };
    case 'starting':
    case 'pending':
      return { text: '◐ 连接中…', className: 'text-amber-700' };
    case 'failed':
      return { text: '✕ 连接失败', className: 'text-red-700' };
    default:
      return { text: '○ 未连接', className: 'text-gray-600' };
  }
}

function pickDefaultBaseNamespace(
  connectable: NamespaceConnectAccess[],
  saved?: string,
): string {
  if (saved && connectable.some((row) => row.name === saved && row.canConnect)) {
    return saved;
  }
  return connectable.find((row) => row.canConnect)?.name ?? '';
}

export function ConnectPage() {
  const { sessions } = useAppStore();
  const [namespaceAccess, setNamespaceAccess] = useState<NamespaceConnectAccess[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [baseNs, setBaseNs] = useState('');
  const [message, setMessage] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [loadingNamespaces, setLoadingNamespaces] = useState(true);
  const [clusterApiUnreachable, setClusterApiUnreachable] = useState(false);

  const connectSession = useMemo(
    () =>
      sessions.find(
        (s) => s.type === 'connect' && s.state !== 'stopped',
      ),
    [sessions],
  );

  const status = useMemo(
    () => connectStatusLabel(connectSession),
    [connectSession],
  );

  const connectableNamespaces = useMemo(
    () => namespaceAccess.filter((row) => row.canConnect).map((row) => row.name),
    [namespaceAccess],
  );

  const deniedNamespaces = useMemo(
    () => namespaceAccess.filter((row) => !row.canConnect),
    [namespaceAccess],
  );

  const baseAccess = useMemo(
    () => namespaceAccess.find((row) => row.name === baseNs),
    [namespaceAccess, baseNs],
  );

  const canStartConnect = connectableNamespaces.length > 0 && Boolean(baseNs) && baseAccess?.canConnect;

  const isConnected = connectSession?.state === 'running';
  const isBusy =
    connecting ||
    connectSession?.state === 'starting' ||
    connectSession?.state === 'pending';

  const selectConnect = useCallback((snapshot: HealthSnapshot) => snapshot.connect, []);
  const {
    result: healthResult,
    loading: healthLoading,
    refresh: refreshHealth,
  } = useHealthPolling(selectConnect, true);

  const applyNamespaceSelection = useCallback(
    (access: NamespaceConnectAccess[], cfg: { connectDnsNamespaces: string[] }) => {
      setNamespaceAccess(access);
      const defaultBase = pickDefaultBaseNamespace(
        access,
        cfg.connectDnsNamespaces[0] ?? connectSession?.namespace,
      );
      setBaseNs(defaultBase);
      const dnsDefaults = cfg.connectDnsNamespaces.length > 0
        ? cfg.connectDnsNamespaces.filter((ns) => access.some((row) => row.name === ns))
        : access.map((row) => row.name);
      setSelected(new Set(dnsDefaults.length > 0 ? dnsDefaults : access.map((row) => row.name)));
    },
    [connectSession?.namespace],
  );

  useEffect(() => {
    setLoadingNamespaces(true);
    setClusterApiUnreachable(false);
    void requireKtveApi()
      .config.get()
      .then(async (cfg) => {
        try {
          const access = await requireKtveApi().k8s.listConnectNamespaceAccess();
          applyNamespaceSelection(access, cfg);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          const saved = cfg.connectDnsNamespaces;
          if (saved.length > 0) {
            const fallback = saved.map((name) => ({ name, canConnect: true }));
            applyNamespaceSelection(fallback, cfg);
            setClusterApiUnreachable(true);
            setMessage(
              `${msg}。已使用上次保存的命名空间，连接前请确认网络可达。`,
            );
            return;
          }
          setMessage(msg);
        }
      })
      .finally(() => {
        setLoadingNamespaces(false);
      });
  }, [applyNamespaceSelection, connectSession?.namespace]);

  useEffect(() => {
    if (connectSession?.state === 'running') {
      setMessage('集群网络已打通');
    } else if (connectSession?.state === 'failed') {
      setMessage('集群网络连接失败，请查看右侧会话日志');
    }
  }, [connectSession?.state]);

  const toggle = (ns: string) => {
    const next = new Set(selected);
    if (next.has(ns)) next.delete(ns);
    else next.add(ns);
    setSelected(next);
  };

  const connect = async () => {
    if (!canStartConnect || isConnected || isBusy) return;
    setConnecting(true);
    setMessage('');
    try {
      const cfg = await requireKtveApi().config.get();
      if (!clusterApiUnreachable) {
        const access = await requireKtveApi().k8s.checkConnectNamespaceAccess(baseNs);
        if (!access.canConnect) {
          setMessage(`基准命名空间 ${baseNs} 权限不足：${access.reason ?? '请更换命名空间'}`);
          return;
        }
      }
      await requireKtveApi().connect.start({
        namespace: baseNs,
        dnsNamespaces: [...selected],
        kubeconfig: cfg.kubeconfig as string,
        context: cfg.context as string,
      });
      setMessage('正在建立集群网络连接，请稍候…');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!connectSession) return;
    try {
      await requireKtveApi().connect.stop();
      setMessage('已断开连接');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">集群网络打通 (Connect)</h2>
      <p className={`text-sm ${status.className}`}>
        状态：{status.text}
        {connectSession?.state === 'running' && connectSession.namespace && (
          <span className="ml-2 text-gray-500">（{connectSession.namespace}）</span>
        )}
      </p>

      <HealthStatusPanel
        title="集群网络健康"
        result={healthResult}
        loading={healthLoading}
        onRefresh={() => void refreshHealth()}
      />

      <div>
        <label className="text-sm">基准命名空间</label>
        <select
          className="ml-2 rounded border px-2 py-1 text-sm disabled:bg-gray-100"
          value={baseNs}
          disabled={loadingNamespaces || connectableNamespaces.length === 0}
          onChange={(e) => setBaseNs(e.target.value)}
        >
          {connectableNamespaces.map((ns) => (
            <option key={ns} value={ns}>{ns}</option>
          ))}
        </select>
        {loadingNamespaces && (
          <p className="mt-1 text-xs text-gray-500">正在检测命名空间权限…</p>
        )}
        {!loadingNamespaces && connectableNamespaces.length === 0 && (
          <p className="mt-1 text-xs text-red-700">
            当前账号没有可用于 Connect 的命名空间，请确认具备目标命名空间的 Pod 创建与读取权限。
          </p>
        )}
        {!loadingNamespaces && baseAccess && !baseAccess.canConnect && (
          <p className="mt-1 text-xs text-red-700">
            {baseAccess.reason ?? '基准命名空间权限不足'}
          </p>
        )}
        {deniedNamespaces.length > 0 && (
          <p className="mt-1 text-xs text-gray-500">
            已隐藏 {deniedNamespaces.length} 个无 Connect 权限的命名空间
            {deniedNamespaces.length <= 3
              ? `（${deniedNamespaces.map((row) => row.name).join('、')}）`
              : ''}
          </p>
        )}
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">DNS 解析范围</div>
        <div className="grid max-h-48 grid-cols-2 gap-2 overflow-auto">
          {namespaceAccess.map((row) => (
            <label key={row.name} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.has(row.name)}
                disabled={!row.canConnect}
                onChange={() => toggle(row.name)}
              />
              <span className={row.canConnect ? '' : 'text-gray-400'}>
                {row.name}
                {!row.canConnect && (
                  <span className="ml-1 text-xs text-gray-400">（无权限）</span>
                )}
              </span>
            </label>
          ))}
        </div>
      </div>

      {clusterApiUnreachable && (
        <p className="text-xs text-amber-700">
          当前无法访问集群 API，命名空间列表来自上次连接记录。请确认已接入内网或 VPN 后再连接。
        </p>
      )}

      <p className="text-xs text-amber-700">
        连接前请先在配置页完成「组网授权」；若尚未授权，连接时会再次请求管理员确认。
        基准命名空间需具备 Pod 创建与读取权限，下拉列表已自动过滤无权命名空间。
      </p>

      <div className="flex gap-2">
        <button
          className="rounded bg-blue-600 px-4 py-1 text-sm text-white disabled:bg-gray-300"
          disabled={!canStartConnect || isConnected || isBusy}
          onClick={() => void connect()}
        >
          {isBusy ? '连接中…' : '连接集群网络'}
        </button>
        <button
          className="rounded border px-4 py-1 text-sm disabled:text-gray-400"
          disabled={!connectSession}
          onClick={() => void disconnect()}
        >
          断开
        </button>
      </div>

      {message && <p className="text-sm text-gray-600">{message}</p>}
    </div>
  );
}
