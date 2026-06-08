import type { UpdatePhase } from '@kt-virtual-env/shared';

export type VersionLatestState = 'idle' | 'checking' | 'ready' | 'failed';

export function mapUpdatePhase(phase: UpdatePhase): VersionLatestState {
  switch (phase) {
    case 'checking':
      return 'checking';
    case 'error':
      return 'failed';
    case 'not-available':
    case 'available':
    case 'downloading':
    case 'downloaded':
      return 'ready';
    default:
      return 'idle';
  }
}

/** 将 electron-updater / GitHub 原始错误转为用户可读文案 */
export function formatUpdateErrorMessage(raw?: string): string {
  if (!raw?.trim()) return '无法检查更新，请稍后重试';
  const text = raw.trim();
  if (
    /504|502|503|gateway|timeout|ETIMEDOUT|ENOTFOUND|ECONNRESET|fetch failed|network/i.test(
      text,
    ) ||
    text.includes('<html') ||
    text.length > 120
  ) {
    return '无法连接更新服务器，请检查网络后重试';
  }
  return text;
}
