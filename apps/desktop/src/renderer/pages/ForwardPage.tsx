import { useEffect, useState } from 'react';

export function ForwardPage() {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [namespace, setNamespace] = useState('');
  const [services, setServices] = useState<Array<{ name: string; port: number }>>([]);
  const [service, setService] = useState('');
  const [remotePort, setRemotePort] = useState(80);
  const [localPort, setLocalPort] = useState(8500);

  useEffect(() => {
    void window.ztve.k8s.listNamespaces().then((ns) => {
      setNamespaces(ns);
      if (ns[0]) setNamespace(ns[0]);
    });
  }, []);

  useEffect(() => {
    if (!namespace) return;
    void window.ztve.k8s.listServices(namespace).then((svc) => {
      setServices(svc);
      if (svc[0]) {
        setService(svc[0].name);
        setRemotePort(svc[0].port);
      }
    });
  }, [namespace]);

  const start = async () => {
    const cfg = await window.ztve.config.get();
    await window.ztve.forward.start({
      service,
      namespace,
      localPort,
      remotePort,
      kubeconfig: cfg.kubeconfig as string,
      context: cfg.context as string,
    });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">端口转发 (Forward)</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm">命名空间</label>
          <select className="mt-1 w-full rounded border px-2 py-1 text-sm" value={namespace} onChange={(e) => setNamespace(e.target.value)}>
            {namespaces.map((ns) => <option key={ns} value={ns}>{ns}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm">Service</label>
          <select
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
            value={service}
            onChange={(e) => {
              const name = e.target.value;
              setService(name);
              const s = services.find((x) => x.name === name);
              if (s) setRemotePort(s.port);
            }}
          >
            {services.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm">本地端口</label>
          <input type="number" className="mt-1 w-full rounded border px-2 py-1 text-sm" value={localPort} onChange={(e) => setLocalPort(Number(e.target.value))} />
        </div>
        <div>
          <label className="text-sm">远端端口</label>
          <input type="number" className="mt-1 w-full rounded border px-2 py-1 text-sm" value={remotePort} onChange={(e) => setRemotePort(Number(e.target.value))} />
        </div>
      </div>
      <div className="flex gap-2">
        <button className="rounded bg-blue-600 px-4 py-1 text-sm text-white" onClick={() => void start()}>开始转发</button>
        <button
          className="rounded border px-4 py-1 text-sm"
          onClick={() => void window.ztve.shell.openExternal(`http://127.0.0.1:${localPort}`)}
        >
          浏览器打开
        </button>
      </div>
      <p className="text-sm text-gray-500">映射：{localPort} → {remotePort}</p>
    </div>
  );
}
