import { useEffect, useState } from 'react';
import { buildMeshCommand } from '@zt-virtual-env/shared';
import type { MeshProfile } from '@zt-virtual-env/shared';
import { profileKey } from '../stores/app-store';

export function MeshPage() {
  const [profiles, setProfiles] = useState<MeshProfile[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [localPort, setLocalPort] = useState(8001);

  useEffect(() => {
    void window.ztve.k8s.listProfiles().then((list) => {
      setProfiles(list);
      if (list[0]) {
        setSelectedKey(profileKey(list[0]));
        setLocalPort(list[0].suggestedLocalPort);
      }
    });
  }, []);

  const selected = profiles.find((p) => profileKey(p) === selectedKey);
  const preview = selected ? buildMeshCommand(selected, localPort).display : '';

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">流量 Mesh（高级）</h2>
      <select
        className="w-full rounded border px-2 py-1 text-sm"
        value={selectedKey}
        onChange={(e) => {
          setSelectedKey(e.target.value);
          const p = profiles.find((x) => profileKey(x) === e.target.value);
          if (p) setLocalPort(p.suggestedLocalPort);
        }}
      >
        {profiles.map((p) => (
          <option key={profileKey(p)} value={profileKey(p)}>
            {p.namespace}/{p.deploymentName} ({p.virtualEnv})
          </option>
        ))}
      </select>
      {selected && (
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-gray-500">virtual-env</dt><dd>{selected.virtualEnv}</dd>
          <dt className="text-gray-500">env</dt><dd>{selected.env}</dd>
          <dt className="text-gray-500">容器端口</dt><dd>{selected.containerPort}</dd>
        </dl>
      )}
      <div>
        <label className="text-sm">本地端口</label>
        <input type="number" className="ml-2 rounded border px-2 py-1 text-sm" value={localPort} onChange={(e) => setLocalPort(Number(e.target.value))} />
      </div>
      <button
        className="rounded bg-blue-600 px-4 py-1 text-sm text-white"
        disabled={!selectedKey}
        onClick={() => void window.ztve.mesh.start(selectedKey, localPort)}
      >
        启动 Mesh
      </button>
      <div>
        <div className="mb-1 text-sm font-medium">命令预览</div>
        <pre className="overflow-auto rounded bg-gray-100 p-2 text-xs">{preview || '请选择工作负载'}</pre>
      </div>
    </div>
  );
}
