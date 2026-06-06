import type { HealthCheckResult, HealthLevel } from '@kt-virtual-env/shared';

const LEVEL_STYLE: Record<
  HealthLevel,
  { border: string; bg: string; text: string; dot: string; label: string }
> = {
  healthy: {
    border: 'border-green-200',
    bg: 'bg-green-50',
    text: 'text-green-900',
    dot: 'bg-green-500',
    label: '正常',
  },
  degraded: {
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    text: 'text-amber-900',
    dot: 'bg-amber-500',
    label: '部分异常',
  },
  unhealthy: {
    border: 'border-red-200',
    bg: 'bg-red-50',
    text: 'text-red-900',
    dot: 'bg-red-500',
    label: '异常',
  },
  unknown: {
    border: 'border-gray-200',
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    dot: 'bg-gray-400',
    label: '未检测',
  },
};

interface PanelProps {
  title: string;
  result: HealthCheckResult | null;
  loading?: boolean;
  onRefresh?: () => void;
}

// [AI-GEN] scope:HealthStatusPanel, model:auto, reviewed:false
export function HealthStatusPanel({ title, result, loading, onRefresh }: PanelProps) {
  const level = result?.level ?? 'unknown';
  const style = LEVEL_STYLE[level];

  return (
    <div className={`rounded-lg border p-3 ${style.border} ${style.bg}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} />
            <span className={`text-sm font-medium ${style.text}`}>{title}</span>
            <span className={`text-xs ${style.text}`}>{style.label}</span>
          </div>
          <p className={`mt-1 text-sm ${style.text}`}>
            {loading ? '检测中…' : (result?.message ?? '尚未检测')}
          </p>
          {result && result.details.length > 0 && (
            <ul className={`mt-2 space-y-0.5 text-xs ${style.text} opacity-90`}>
              {result.details.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
        {onRefresh && (
          <button
            type="button"
            className="shrink-0 text-xs text-blue-700 hover:underline disabled:text-gray-400"
            disabled={loading}
            onClick={onRefresh}
          >
            检测
          </button>
        )}
      </div>
    </div>
  );
}

export function HealthDot({
  result,
  loading,
}: {
  result?: HealthCheckResult;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <span
        className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-gray-300"
        title="检测中"
      />
    );
  }
  const level = result?.level ?? 'unknown';
  const style = LEVEL_STYLE[level];
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${style.dot}`}
      title={result?.message ?? '未检测'}
    />
  );
}
// [/AI-GEN]
