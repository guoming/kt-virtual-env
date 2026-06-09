import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildMeshVersion,
  listOfflineFavoritePorts,
  runtimeLabel,
  sortLocalDevPortsByFavorites,
  type LocalDevPort,
  type MeshProfile,
  type Session,
} from '@kt-virtual-env/shared';
import { FavoriteStarButton } from '../components/FavoriteStarButton';
import { LocalDevPortPicker } from '../components/LocalDevPortPicker';
import { HealthDot, HealthStatusPanel } from '../components/HealthStatusPanel';
import { ServiceListTabs, type ServiceListTab } from '../components/ServiceListTabs';
import { useLocalDevPortFavorites } from '../hooks/use-local-dev-port-favorites';
import { useSessionsHealthPolling } from '../hooks/use-health-polling';
import { useServiceFavorites } from '../hooks/use-service-favorites';
import { summarizeHealth } from '../lib/health-utils';
import { requireKtveApi } from '../lib/api';
import { MESH_HEADER } from '../lib/branding';
import {
  countFavoriteMeshInCatalog,
  clusterVirtualEnvFromMeshSession,
  filterMeshProfilesForTab,
  meshProfileActiveKey,
  meshProfileKey,
  meshSessionActiveKey,
} from '../lib/service-list';
import { profileKey, useAppStore } from '../stores/app-store';

function parsePortInput(raw: string): number | undefined {
  const port = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(port) || port < 1 || port > 65535) return undefined;
  return port;
}

function VirtualEnvBadge({ value, size = 'md' }: { value: string; size?: 'md' | 'lg' }) {
  const parts = value.split('.');
  const text = size === 'lg' ? 'text-base' : 'text-sm';
  return (
    <div className="space-y-1">
      <code
        className={`inline-block rounded-md bg-indigo-50 px-2 py-0.5 font-mono font-semibold text-indigo-900 ${text}`}
      >
        {value}
      </code>
      <div className="flex flex-wrap gap-1">
        {parts.map((part, i) => (
          <span
            key={`${value}-${i}`}
            className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600"
          >
            {part}
          </span>
        ))}
      </div>
    </div>
  );
}

async function copyVersionValue(virtualEnv: string): Promise<void> {
  await navigator.clipboard.writeText(virtualEnv);
}

function previewMeshVersion(base: string, userId: string): string | null {
  try {
    return buildMeshVersion(base, userId);
  } catch {
    return null;
  }
}

