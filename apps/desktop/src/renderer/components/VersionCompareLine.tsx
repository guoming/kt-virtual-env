import { isVersionNewer, parseSemver } from '@kt-virtual-env/shared';

interface VersionCompareLineProps {
  current: string;
  latest?: string;
}

export function VersionCompareLine({ current, latest }: VersionCompareLineProps) {
  const currentSemver = parseSemver(current) ?? current;
  const latestSemver = latest ? (parseSemver(latest) ?? latest) : undefined;
  const hasUpdate = latestSemver ? isVersionNewer(latestSemver, currentSemver) : false;

  return (
    <p className="mt-1 text-xs text-gray-500">
      当前 <span className="font-mono">{currentSemver}</span>
      {latestSemver ? (
        <>
          {' '}
          · 最新 <span className="font-mono">{latestSemver}</span>
          {hasUpdate ? (
            <span className="text-amber-700">（有更新）</span>
          ) : (
            <span className="text-green-700">（已是最新）</span>
          )}
        </>
      ) : (
        <span className="text-gray-400"> · 最新版本未获取</span>
      )}
    </p>
  );
}
