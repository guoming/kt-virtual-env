import { useEffect, useRef, useState } from 'react';

interface Props {
  lines: string[];
  title?: string;
}

const LOG_PRE_CLASS =
  'overflow-auto whitespace-pre-wrap break-all font-mono text-green-200';

function LogText({ lines }: { lines: string[] }) {
  return lines.length === 0 ? '等待日志…' : lines.join('\n');
}

// [AI-GEN] scope:LogViewer, model:auto, reviewed:false
export function LogViewer({ lines, title = '会话日志' }: Props) {
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  useEffect(() => {
    if (!expanded || !expandedRef.current) return;
    expandedRef.current.scrollTop = expandedRef.current.scrollHeight;
  }, [lines, expanded]);

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-1 flex shrink-0 items-center justify-between gap-2">
          <span className="truncate text-xs text-gray-500">{title}</span>
          <button
            type="button"
            className="shrink-0 text-xs text-blue-600 hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
            disabled={lines.length === 0}
            onClick={() => setExpanded(true)}
          >
            放大查看
          </button>
        </div>
        <pre
          className={`h-48 min-h-0 flex-1 rounded bg-gray-900 p-2 text-xs ${LOG_PRE_CLASS}`}
        >
          <LogText lines={lines} />
        </pre>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={() => setExpanded(false)}
        >
          <div
            className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-gray-900 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={`${title} 日志`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-gray-700 px-4 py-3">
              <h3 className="truncate text-sm font-medium text-gray-100">{title}</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{lines.length} 行</span>
                <button
                  type="button"
                  className="rounded border border-gray-600 px-3 py-1 text-xs text-gray-200 hover:bg-gray-800"
                  onClick={() => setExpanded(false)}
                >
                  关闭
                </button>
              </div>
            </div>
            <pre
              ref={expandedRef}
              className={`min-h-0 flex-1 p-4 text-sm ${LOG_PRE_CLASS}`}
            >
              <LogText lines={lines} />
            </pre>
          </div>
        </div>
      )}
    </>
  );
}
// [/AI-GEN]
