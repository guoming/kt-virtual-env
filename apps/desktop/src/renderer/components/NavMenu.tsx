import type { Session } from '@kt-virtual-env/shared';
import type { PageId } from '../stores/app-store';
import {
  countActiveByType,
  getConnectNavStatus,
  type ConnectNavStatus,
} from '../lib/session-utils';

const NAV: Array<{ id: PageId; label: string }> = [
  { id: 'settings', label: '配置' },
  { id: 'connect', label: '网络连接' },
  { id: 'home', label: '流量转发' },
  { id: 'forward', label: '端口转发' },
  { id: 'stain', label: '流量染色' },
];

// [AI-GEN] scope:NavMenu, model:auto, reviewed:false
function ConnectStatusIcon({ status }: { status: ConnectNavStatus }) {
  const meta: Record<
    ConnectNavStatus,
    { title: string; className: string; pulse?: boolean }
  > = {
    connected: { title: '集群网络已连接', className: 'text-green-500' },
    connecting: { title: '集群网络连接中', className: 'text-amber-500', pulse: true },
    failed: { title: '集群网络连接失败', className: 'text-red-500' },
    disconnected: { title: '集群网络未连接', className: 'text-gray-300' },
  };
  const { title, className, pulse } = meta[status];

  return (
    <span
      className={`inline-flex shrink-0 ${className} ${pulse ? 'animate-pulse' : ''}`}
      title={title}
      aria-label={title}
    >
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-4 w-4"
        aria-hidden
      >
        {status === 'connected' ? (
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
            clipRule="evenodd"
          />
        ) : status === 'failed' ? (
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
            clipRule="evenodd"
          />
        ) : status === 'connecting' ? (
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5a.75.75 0 001.5 0v-2.5zM10 14a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        ) : (
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-1.5a6.5 6.5 0 100-13 6.5 6.5 0 000 13z"
            clipRule="evenodd"
          />
        )}
      </svg>
    </span>
  );
}

function SessionCountBadge({
  count,
  label,
  tone,
}: {
  count: number;
  label: string;
  tone: 'indigo' | 'emerald';
}) {
  if (count <= 0) return null;
  const toneClass =
    tone === 'indigo'
      ? 'bg-indigo-100 text-indigo-800'
      : 'bg-emerald-100 text-emerald-800';
  return (
    <span
      className={`min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums ${toneClass}`}
      title={label}
      aria-label={label}
    >
      {count}
    </span>
  );
}

interface Props {
  page: PageId;
  sessions: Session[];
  onNavigate: (page: PageId) => void;
}

export function NavMenu({ page, sessions, onNavigate }: Props) {
  const connectStatus = getConnectNavStatus(sessions);
  const meshCount = countActiveByType(sessions, 'mesh');
  const forwardCount = countActiveByType(sessions, 'forward');

  return (
    <nav className="w-48 shrink-0 border-r p-2">
      {NAV.map((item) => {
        const active = page === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`mb-1 flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm ${
              active ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'
            }`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="truncate">{item.label}</span>
            <span className="flex shrink-0 items-center gap-1">
              {item.id === 'connect' && (
                <ConnectStatusIcon status={connectStatus} />
              )}
              {item.id === 'home' && (
                <SessionCountBadge
                  count={meshCount}
                  label={`${meshCount} 个流量转发进行中`}
                  tone="indigo"
                />
              )}
              {item.id === 'forward' && (
                <SessionCountBadge
                  count={forwardCount}
                  label={`${forwardCount} 个端口转发进行中`}
                  tone="emerald"
                />
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
// [/AI-GEN]
