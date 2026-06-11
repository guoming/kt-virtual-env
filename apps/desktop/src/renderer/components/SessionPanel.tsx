import type { HealthSnapshot, Session } from '@kt-virtual-env/shared';
import {
  canRetrySession,
  canStopSession,
  getSessionHealth,
  showSessionActions,
} from '../lib/session-utils';

interface Props {
  sessions: Session[];
  healthSnapshot: HealthSnapshot;
  retryingIds: ReadonlySet<string>;
  selectedId?: string;
  onSelect: (id: string) => void;
  onStop: (id: string) => void;
  onRetry: (id: string) => void;
}

export function SessionPanel({
  sessions,
  healthSnapshot,
  retryingIds,
  selectedId,
  onSelect,
  onStop,
  onRetry,
}: Props) {
  if (sessions.length === 0) {
    return <p className="text-sm text-gray-500">暂无活跃会话</p>;
  }
  return (
    <ul className="space-y-2">
      {sessions.map((s) => {
        const health = getSessionHealth(s, healthSnapshot);
        const retrying = retryingIds.has(s.id);
        const showRetry = canRetrySession(s, health);
        const showStop = canStopSession(s);

        return (
          <li
            key={s.id}
            className={`rounded border p-2 text-xs cursor-pointer ${selectedId === s.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
            onClick={() => onSelect(s.id)}
          >
            <div className="flex justify-between">
              <span className="font-medium uppercase">{s.type}</span>
              <span>{s.state}</span>
            </div>
            <div className="truncate text-gray-600">{s.target}</div>
            {showSessionActions(s, health) && (
              <div className="mt-1 flex gap-3">
                {showRetry && (
                  <button
                    type="button"
                    className="text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                    disabled={retrying}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRetry(s.id);
                    }}
                  >
                    {retrying ? '重试中…' : '重试'}
                  </button>
                )}
                {showStop && (
                  <button
                    type="button"
                    className="text-red-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                    disabled={retrying}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStop(s.id);
                    }}
                  >
                    停止
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
