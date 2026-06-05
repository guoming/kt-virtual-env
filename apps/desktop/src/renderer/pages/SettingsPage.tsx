import { useEffect, useState } from 'react';

export function SettingsPage() {
  const [kubeconfig, setKubeconfig] = useState('');
  const [context, setContext] = useState('');
  const [contexts, setContexts] = useState<string[]>([]);
  const [versions, setVersions] = useState({ app: '', ktctl: '', kubectl: '' });

  useEffect(() => {
    void window.ztve.config.get().then((cfg) => {
      setKubeconfig(cfg.kubeconfig as string);
      setContext(cfg.context as string);
    });
    void window.ztve.k8s.listContexts().then(setContexts);
    void window.ztve.app.versions().then(setVersions);
  }, []);

  const save = async () => {
    await window.ztve.config.save({ kubeconfig, context });
    alert('配置已保存');
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">设置</h2>
      <div>
        <label className="text-sm">kubeconfig 路径</label>
        <input className="mt-1 w-full rounded border px-2 py-1 text-sm" value={kubeconfig} onChange={(e) => setKubeconfig(e.target.value)} />
      </div>
      <div>
        <label className="text-sm">Context</label>
        <select className="mt-1 w-full rounded border px-2 py-1 text-sm" value={context} onChange={(e) => setContext(e.target.value)}>
          <option value="">（默认）</option>
          {contexts.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <button className="rounded bg-blue-600 px-4 py-1 text-sm text-white" onClick={() => void save()}>保存</button>
      <div className="rounded border bg-gray-50 p-3 text-sm">
        <div className="font-medium">版本信息</div>
        <ul className="mt-1 text-gray-600">
          <li>应用：{versions.app || '0.1.0'}</li>
          <li>ktctl：{versions.ktctl}</li>
          <li>kubectl：{versions.kubectl}</li>
        </ul>
      </div>
      <button className="rounded border px-4 py-1 text-sm" onClick={() => void window.ztve.helper.authorize()}>
        重新授权 Helper
      </button>
    </div>
  );
}
