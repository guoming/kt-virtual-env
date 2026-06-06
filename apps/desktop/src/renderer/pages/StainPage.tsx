import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  pushStainUrlHistory,
  removeStainUrlHistory,
  resolveStainVirtualEnv,
  type Session,
} from '@kt-virtual-env/shared';
import { StainUrlHistoryInput } from '../components/StainUrlHistoryInput';
import { StainVirtualEnvInput } from '../components/StainVirtualEnvInput';
import { requireKtveApi } from '../lib/api';
import { MESH_HEADER } from '../lib/branding';
import { useAppStore } from '../stores/app-store';

function activeMeshSessions(sessions: Session[]): Session[] {
  return sessions
    .filter(
      (s) =>
        s.type === 'mesh' &&
        (s.state === 'running' || s.state === 'starting' || s.state === 'pending'),
    )
    .sort((a, b) => {
      const env = (a.virtualEnv ?? '').localeCompare(b.virtualEnv ?? '');
      if (env !== 0) return env;
      return `${a.namespace}/${a.target}`.localeCompare(`${b.namespace}/${b.target}`);
    });
}

function normalizeUrlInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) return `http://${trimmed}`;
  return trimmed;
}

export function StainPage() {
  const { sessions, setPage } = useAppStore();
  const activeMeshes = useMemo(() => activeMeshSessions(sessions), [sessions]);
  const [url, setUrl] = useState('');
  const [urlHistory, setUrlHistory] = useState<string[]>([]);
  const [virtualEnvInput, setVirtualEnvInput] = useState('dev.v1');
  const [meshUserId, setMeshUserId] = useState('');
  const [browsers, setBrowsers] = useState<
    Array<{ id: string; url: string; virtualEnv: string; title: string }>
  >([]);
  const [stainDevTools, setStainDevTools] = useState(false);
  const [stainExtensionPaths, setStainExtensionPaths] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const effectiveVirtualEnv = useMemo(
    () => resolveStainVirtualEnv(virtualEnvInput, meshUserId),
    [virtualEnvInput, meshUserId],
  );

  const refreshList = useCallback(async () => {
    const list = await requireKtveApi().stain.list();
    setBrowsers(list);
  }, []);

  useEffect(() => {
    void requireKtveApi().config.get().then((cfg) => {
      const c = cfg as {
        meshUserId?: string;
        stainUrlHistory?: string[];
        lastStainVirtualEnv?: string;
        lastStainBaseVirtualEnv?: string;
        stainDevTools?: boolean;
        stainExtensionPaths?: string[];
      };
      const history = c.stainUrlHistory ?? [];
      setMeshUserId(c.meshUserId ?? '');
      setUrlHistory(history);
      if (history[0]) setUrl(history[0]);
      setVirtualEnvInput(
        c.lastStainVirtualEnv ?? c.lastStainBaseVirtualEnv ?? 'dev.v1',
      );
      setStainDevTools(c.stainDevTools ?? false);
      setStainExtensionPaths(c.stainExtensionPaths ?? []);
    });
    void refreshList();
    const timer = setInterval(() => void refreshList(), 2000);
    return () => clearInterval(timer);
  }, [refreshList]);

  const saveStainDevOptions = async (
    patch: Partial<{ stainDevTools: boolean; stainExtensionPaths: string[] }>,
  ) => {
    await requireKtveApi().config.save(patch);
  };

  const toggleDevTools = async (enabled: boolean) => {
    setStainDevTools(enabled);
    await saveStainDevOptions({ stainDevTools: enabled });
  };

  const addExtensionDir = async () => {
    const dir = await requireKtveApi().stain.pickExtensionDir();
    if (!dir) return;
    if (stainExtensionPaths.includes(dir)) {
      setMessage('该扩展目录已添加');
      return;
    }
    const next = [...stainExtensionPaths, dir];
    setStainExtensionPaths(next);
    await saveStainDevOptions({ stainExtensionPaths: next });
    setMessage(`已添加扩展目录：${dir}`);
  };

  const removeExtensionDir = async (dir: string) => {
    const next = stainExtensionPaths.filter((p) => p !== dir);
    setStainExtensionPaths(next);
    await saveStainDevOptions({ stainExtensionPaths: next });
  };

  const removeUrlHistory = async (entry: string) => {
    const nextHistory = removeStainUrlHistory(urlHistory, entry);
    setUrlHistory(nextHistory);
    if (url.trim() === entry.trim()) {
      setUrl(nextHistory[0] ?? '');
    }
    await requireKtveApi().config.save({ stainUrlHistory: nextHistory });
  };

  const openStainedPage = async () => {
    const targetUrl = normalizeUrlInput(url);
    if (!targetUrl) {
      setMessage('请输入网页地址');
      return;
    }
    if (!effectiveVirtualEnv) {
      setMessage(meshUserId ? '请填写 virtual-env' : '请填写完整的 x-virtual-env 或先在配置页填写个人标识');
      return;
    }
    setLoading(true);
    try {
      const result = await requireKtveApi().stain.open(targetUrl, effectiveVirtualEnv);
      const nextHistory = pushStainUrlHistory(urlHistory, url.trim());
      setUrlHistory(nextHistory);
      await requireKtveApi().config.save({
        stainUrlHistory: nextHistory,
        lastStainUrl: url.trim(),
        lastStainVirtualEnv: virtualEnvInput.trim(),
      });
      let msg = `已打开染色窗口，请求头 ${MESH_HEADER}: ${effectiveVirtualEnv}`;
      if (stainDevTools) msg += '（已启用开发模式）';
      if (result.warning) msg += `。${result.warning}`;
      setMessage(msg);
      await refreshList();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">流量染色</h2>
        <p className="mt-1 text-sm text-gray-600">
          在内置浏览器打开网页，自动为所有请求注入{' '}
          <code className="rounded bg-gray-100 px-1">{MESH_HEADER}</code> 请求头，效果类似 ModHeader 插件。
        </p>
      </div>

      <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-950">
        <div className="font-medium">使用说明</div>
        <ol className="mt-1.5 list-inside list-decimal space-y-1">
          <li>填写要访问的网页地址（网关或业务页面）</li>
          <li>
            填写或选择 {MESH_HEADER}：可从进行中的流量转发选择，也可输入集群 virtual-env 或完整值
          </li>
          <li>点击「打开染色页面」，在新窗口中浏览即可自动染色</li>
        </ol>
      </div>

      <div className="space-y-3 rounded border bg-white p-4">
        <div>
          <label className="text-sm font-medium text-gray-700">网页地址</label>
          <div className="mt-1">
            <StainUrlHistoryInput
              value={url}
              history={urlHistory}
              placeholder="dev-open-gateway.eminxing.com/..."
              onChange={setUrl}
              onRemoveHistory={(entry) => void removeUrlHistory(entry)}
              onEnter={() => void openStainedPage()}
            />
          </div>
          {urlHistory.length > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              聚焦输入框可从历史记录选择，点击 × 删除
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">{MESH_HEADER}</label>
          <div className="mt-1">
            <StainVirtualEnvInput
              value={virtualEnvInput}
              meshSessions={activeMeshes}
              meshUserId={meshUserId}
              onChange={setVirtualEnvInput}
              onOpenMeshPage={() => setPage('home')}
              onOpenSettings={() => setPage('settings')}
            />
          </div>
        </div>

        <div className="rounded bg-gray-50 px-3 py-2 font-mono text-sm text-gray-700">
          将注入请求头：{MESH_HEADER}:{' '}
          <span className="font-semibold text-indigo-800">
            {effectiveVirtualEnv || '（未填写）'}
          </span>
        </div>

        <div className="space-y-2 rounded border border-gray-200 bg-gray-50/80 p-3">
          <div className="text-sm font-medium text-gray-800">开发者选项</div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={stainDevTools}
              onChange={(e) => void toggleDevTools(e.target.checked)}
            />
            开发模式（打开染色窗口时自动启用 DevTools，停靠在窗口底部，按 F12 可切换）
          </label>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-gray-700">Chrome 扩展（解压目录）</span>
              <button
                type="button"
                className="rounded border bg-white px-2 py-1 text-xs hover:bg-gray-100"
                onClick={() => void addExtensionDir()}
              >
                添加扩展目录
              </button>
            </div>
            {stainExtensionPaths.length === 0 ? (
              <p className="text-xs text-gray-500">
                选择含 manifest.json 的扩展文件夹。可从 Chrome「扩展程序 → 开发者模式 → 打包扩展」解压，
                或进入 Chrome 扩展安装目录选择版本子目录。
              </p>
            ) : (
              <ul className="space-y-1.5">
                {stainExtensionPaths.map((dir) => (
                  <li
                    key={dir}
                    className="flex items-start justify-between gap-2 rounded border bg-white px-2 py-1.5 text-xs"
                  >
                    <span className="min-w-0 break-all font-mono text-gray-700" title={dir}>
                      {dir}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-red-600 hover:underline"
                      onClick={() => void removeExtensionDir(dir)}
                    >
                      删除
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <button
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          disabled={loading || !effectiveVirtualEnv}
          onClick={() => void openStainedPage()}
        >
          {loading ? '打开中…' : '打开染色页面'}
        </button>
      </div>

      {message && (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {message}
        </p>
      )}

      <div className="rounded border bg-gray-50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">已打开的染色窗口 ({browsers.length})</h3>
          {browsers.length > 0 && (
            <button
              className="text-xs text-red-600 hover:underline"
              onClick={() => {
                void requireKtveApi().stain.closeAll().then(refreshList);
              }}
            >
              全部关闭
            </button>
          )}
        </div>
        {browsers.length === 0 ? (
          <p className="text-sm text-gray-500">暂无染色窗口</p>
        ) : (
          <ul className="space-y-2">
            {browsers.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border bg-white px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{b.title}</div>
                  <div className="truncate text-xs text-gray-500">{b.url}</div>
                  <code className="mt-1 inline-block rounded bg-indigo-50 px-1.5 text-xs text-indigo-900">
                    {MESH_HEADER}: {b.virtualEnv}
                  </code>
                </div>
                <div className="flex gap-2">
                  <button
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => void requireKtveApi().stain.focus(b.id)}
                  >
                    聚焦
                  </button>
                  <button
                    className="text-xs text-gray-600 hover:underline"
                    onClick={() => void requireKtveApi().stain.toggleDevTools(b.id)}
                  >
                    DevTools
                  </button>
                  <button
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => void requireKtveApi().stain.close(b.id).then(refreshList)}
                  >
                    关闭
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
