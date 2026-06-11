import { useEffect, useMemo, useState } from 'react';
import { getKtveApi } from './lib/api';
import { PreloadMissing } from './components/PreloadMissing';
import { useAppStore, type PageId } from './stores/app-store';
import { HomePage } from './pages/HomePage';
import { ConnectPage } from './pages/ConnectPage';
import { ForwardPage } from './pages/ForwardPage';
import { StainPage } from './pages/StainPage';
import { SettingsPage } from './pages/SettingsPage';
import { SessionPanel } from './components/SessionPanel';
import { LogViewer } from './components/LogViewer';
import { ExitDialog } from './components/ExitDialog';
import { NavMenu } from './components/NavMenu';
import type { AppUpdateStatus, HealthSnapshot } from '@kt-virtual-env/shared';
import { APP_NAME, APP_REPO_URL, APP_SLOGAN } from './lib/branding';
import { VersionCompareLine } from './components/VersionCompareLine';
import { mapUpdatePhase } from './lib/version-compare-utils';
import { isPanelSession } from './lib/session-utils';

function MainContent({ page }: { page: PageId }) {
  switch (page) {
    case 'home': return <HomePage />;
    case 'stain': return <StainPage />;
    case 'connect': return <ConnectPage />;
    case 'forward': return <ForwardPage />;
    case 'settings': return <SettingsPage />;
  }
}

export default function App() {
  const api = getKtveApi();
  const { page, setPage, sessions, setSessions } = useAppStore();
  const [selectedId, setSelectedId] = useState<string>();
  const [exitCount, setExitCount] = useState<number | null>(null);
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus>();
  const [healthSnapshot, setHealthSnapshot] = useState<HealthSnapshot>({
    connect: null,
    sessions: {},
  });
  const [retryingIds, setRetryingIds] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!api) return;
    void api.sessions.list().then(setSessions);
    return api.sessions.onUpdate(setSessions);
  }, [api, setSessions]);

  useEffect(() => {
    if (!api) return;
    return api.app.onConfirmExit((count) => setExitCount(count));
  }, [api]);

  useEffect(() => {
    if (!api) return;
    const apply = (status: AppUpdateStatus) => setUpdateStatus(status);
    void api.update.getStatus().then(apply);
    return api.update.onChanged(apply);
  }, [api]);

  useEffect(() => {
    if (!api) return;
    void api.health.getSnapshot().then(setHealthSnapshot);
    return api.health.onChanged(setHealthSnapshot);
  }, [api]);

  const panelSessions = useMemo(
    () => sessions.filter(isPanelSession),
    [sessions],
  );

  useEffect(() => {
    if (selectedId && !panelSessions.some((s) => s.id === selectedId)) {
      setSelectedId(undefined);
    }
  }, [selectedId, panelSessions]);

  if (!api) {
    return <PreloadMissing />;
  }

  const selected =
    panelSessions.find((s) => s.id === selectedId) ??
    panelSessions[panelSessions.length - 1];
  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <div>
          <div className="font-semibold leading-tight">{APP_NAME}</div>
          <div className="text-xs text-gray-500">{APP_SLOGAN}</div>
        </div>
        <div className="flex flex-col items-end">
          {updateStatus && (
            <VersionCompareLine
              current={updateStatus.currentVersion}
              latest={updateStatus.latestVersion}
              mode="remote"
              state={mapUpdatePhase(updateStatus.phase)}
              repoLabel="发布页"
              onOpenRepo={() => void api.shell.openExternal(APP_REPO_URL)}
              onRetry={() => void api.update.check()}
            />
          )}
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <NavMenu page={page} sessions={sessions} onNavigate={setPage} />
        <main className="flex-1 overflow-auto p-4">
          <MainContent page={page} />
        </main>
        <aside className="flex w-80 shrink-0 flex-col border-l p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">会话 / 日志</h3>
            <button className="text-xs text-red-600" onClick={() => void api.sessions.stopAll()}>全部停止</button>
          </div>
          <SessionPanel
            sessions={panelSessions}
            healthSnapshot={healthSnapshot}
            retryingIds={retryingIds}
            selectedId={selected?.id}
            onSelect={setSelectedId}
            onStop={(id) => void api.sessions.stop(id)}
            onRetry={(id) => {
              if (retryingIds.has(id)) return;
              setRetryingIds((prev) => new Set(prev).add(id));
              void api.sessions.retry(id).finally(() => {
                setRetryingIds((prev) => {
                  const next = new Set(prev);
                  next.delete(id);
                  return next;
                });
              });
            }}
          />
          <div className="mt-3 flex-1">
            <LogViewer lines={selected?.logs ?? []} />
          </div>
        </aside>
      </div>
      {exitCount !== null && (
        <ExitDialog
          count={exitCount}
          onCancel={() => {
            setExitCount(null);
            void api.app.forceQuit('cancel');
          }}
          onStopAll={() => void api.app.forceQuit('stopAll')}
        />
      )}
    </div>
  );
}
