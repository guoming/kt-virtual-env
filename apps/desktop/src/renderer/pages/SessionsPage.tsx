import { useEffect, useState } from 'react';
import type { Session } from '@zt-virtual-env/shared';

export function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);

  const refresh = () => void window.ztve.sessions.list().then(setSessions);
  useEffect(() => {
    refresh();
    return window.ztve.sessions.onUpdate(setSessions);
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">会话管理</h2>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">类型</th>
            <th>目标</th>
            <th>命名空间</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} className="border-b">
              <td className="py-2 uppercase">{s.type}</td>
              <td>{s.target}</td>
              <td>{s.namespace}</td>
              <td>{s.state}</td>
              <td>
                <button className="text-red-600 hover:underline" onClick={() => void window.ztve.sessions.stop(s.id).then(refresh)}>
                  停止
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2">
        <button className="rounded border px-3 py-1 text-sm" onClick={() => void window.ztve.sessions.stopAll().then(refresh)}>全部停止</button>
        <button
          className="rounded border px-3 py-1 text-sm"
          onClick={() => {
            if (confirm('确认执行 recover？')) void window.ztve.ktctl.recover(sessions[0]?.target ?? '', sessions[0]?.namespace ?? '');
          }}
        >
          recover
        </button>
        <button
          className="rounded border px-3 py-1 text-sm text-red-600"
          onClick={() => {
            if (confirm('确认 clean 清理 ktctl 残留资源？')) void window.ztve.ktctl.clean();
          }}
        >
          clean
        </button>
      </div>
    </div>
  );
}
