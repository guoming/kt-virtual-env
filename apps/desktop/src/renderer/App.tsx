import { useEffect, useState } from 'react';
import './lib/api';
import { useAppStore, type PageId } from './stores/app-store';
import { HomePage } from './pages/HomePage';
import { ConnectPage } from './pages/ConnectPage';
import { ForwardPage } from './pages/ForwardPage';
import { MeshPage } from './pages/MeshPage';
import { SessionsPage } from './pages/SessionsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SessionPanel } from './components/SessionPanel';
import { LogViewer } from './components/LogViewer';
import { ExitDialog } from './components/ExitDialog';

const NAV: Array<{ id: PageId; label: string }> = [
  { id: 'home', label: '联调首页' },
  { id: 'connect', label: '网络连接' },
  { id: 'forward', label: '端口转发' },
  { id: 'mesh', label: '流量 Mesh' },
  { id: 'sessions', label: '会话管理' },
  { id: 'settings', label: '设置' },
];

function MainContent({ page }: { page: PageId }) {
  switch (page) {
    case 'home': return <HomePage />;
    case 'connect': return <ConnectPage />;
    case 'forward': return <ForwardPage />;
    case 'mesh': return <MeshPage />;
    case 'sessions': return <SessionsPage />;
    case 'settings': return <SettingsPage />;
  }
}

export default function App() {
  const { page, setPage, sessions, setSessions, helperRunning, setHelperRunning } = useAppStore();
  const [selectedId, setSelectedId] = useState<string>();
  const [exitCount, setExitCount] = useState<number | null>(null);

  useEffect(() => {
    void window.ztve.sessions.list().then(setSessions);
    void window.ztve.helper.status().then((s) => setHelperRunning(s.running));
    return window.ztve.sessions.onUpdate(setSessions);
  }, [setSessions, setHelperRunning]);

  useEffect(() => {
    return window.ztve.app.onConfirmExit((count) => setExitCount(count));
  }, []);

  const selected = sessions.find((s) => s.id === selectedId) ?? sessions[sessions.length - 1];
  const runningCount = sessions.filter((s) => s.state === 'running').length;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 items-center justify-between border-b px-4">
        <span className="font-semibold">zt-virtual-env</span>
        <div className="flex items-center gap-4 text-sm">
          <span className={helperRunning ? 'text-green-600' : 'text-amber-600'}>
            Helper {helperRunning ? '● 已授权' : '○ 未授权'}
          </span>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <nav className="w-44 shrink-0 border-r p-2">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={`mb-1 flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm ${page === item.id ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'}`}
              onClick={() => setPage(item.id)}
            >
              {item.label}
              {item.id === 'sessions' && runningCount > 0 && (
                <span className="rounded-full bg-blue-600 px-1.5 text-xs text-white">{runningCount}</span>
              )}
            </button>
          ))}
        </nav>
        <main className="flex-1 overflow-auto p-4">
          <MainContent page={page} />
        </main>
        <aside className="flex w-80 shrink-0 flex-col border-l p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">会话 / 日志</h3>
            <button className="text-xs text-red-600" onClick={() => void window.ztve.sessions.stopAll()}>全部停止</button>
          </div>
          <SessionPanel
            sessions={sessions}
            selectedId={selected?.id}
            onSelect={setSelectedId}
            onStop={(id) => void window.ztve.sessions.stop(id)}
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
            void window.ztve.app.forceQuit('cancel');
          }}
          onStopAll={() => void window.ztve.app.forceQuit('stopAll')}
        />
      )}
    </div>
  );
}
