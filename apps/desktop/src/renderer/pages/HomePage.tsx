import { useEffect, useState } from 'react';
import type { MeshProfile } from '@zt-virtual-env/shared';
import { profileKey, useAppStore } from '../stores/app-store';

export function HomePage() {
  const { profiles, setProfiles, setClusterOk, setHelperRunning } = useAppStore();
  const [selected, setSelected] = useState<MeshProfile | null>(null);
  const [localPort, setLocalPort] = useState(8001);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const [list, conn, helper] = await Promise.all([
        window.ztve.k8s.listProfiles(),
        window.ztve.k8s.testConnection(),
        window.ztve.helper.status(),
      ]);
      setProfiles(list);
      setClusterOk(conn.ok);
      setHelperRunning(helper.running);
      setMessage(conn.ok ? '' : conn.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = profiles.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.deploymentName.toLowerCase().includes(q) ||
      p.namespace.toLowerCase().includes(q) ||
      p.virtualEnv.toLowerCase().includes(q)
    );
  });

  const startMesh = async () => {
    if (!selected) return;
    await window.ztve.mesh.start(profileKey(selected), localPort);
    setMessage('Mesh 已启动，请查看右侧会话日志');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">快速 Mesh 联调</h2>
        <button className="rounded border px-3 py-1 text-sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? '刷新中…' : '刷新工作负载'}
        </button>
      </div>

      <input
        className="w-full rounded border px-3 py-2 text-sm"
        placeholder="搜索服务名 / virtual-env / 命名空间"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="max-h-64 overflow-auto rounded border">
        {filtered.map((p) => (
          <label
            key={profileKey(p)}
            className={`flex cursor-pointer items-start gap-2 border-b p-3 text-sm hover:bg-gray-50 ${selected && profileKey(selected) === profileKey(p) ? 'bg-blue-50' : ''}`}
          >
            <input
              type="radio"
              name="profile"
              checked={selected ? profileKey(selected) === profileKey(p) : false}
              onChange={() => {
                setSelected(p);
                setLocalPort(p.suggestedLocalPort);
              }}
            />
            <div>
              <div className="font-medium">{p.deploymentName}</div>
              <div className="text-gray-500">
                {p.namespace} · {p.virtualEnv} · env={p.env} · 容器:{p.containerPort}
              </div>
            </div>
          </label>
        ))}
        {filtered.length === 0 && <p className="p-4 text-sm text-gray-500">未找到带 virtual-env 的工作负载</p>}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm">本地端口</label>
        <input
          type="number"
          className="w-28 rounded border px-2 py-1 text-sm"
          value={localPort}
          onChange={(e) => setLocalPort(Number(e.target.value))}
        />
        <button
          className="rounded bg-blue-600 px-4 py-1 text-sm text-white disabled:opacity-50"
          disabled={!selected}
          onClick={() => void startMesh()}
        >
          开始 Mesh 联调
        </button>
      </div>

      {message && <p className="text-sm text-amber-700">{message}</p>}

      <div className="rounded border bg-gray-50 p-3 text-sm">
        <div className="font-medium">环境检查</div>
        <ul className="mt-1 list-inside list-disc text-gray-600">
          <li>集群连接：{useAppStore.getState().clusterOk ? '✓ 正常' : '⚠ 异常'}</li>
          <li>Helper：{useAppStore.getState().helperRunning ? '✓ 已授权' : '⚠ 未授权（Connect 需要）'}</li>
        </ul>
      </div>
    </div>
  );
}