export function HomePage() {
  const { sessions, setPage } = useAppStore();
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [scopeNs, setScopeNs] = useState('');
  const [nsInput, setNsInput] = useState('');
  const [nsOpen, setNsOpen] = useState(false);
  const [virtualEnvSearch, setVirtualEnvSearch] = useState('');
  const [deploySearch, setDeploySearch] = useState('');
  const [profiles, setProfiles] = useState<MeshProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [localPortInputs, setLocalPortInputs] = useState<Record<string, string>>({});
  const [meshUserId, setMeshUserId] = useState('');
  const [message, setMessage] = useState('');
  const [stoppingIds, setStoppingIds] = useState<Set<string>>(new Set());
  const [listTab, setListTab] = useState<ServiceListTab>('all');
  const [catalogProfiles, setCatalogProfiles] = useState<MeshProfile[]>([]);
  const [localDevPorts, setLocalDevPorts] = useState<LocalDevPort[]>([]);
  const [scanningPorts, setScanningPorts] = useState(false);
  const { toggleFavorite, isFavorite, favorites } = useServiceFavorites('mesh');
  const {
    favorites: favoriteLocalPorts,
    toggleFavorite: toggleLocalPortFavorite,
    isFavorite: isLocalPortFavorite,
    favoriteCount: favoriteLocalPortCount,
  } = useLocalDevPortFavorites();

  const sortedLocalDevPorts = useMemo(
    () => sortLocalDevPortsByFavorites(localDevPorts, favoriteLocalPorts),
    [localDevPorts, favoriteLocalPorts],
  );

  const offlineFavoriteLocalPorts = useMemo(
    () => listOfflineFavoritePorts(localDevPorts, favoriteLocalPorts),
    [localDevPorts, favoriteLocalPorts],
  );

  const activeMeshes = useMemo(
    () =>
      sessions
        .filter(
          (s) =>
            s.type === 'mesh' &&
            (s.state === 'running' || s.state === 'starting' || s.state === 'pending'),
        )
        .sort((a, b) => (a.virtualEnv ?? '').localeCompare(b.virtualEnv ?? '')),
    [sessions],
  );

  const filteredNamespaces = useMemo(() => {
    const q = nsInput.trim().toLowerCase();
    if (!q) return namespaces;
    return namespaces.filter((ns) => ns.toLowerCase().includes(q));
  }, [namespaces, nsInput]);

  const virtualEnvChips = useMemo(() => {
    const seen = new Set<string>();
    const chips: string[] = [];
    for (const p of profiles) {
      if (!seen.has(p.virtualEnv)) {
        seen.add(p.virtualEnv);
        chips.push(p.virtualEnv);
      }
    }
    return chips.slice(0, 12);
  }, [profiles]);

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

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await requireKtveApi().k8s.searchProfiles(
        virtualEnvSearch,
        scopeNs || undefined,
        deploySearch,
      );
      const sorted = [...rows].sort((a, b) => a.virtualEnv.localeCompare(b.virtualEnv));
      setProfiles(sorted);
    } finally {
      setLoading(false);
    }
  }, [virtualEnvSearch, deploySearch, scopeNs]);

  const loadCatalogProfiles = useCallback(async () => {
    const rows = await requireKtveApi().k8s.searchProfiles(
      '',
      scopeNs || undefined,
      '',
    );
    setCatalogProfiles(
      [...rows].sort((a, b) => a.virtualEnv.localeCompare(b.virtualEnv)),
    );
  }, [scopeNs]);

  const displayedProfiles = useMemo(
    () =>
      filterMeshProfilesForTab(
        listTab,
        profiles,
        catalogProfiles,
        favorites,
        activeMeshes,
        meshUserId,
      ),
    [listTab, profiles, catalogProfiles, favorites, activeMeshes, meshUserId],
  );

  const tabCounts = useMemo(
    () => ({
      all: profiles.length,
      favorites: countFavoriteMeshInCatalog(catalogProfiles, favorites),
      active: activeMeshes.length,
    }),
    [profiles.length, catalogProfiles, favorites, activeMeshes.length],
  );

  const activeMeshIds = useMemo(
    () => activeMeshes.map((s) => s.id),
    [activeMeshes],
  );
  const {
    map: meshHealthMap,
    loading: meshHealthLoading,
    refresh: refreshMeshHealth,
  } = useSessionsHealthPolling(activeMeshIds);
  const meshHealthSummary = useMemo(
    () => summarizeHealth(activeMeshes.map((s) => meshHealthMap[s.id]).filter(Boolean)),
    [activeMeshes, meshHealthMap],
  );

  const refreshLocalDevPorts = useCallback(async () => {
    setScanningPorts(true);
    try {
      const ports = await requireKtveApi().system.listLocalDevPorts();
      setLocalDevPorts(ports);
    } finally {
      setScanningPorts(false);
    }
  }, []);

  useEffect(() => {
    void requireKtveApi().k8s.listNamespaces().then(setNamespaces);
    void requireKtveApi().config.get().then((cfg) => {
      setMeshUserId((cfg.meshUserId as string) ?? '');
    });
    void refreshLocalDevPorts();
  }, [refreshLocalDevPorts]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadProfiles();
      void loadCatalogProfiles();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadProfiles, loadCatalogProfiles]);

  const setLocalPortInput = (key: string, value: string) => {
    setLocalPortInputs((prev) => ({ ...prev, [key]: value }));
  };

  const isAlreadyMeshing = (row: MeshProfile): Session | undefined =>
    activeMeshes.find(
      (s) => meshSessionActiveKey(s, meshUserId) === meshProfileActiveKey(row),
    );

  const stopMesh = async (id: string) => {
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

  const startMesh = async (row: MeshProfile) => {
    const id = meshUserId.trim();
    if (!id) {
      setMessage('请先在配置页填写个人标识');
      return;
    }
    let meshVersion: string;
    try {
      meshVersion = buildMeshVersion(row.virtualEnv, id);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
      return;
    }
    const key = profileKey(row);
    const port = parsePortInput(localPortInputs[key] ?? '');
    if (port === undefined) {
      setMessage('请选择或输入本地应用端口');
      return;
    }
    try {
      await requireKtveApi().system.validateMeshLocalPort(port);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
      return;
    }
    await requireKtveApi().mesh.start(row, port, id);
    const discovered = localDevPorts.find((d) => d.port === port);
    const runtimeHint = discovered
      ? `（${discovered.serviceName} · ${runtimeLabel(discovered.runtime)}）`
      : '';
    setMessage(`已启动：${MESH_HEADER}: ${meshVersion} → 127.0.0.1:${port}${runtimeHint}`);
  };

  const handleCopyMeshHeader = async (virtualEnv: string) => {
    await copyVersionValue(virtualEnv);
    setMessage(`已复制 ${MESH_HEADER} 值：${virtualEnv}`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">流量转发 (Mesh)</h2>
        {meshUserId ? (
          <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-950">
            <p>
              多人可同时转发同一虚拟环境（如 <span className="font-mono">dev.v1</span>
              ），通过<strong>个人标识</strong>隔离流量，互不影响。当前标识{' '}
              <code className="font-mono font-semibold">{meshUserId}</code>，请求头{' '}
              <code className="font-mono">{MESH_HEADER}</code> 使用{' '}
              <code className="font-mono text-indigo-800">
                {previewMeshVersion('dev.v1', meshUserId) ?? `dev.v1.${meshUserId}`}
              </code>
              。在下方选择<strong>本地应用端口</strong>后点击「转发到本地」即可。
            </p>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span>
              多人可同时转发同一虚拟环境，通过个人标识隔离流量。请先在配置页保存个人标识（格式{' '}
              <span className="font-mono">dev.v1.&lt;个人标识&gt;</span>，如{' '}
              <span className="font-mono">dev.v1.developer</span>），再选择本地端口并点击「转发到本地」。
            </span>
            <button
              className="shrink-0 rounded border border-amber-300 bg-white px-2 py-0.5 text-xs hover:bg-amber-100"
              onClick={() => setPage('settings')}
            >
              前往配置
            </button>
          </div>
        )}
      </div>

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
        <div>
          <label className="text-sm font-medium text-indigo-800">virtual-env</label>
          <input
            className="mt-1 w-full rounded border border-indigo-200 px-2 py-1 font-mono text-sm focus:border-indigo-400 focus:outline-none"
            placeholder="dev.v1、dev.v2、dev.v1.abcd …"
            value={virtualEnvSearch}
            onChange={(e) => setVirtualEnvSearch(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm text-gray-600">服务 / 部署名</label>
          <div className="mt-1 flex gap-2">
            <input
              className="flex-1 rounded border px-2 py-1 text-sm"
              placeholder="可选，按部署名过滤"
              value={deploySearch}
              onChange={(e) => setDeploySearch(e.target.value)}
            />
            <button
              className="shrink-0 rounded border px-3 py-1 text-sm"
              onClick={() => void loadProfiles()}
              disabled={loading}
            >
              {loading ? '…' : '刷新'}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium text-gray-800">
            本地开发服务端口
            {favoriteLocalPortCount > 0 && (
              <span className="ml-2 text-xs font-normal text-amber-700">
                收藏 {favoriteLocalPortCount}
              </span>
            )}
          </span>
          <button
            type="button"
            className="text-xs text-blue-700 hover:underline disabled:text-gray-400"
            disabled={scanningPorts}
            onClick={() => void refreshLocalDevPorts()}
          >
            {scanningPorts ? '扫描中…' : '重新扫描'}
          </button>
        </div>
        {sortedLocalDevPorts.length === 0 && offlineFavoriteLocalPorts.length === 0 ? (
          <p className="mt-1 text-gray-600">
            未检测到 Docker / Java / PHP / Node / C# / Go 监听端口。请先在本机启动应用后再转发。
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {sortedLocalDevPorts.map((d) => {
              const favLabel = `${d.port} ${d.serviceName}`;
              return (
                <span
                  key={`${d.pid}-${d.port}`}
                  className={`inline-flex items-center gap-0.5 rounded-full border bg-white pl-2.5 pr-1 py-0.5 text-xs text-gray-700 ${
                    isLocalPortFavorite(d.port)
                      ? 'border-amber-300 bg-amber-50'
                      : 'border-gray-200'
                  }`}
                  title={`${d.serviceName} · ${runtimeLabel(d.runtime)} · PID ${d.pid}`}
                >
                  <span className="font-mono">{d.port}</span>
                  {d.serviceName !== d.processName && (
                    <span className="ml-1.5 font-medium text-gray-800">{d.serviceName}</span>
                  )}
                  <span className="ml-1 text-gray-500">({runtimeLabel(d.runtime)})</span>
                  <FavoriteStarButton
                    active={isLocalPortFavorite(d.port)}
                    label={favLabel}
                    onToggle={() => void toggleLocalPortFavorite(d.port)}
                  />
                </span>
              );
            })}
            {offlineFavoriteLocalPorts.map((port) => (
              <span
                key={`offline-${port}`}
                className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-amber-300 bg-amber-50/60 pl-2.5 pr-1 py-0.5 text-xs text-gray-500"
                title="已收藏，当前未监听"
              >
                <span className="font-mono">{port}</span>
                <span className="ml-1">(未监听)</span>
                <FavoriteStarButton
                  active
                  label={String(port)}
                  onToggle={() => void toggleLocalPortFavorite(port)}
                />
              </span>
            ))}
          </div>
        )}
      </div>

      {activeMeshes.length > 0 && (
        <HealthStatusPanel
          title="流量转发健康"
          result={meshHealthSummary}
          loading={meshHealthLoading}
          onRefresh={() => void refreshMeshHealth()}
        />
      )}

      {virtualEnvChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">快捷筛选：</span>
          {virtualEnvChips.map((ve) => (
            <button
              key={ve}
              type="button"
              className={`rounded-full border px-2.5 py-0.5 font-mono text-xs transition-colors ${
                virtualEnvSearch === ve
                  ? 'border-indigo-400 bg-indigo-100 text-indigo-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'
              }`}
              onClick={() => setVirtualEnvSearch(virtualEnvSearch === ve ? '' : ve)}
            >
              {ve}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded border">
        <ServiceListTabs
          tab={listTab}
          counts={tabCounts}
          onTabChange={setListTab}
          onStopAll={() => void Promise.all(activeMeshes.map((s) => stopMesh(s.id)))}
        />
        <div className="max-h-80 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-[1] bg-gray-50">
            <tr className="border-b">
              <th className="w-10 px-2 py-2" aria-label="收藏" />
              <th className="px-3 py-2">集群 virtual-env</th>
              <th className="px-3 py-2">你的 x-virtual-env</th>
              <th className="px-3 py-2">服务</th>
              <th className="px-3 py-2">命名空间</th>
              <th className="min-w-[10rem] px-3 py-2">本地应用端口</th>
              <th className="w-12 px-2 py-2 text-center">健康</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {displayedProfiles.map((row) => {
              const running = isAlreadyMeshing(row);
              const key = profileKey(row);
              const favKey = meshProfileKey(row);
              const portInput = localPortInputs[key] ?? '';
              const portValue = parsePortInput(portInput);
              const canStart = !!meshUserId.trim() && portValue !== undefined;
              const meshVersion = previewMeshVersion(row.virtualEnv, meshUserId);
              const favLabel = `${row.deploymentName} (${row.namespace})`;
              return (
                <tr key={key} className="border-b hover:bg-gray-50">
                  <td className="px-2 py-2">
                    <FavoriteStarButton
                      active={isFavorite(favKey)}
                      label={favLabel}
                      onToggle={() => void toggleFavorite(favKey)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <VirtualEnvBadge value={row.virtualEnv} />
                  </td>
                  <td className="px-3 py-2">
                    {meshVersion ? (
                      <div className="space-y-1">
                        <code className="rounded-md bg-green-50 px-2 py-0.5 font-mono text-sm font-semibold text-green-900">
                          {meshVersion}
                        </code>
                        <button
                          type="button"
                          className="block text-xs text-gray-500 hover:text-indigo-700"
                          onClick={() => void handleCopyMeshHeader(meshVersion)}
                        >
                          复制 x-virtual-env
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">请先在配置页填写个人标识</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.deploymentName}</div>
                    <div className="text-xs text-gray-500">
                      {row.appName} · 容器 {row.containerPort}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{row.namespace}</td>
                  <td className="px-3 py-2">
                    {running ? (
                      <div className="font-mono text-sm text-gray-800">{running.localPort}</div>
                    ) : (
                      <LocalDevPortPicker
                        value={portInput}
                        options={sortedLocalDevPorts}
                        favoritePorts={favoriteLocalPorts}
                        onToggleFavorite={(port) => void toggleLocalPortFavorite(port)}
                        onChange={(v) => setLocalPortInput(key, v)}
                      />
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {running ? (
                      <HealthDot
                        result={meshHealthMap[running.id]}
                        loading={meshHealthLoading}
                      />
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col items-start gap-1">
                      {running ? (
                        <>
                          <span className="text-green-600">转发中 → :{running.localPort}</span>
                          <button
                            type="button"
                            className="text-xs text-red-600 hover:underline disabled:text-gray-400"
                            disabled={stoppingIds.has(running.id)}
                            onClick={() => void stopMesh(running.id)}
                          >
                            {stoppingIds.has(running.id) ? '停止中…' : '停止'}
                          </button>
                        </>
                      ) : (
                        <button
                          className="text-blue-600 hover:underline disabled:text-gray-400"
                          disabled={!meshVersion || !canStart}
                          onClick={() => void startMesh(row)}
                        >
                          转发到本地
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {displayedProfiles.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                  {listTab === 'favorites' && '暂无收藏的服务，点击星标添加收藏'}
                  {listTab === 'active' && '暂无进行中的流量转发'}
                  {listTab === 'all' && '未找到匹配的 virtual-env 工作负载'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {message && (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {message}
        </p>
      )}
    </div>
  );
}
