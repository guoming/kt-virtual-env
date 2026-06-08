import { isVersionNewer, parseSemver } from '@kt-virtual-env/shared';
import type { VersionLatestState } from '../lib/version-compare-utils';

interface VersionCompareLineProps {
  current: string;
  latest?: string;
  /** remote：联网查应用最新版；bundled：与安装包内嵌版本对比 */
  mode?: 'remote' | 'bundled';
  state?: VersionLatestState;
  repoLabel?: string;
  onOpenRepo?: () => void;
  onRetry?: () => void;
}

export function VersionCompareLine({
  current,
  latest,
  mode = 'bundled',
  state = 'ready',
  repoLabel,
  onOpenRepo,
  onRetry,
}: VersionCompareLineProps) {
  const currentSemver = parseSemver(current) ?? current;
  const latestSemver = latest ? (parseSemver(latest) ?? latest) : undefined;
  const hasUpdate = latestSemver ? isVersionNewer(latestSemver, currentSemver) : false;

  let suffix: string | null = null;
  if (mode === 'remote') {
    if (state === 'checking') {
      suffix = '检查更新中…';
    } else if (state === 'failed') {
      suffix = '更新检查失败';
    } else if (state === 'ready' && latestSemver) {
      suffix = hasUpdate ? `有更新 v${latestSemver}` : '已是最新';
    }
  } else if (latestSemver) {
    suffix = hasUpdate ? `可更新至 v${latestSemver}` : '已是最新';
  }

  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-gray-500">
      <span>
        v<span className="font-mono">{currentSemver}</span>
        {suffix && (
          <>
            <span className="text-gray-300"> · </span>
            <span
              className={
                suffix.includes('失败')
                  ? 'text-gray-400'
                  : suffix.includes('有更新') || suffix.includes('可更新')
                    ? 'text-amber-700'
                    : suffix.includes('检查')
                      ? 'text-gray-400'
                      : 'text-green-700'
              }
            >
              {suffix}
            </span>
          </>
        )}
      </span>
      {mode === 'remote' && state === 'failed' && onRetry && (
        <button
          type="button"
          className="text-blue-600 hover:underline"
          onClick={onRetry}
        >
          重试
        </button>
      )}
      {repoLabel && onOpenRepo && (
        <>
          <span className="text-gray-300">·</span>
          <button
            type="button"
            className="text-blue-600 hover:underline"
            onClick={onOpenRepo}
          >
            {repoLabel}
          </button>
        </>
      )}
    </p>
  );
}
