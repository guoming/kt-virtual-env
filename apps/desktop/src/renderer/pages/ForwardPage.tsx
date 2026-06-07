import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@kt-virtual-env/shared';
import { FavoriteStarButton } from '../components/FavoriteStarButton';
import { HealthDot, HealthStatusPanel } from '../components/HealthStatusPanel';
import { ServiceListTabs, type ServiceListTab } from '../components/ServiceListTabs';
import { useSessionsHealthPolling } from '../hooks/use-health-polling';
import { useServiceFavorites } from '../hooks/use-service-favorites';
import { summarizeHealth } from '../lib/health-utils';
import { requireKtveApi } from '../lib/api';
import {
  countFavoriteForwardInCatalog,
  filterForwardRowsForTab,
  forwardRowKey,
  type ForwardServiceRow,
} from '../lib/service-list';
import { useAppStore } from '../stores/app-store';

function suggestLocalPort(used: number[], remotePort: number): number {
  if (!used.includes(remotePort)) return remotePort;
  for (let p = 8000; p < 9000; p++) {
    if (!used.includes(p)) return p;
  }
  return remotePort + 1000;
}

function forwardKey(ns: string, name: string): string {
  return `${ns}/${name}`;
}

export function ForwardPage() {
  const { sessions } = useAppStore();
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [scopeNs, setScopeNs] = useState(''); // 空 = 全部命名空间
  const [nsInput, setNsInput] = useState('');
  const [nsOpen, setNsOpen] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [localPorts, setLocalPorts] = useState<Record<string, number>>({});
  const [message, setMessage] = useState('');
  const [stoppingIds, setStoppingIds] = useState<Set<string>>(new Set());
  const [listTab, setListTab] = useState<ServiceListTab>('all');
  const [catalogServices, setCatalogServices] = useState<ForwardServiceRow[]>([]);
  const { toggleFavorite, isFavorite, favorites } = useServiceFavorites('forward');

  const activeForwards = useMemo(
    () =>
      sessions.filter(
        (s) =>
          s.type === 'forward' &&
          (s.state === 'running' || s.state === 'starting' || s.state === 'pending'),
      ),
    [sessions],
  );

  const usedLocalPorts = useMemo(
    () =>
      activeForwards
        .map((s) => s.localPort)
        .filter((p): p is number => p !== undefined),
    [activeForwards],
  );

  const filteredNamespaces = useMemo(() => {
    const q = nsInput.trim().toLowerCase();
    if (!q) return namespaces;
    return namespaces.filter((ns) => ns.toLowerCase().includes(q));
  }, [namespaces, nsInput]);

  const selectNamespace = (ns: string) => {
    setScopeNs(ns);
    setNsInput(ns);
    setNsOpen(false);
  };

  const clearNamespace = () => {
    setScopeNs('');
    setNsInput('');
    setNsOpen(false);
  };

  const loadServices = useCallback(async () => {
    setLoading(true);
    try {
      const api = requireKtveApi();
      const rows = await api.k8s.searchServices(
        serviceSearch,
        scopeNs || undefined,
      );
      setServices(rows);
      setLocalPorts((prev) => {
        const next = { ...prev };
        const occupied = new Set(Object.values(next));
        for (const row of rows) {
          const key = forwardKey(row.namespace, row.name);
          if (next[key] === undefined) {
            const port = suggestLocalPort([...occupied], row.port);
            next[key] = port;
            occupied.add(port);
          }
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [serviceSearch, scopeNs]);

  const loadCatalogServices = useCallback(async () => {
    const rows = await requireKtveApi().k8s.searchServices('', scopeNs || undefined);
    setCatalogServices(rows);
  }, [scopeNs]);

  const displayedServices = useMemo(
    () =>
      filterForwardRowsForTab(
        listTab,
        services,
        catalogServices,
        favorites,
        activeForwards,
      ),
    [listTab, services, catalogServices, favorites, activeForwards],
  );

  const tabCounts = useMemo(
    () => ({
      all: services.length,
      favorites: countFavoriteForwardInCatalog(catalogServices, favorites),
      active: activeForwards.length,
    }),
    [services.length, catalogServices, favorites, activeForwards.length],
  );

  const activeForwardIds = useMemo(
    () => activeForwards.map((s) => s.id),
    [activeForwards],
  );
  const {
    map: forwardHealthMap,
    loading: forwardHealthLoading,
    refresh: refreshForwardHealth,
  } = useSessionsHealthPolling(activeForwardIds);
  const forwardHealthSummary = useMemo(
    () =>
      summarizeHealth(activeForwards.map((s) => forwardHealthMap[s.id]).filter(Boolean)),
    [activeForwards, forwardHealthMap],
  );

  useEffect(() => {
    void requireKtveApi().k8s.listNamespaces().then(setNamespaces);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadServices();
      void loadCatalogServices();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadServices, loadCatalogServices]);

  const getLocalPort = (row: ServiceRow): number => {
    const key = forwardKey(row.namespace, row.name);
    return localPorts[key] ?? suggestLocalPort(usedLocalPorts, row.port);
  };

  const setLocalPort = (row: ServiceRow, port: number) => {
    const key = forwardKey(row.namespace, row.name);
    setLocalPorts((prev) => ({ ...prev, [key]: port }));
  };

  const isAlreadyForwarding = (row: ServiceRow): Session | undefined =>
    activeForwards.find(
      (s) => s.namespace === row.namespace && s.target === row.name,
    );

  const stopForward = async (id: string) => {
    setStoppingIds((prev) => new Set(prev).add(id));
    try {
      await requireKtveApi().sessions.stop(id);
    } finally {
      setStoppingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const startForward = async (row: ServiceRow) => {
    const localPort = getLocalPort(row);
    if (usedLocalPorts.includes(localPort)) {
      setMessage(`本地端口 ${localPort} 已被占用`);
      return;
    }
    const cfg = await requireKtveApi().config.get();
    await requireKtveApi().forward.start({
      service: row.name,
      namespace: row.namespace,
      localPort,
      remotePort: row.port,
      kubeconfig: cfg.kubeconfig as string,
      context: cfg.context as string,
    });
    setMessage(`已启动转发：${row.name} ${localPort}→${row.port}`);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">端口转发 (Forward)</h2>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="relative">
          <label className="text-sm text-gray-600">命名空间</label>
          <input
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
            placeholder="搜索或选择，留空为全部"
            value={nsInput}
            onChange={(e) => {
              setNsInput(e.target.value);
              setNsOpen(true);
              if (!e.target.value.trim()) setScopeNs('');
            }}
            onFocus={() => setNsOpen(true)}
            onBlur={() => setTimeout(() => setNsOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setNsOpen(false);
              if (e.key === 'Enter' && filteredNamespaces.length === 1) {
                selectNamespace(filteredNamespaces[0]!);
              }
            }}
          />
          {nsOpen && (
            <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded border bg-white py-1 text-sm shadow-md">
              <li>
                <button
                  type="button"
                  className={`w-full px-3 py-1.5 text-left hover:bg-gray-100 ${scopeNs === '' ? 'bg-blue-50 text-blue-800' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={clearNamespace}
                >
                  全部命名空间 (app-/infr-)
                </button>
              </li>
              {filteredNamespaces.map((ns) => (
                <li key={ns}>
                  <button
                    type="button"
                    className={`w-full px-3 py-1.5 text-left hover:bg-gray-100 ${scopeNs === ns ? 'bg-blue-50 text-blue-800' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectNamespace(ns)}
                  >
                    {ns}
                  </button>
                </li>
              ))}
              {filteredNamespaces.length === 0 && (
                <li className="px-3 py-2 text-gray-500">无匹配命名空间</li>
              )}
            </ul>
          )}
        </div>
        <div className="md:col-span-2">
          <label className="text-sm text-gray-600">搜索 Service</label>
          <div className="mt-1 flex gap-2">
            <input
              className="flex-1 rounded border px-2 py-1 text-sm"
              placeholder="按服务名或命名空间搜索…"
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
            />
            <button
              className="rounded border px-3 py-1 text-sm"
              onClick={() => void loadServices()}
              disabled={loading}
            >
              {loading ? '加载中…' : '刷新'}
            </button>
          </div>
        </div>
      </div>

      {activeForwards.length > 0 && (
        <HealthStatusPanel
          title="端口转发健康"
          result={forwardHealthSummary}
          loading={forwardHealthLoading}
          onRefresh={() => void refreshForwardHealth()}
        />
      )}

      <div className="overflow-hidden rounded border">
        <ServiceListTabs
          tab={listTab}
          counts={tabCounts}
          onTabChange={setListTab}
          onStopAll={() => void Promise.all(activeForwards.map((s) => stopForward(s.id)))}
        />
        <div className="max-h-72 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-[1] bg-gray-50">
            <tr className="border-b">
              <th className="w-10 px-2 py-2" aria-label="收藏" />
              <th className="px-3 py-2">命名空间</th>
              <th className="px-3 py-2">Service</th>
              <th className="px-3 py-2">远端端口</th>
              <th className="px-3 py-2">本地端口</th>
              <th className="w-12 px-2 py-2 text-center">健康</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {displayedServices.map((row) => {
              const running = isAlreadyForwarding(row);
              const key = forwardKey(row.namespace, row.name);
              const favKey = forwardRowKey(row);
              const favLabel = `${row.name} (${row.namespace})`;
              return (
                <tr key={key} className="border-b hover:bg-gray-50">
                  <td className="px-2 py-2">
                    <FavoriteStarButton
                      active={isFavorite(favKey)}
                      label={favLabel}
                      onToggle={() => void toggleFavorite(favKey)}
                    />
                  </td>
                  <td className="px-3 py-2 text-gray-600">{row.namespace}</td>
                  <td className="px-3 py-2 font-medium">{row.name}</td>
                  <td className="px-3 py-2">{row.port}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      className="w-24 rounded border px-2 py-0.5 text-sm"
                      value={getLocalPort(row)}
                      disabled={!!running}
                      onChange={(e) => setLocalPort(row, Number(e.target.value))}
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    {running ? (
                      <HealthDot
                        result={forwardHealthMap[running.id]}
                        loading={forwardHealthLoading}
                      />
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col items-start gap-1">
                      {running ? (
                        <>
                          <span className="text-green-600">
                            转发中 → :{running.localPort}
                          </span>
                          <button
                            type="button"
                            className="text-xs text-red-600 hover:underline disabled:text-gray-400"
                            disabled={stoppingIds.has(running.id)}
                            onClick={() => void stopForward(running.id)}
                          >
                            {stoppingIds.has(running.id) ? '停止中…' : '停止'}
                          </button>
                        </>
                      ) : (
                        <button
                          className="text-blue-600 hover:underline disabled:text-gray-400"
                          onClick={() => void startForward(row)}
                        >
                          转发到本地
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {displayedServices.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  {listTab === 'favorites' && '暂无收藏的服务，点击星标添加收藏'}
                  {listTab === 'active' && '暂无进行中的端口转发'}
                  {listTab === 'all' && '未找到匹配的 Service'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {message && <p className="text-sm text-amber-700">{message}</p>}
    </div>
  );
}
