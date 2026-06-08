import { useEffect, useState } from 'react';
import type { AppUpdateStatus } from '@kt-virtual-env/shared';
import { APP_REPO_URL } from '../lib/branding';
import { requireKtveApi } from '../lib/api';
import { VersionCompareLine } from './VersionCompareLine';
import { formatUpdateErrorMessage } from '@kt-virtual-env/shared';
import { mapUpdatePhase } from '../lib/version-compare-utils';

export function AppUpdatePanel() {
  const [status, setStatus] = useState<AppUpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const api = requireKtveApi();
    void api.update.getStatus().then(setStatus);
    return api.update.onChanged(setStatus);
  }, []);

  const check = async () => {
    setChecking(true);
    setMessage('');
    try {
      setStatus(await requireKtveApi().update.check());
    } catch (e) {
      setMessage(formatUpdateErrorMessage(e instanceof Error ? e.message : String(e)));
    } finally {
      setChecking(false);
    }
  };

  const install = async () => {
    setInstalling(true);
    setMessage('');
    try {
      const result = await requireKtveApi().update.install();
      if (!result.ok && result.reason === 'sessions') {
        setMessage(`请先停止 ${result.count} 个活跃会话后再更新`);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setInstalling(false);
    }
  };

  if (!status) return null;

  const canInstall = status.phase === 'downloaded';
  const showProgress =
    status.phase === 'downloading' && status.downloadPercent != null;

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-medium">应用更新</h3>
          <p className="mt-1 text-xs text-gray-500">
            启动后自动检查更新并下载；退出应用时也可自动安装（已打包版本）。
          </p>
        </div>
        <button
          type="button"
          className="rounded border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
          disabled={checking || status.phase === 'checking' || status.phase === 'unsupported'}
          onClick={() => void check()}
        >
          {checking || status.phase === 'checking' ? '检查中…' : '检查更新'}
        </button>
      </div>

      <div className="mt-3">
        <VersionCompareLine
          current={status.currentVersion}
          latest={status.latestVersion}
          mode="remote"
          state={mapUpdatePhase(status.phase)}
          onRetry={() => void check()}
        />
      </div>

      {status.phase === 'error' && (
        <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p>{formatUpdateErrorMessage(status.message)}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <button
              type="button"
              className="text-blue-700 hover:underline disabled:opacity-50"
              disabled={checking}
              onClick={() => void check()}
            >
              重试检查
            </button>
            <button
              type="button"
              className="text-blue-700 hover:underline"
              onClick={(e) => {
                e.preventDefault();
                void requireKtveApi().shell.openExternal(`${APP_REPO_URL}/releases`);
              }}
            >
              前往 GitHub 下载
            </button>
          </div>
        </div>
      )}

      {status.message && status.phase !== 'error' && (
        <p className="mt-2 text-xs text-gray-600">{status.message}</p>
      )}

      {showProgress && (
        <div className="mt-2">
          <div className="h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${status.downloadPercent}%` }}
            />
          </div>
        </div>
      )}

      {status.phase === 'unsupported' && (
        <a
          href={APP_REPO_URL}
          className="mt-2 inline-block text-sm text-blue-600 hover:underline"
          onClick={(e) => {
            e.preventDefault();
            void requireKtveApi().shell.openExternal(APP_REPO_URL);
          }}
        >
          前往 GitHub 下载最新安装包
        </a>
      )}

      {canInstall && (
        <button
          type="button"
          className="mt-3 rounded bg-blue-600 px-4 py-1.5 text-sm text-white disabled:opacity-50"
          disabled={installing}
          onClick={() => void install()}
        >
          {installing ? '正在重启…' : '立即重启并更新'}
        </button>
      )}

      {message && (
        <p className="mt-2 text-xs text-amber-800">{message}</p>
      )}
    </div>
  );
}
