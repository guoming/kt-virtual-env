import { useCallback, useEffect, useMemo, useState } from 'react';
import type { HealthSnapshot, Session } from '@kt-virtual-env/shared';
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

export function ConnectPage() {
  const { sessions } = useAppStore();
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [baseNs, setBaseNs] = useState('');
  const [message, setMessage] = useState('');
  const [connecting, setConnecting] = useState(false);

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

  useEffect(() => {
    void requireKtveApi().k8s.listNamespaces().then((ns) => {
      setNamespaces(ns);
      if (ns[0]) setBaseNs(ns[0]);
      setSelected(new Set(ns));
    });
  }, []);

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
    if (isConnected || isBusy) return;
    setConnecting(true);
    setMessage('');
    try {
      const cfg = await requireKtveApi().config.get();
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
        <select className="ml-2 rounded border px-2 py-1 text-sm" value={baseNs} onChange={(e) => setBaseNs(e.target.value)}>
          {namespaces.map((ns) => (
            <option key={ns} value={ns}>{ns}</option>
          ))}
        </select>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">DNS 解析范围</div>
        <div className="grid max-h-48 grid-cols-2 gap-2 overflow-auto">
          {namespaces.map((ns) => (
            <label key={ns} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={selected.has(ns)} onChange={() => toggle(ns)} />
              {ns}
            </label>
          ))}
        </div>
      </div>

      <p className="text-xs text-amber-700">
        连接前请先在配置页完成「组网授权」；若尚未授权，连接时会再次请求管理员确认。
      </p>

      <div className="flex gap-2">
        <button
          className="rounded bg-blue-600 px-4 py-1 text-sm text-white disabled:bg-gray-300"
          disabled={isConnected || isBusy}
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
