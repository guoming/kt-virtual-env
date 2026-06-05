import { useEffect, useState } from 'react';

export function ConnectPage() {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [baseNs, setBaseNs] = useState('');
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void window.ztve.k8s.listNamespaces().then((ns) => {
      setNamespaces(ns);
      if (ns[0]) setBaseNs(ns[0]);
      setSelected(new Set(ns));
    });
  }, []);

  const toggle = (ns: string) => {
    const next = new Set(selected);
    if (next.has(ns)) next.delete(ns);
    else next.add(ns);
    setSelected(next);
  };

  const connect = async () => {
    const cfg = await window.ztve.config.get();
    await window.ztve.connect.start({
      namespace: baseNs,
      dnsNamespaces: [...selected],
      kubeconfig: cfg.kubeconfig as string,
      context: cfg.context as string,
    });
    setConnected(true);
    setMessage('集群网络连接已启动');
  };

  const disconnect = async () => {
    await window.ztve.connect.stop();
    setConnected(false);
    setMessage('已断开连接');
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">集群网络打通 (Connect)</h2>
      <p className="text-sm text-gray-600">状态：{connected ? '● 已连接' : '○ 未连接'}</p>

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

      <p className="text-xs text-amber-700">首次 Connect 需要管理员授权 Helper</p>

      <div className="flex gap-2">
        <button className="rounded bg-blue-600 px-4 py-1 text-sm text-white" onClick={() => void connect()}>
          连接集群网络
        </button>
        <button className="rounded border px-4 py-1 text-sm" onClick={() => void disconnect()}>
          断开
        </button>
        <button className="rounded border px-4 py-1 text-sm" onClick={() => void window.ztve.helper.authorize()}>
          授权 Helper
        </button>
      </div>

      {message && <p className="text-sm text-gray-600">{message}</p>}
    </div>
  );
}
