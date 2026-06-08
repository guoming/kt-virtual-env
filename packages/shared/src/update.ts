export type UpdatePhase =
  | 'idle'
  | 'unsupported'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface AppUpdateStatus {
  phase: UpdatePhase;
  currentVersion: string;
  latestVersion?: string;
  downloadPercent?: number;
  message?: string;
}

export const INITIAL_UPDATE_STATUS = (currentVersion: string): AppUpdateStatus => ({
  phase: 'idle',
  currentVersion,
});

/** 将 electron-updater / GitHub 原始错误转为用户可读文案 */
export function formatUpdateErrorMessage(raw?: string): string {
  if (!raw?.trim()) return '无法检查更新，请稍后重试';
  const text = raw.trim();
  const firstLine = text.split('\n')[0]?.trim() ?? '';

  if (/429|rate limit/i.test(text)) {
    return 'GitHub 请求过于频繁，请稍后再试';
  }
  if (
    /^\d{3}$/.test(firstLine) ||
    /method:\s*GET|headers:|statusCode:|HttpError|Gateway Time-out|Gateway Timeout/i.test(
      text,
    ) ||
    /504|502|503|ETIMEDOUT|ENOTFOUND|ECONNRESET|fetch failed|network error/i.test(text) ||
    text.includes('<html') ||
    text.includes('set-cookie') ||
    text.length > 80
  ) {
    return '无法连接更新服务器，请检查网络后重试';
  }
  return text;
}
