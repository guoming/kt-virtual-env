import type { Session } from '@kt-virtual-env/shared';
import { isActiveSession } from '../lib/session-utils';

interface Props {
  sessions: Session[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onStop: (id: string) => void;
}

export function SessionPanel({ sessions, selectedId, onSelect, onStop }: Props) {
  if (sessions.length === 0) {
    return <p className="text-sm text-gray-500">暂无活跃会话</p>;
  }
  return (
    <ul className="space-y-2">
      {sessions.map((s) => (
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
          {isActiveSession(s) && (
            <button
              className="mt-1 text-red-600 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onStop(s.id);
              }}
            >
              停止
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
