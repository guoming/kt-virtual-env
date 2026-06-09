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
  /** auto：可应用内重启安装；manual：须从 GitHub 下载 DMG（未签名构建） */
  installMode?: 'auto' | 'manual';
}

export type UpdateInstallResult =
  | { ok: true }
  | { ok: false; reason: 'sessions'; count: number }
  | { ok: false; reason: 'unsigned' }
  | { ok: false; reason: 'not-ready' };

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
    /code signature|代码对象根本未签名|not signed|ShipIt|did not pass validation/i.test(text)
  ) {
    return '当前安装包未进行 Apple 代码签名，无法使用应用内自动更新。请前往 GitHub Releases 下载最新 DMG 手动安装。';
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
