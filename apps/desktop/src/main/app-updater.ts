import { app } from 'electron';
import updater from 'electron-updater';
import {
  INITIAL_UPDATE_STATUS,
  formatUpdateErrorMessage,
  type AppUpdateStatus,
  type UpdateInstallResult,
} from '@kt-virtual-env/shared';
import { isMacAppProperlySigned } from './macos-code-sign.js';

const { autoUpdater } = updater;

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 10_000;

const MANUAL_INSTALL_HINT =
  '当前 macOS 安装包未签名，无法应用内自动更新。发现新版本后请从 GitHub Releases 下载 DMG 手动安装。';

export class AppUpdater {
  private status: AppUpdateStatus;
  private listeners = new Set<(status: AppUpdateStatus) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private readonly manualInstallOnly: boolean;

  constructor(private notify: (status: AppUpdateStatus) => void) {
    this.status = INITIAL_UPDATE_STATUS(app.getVersion());
    this.manualInstallOnly = process.platform === 'darwin' && !isMacAppProperlySigned();
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    if (!app.isPackaged) {
      this.setStatus({
        phase: 'unsupported',
        currentVersion: app.getVersion(),
        message: '开发模式不支持自动更新',
      });
      return;
    }

    autoUpdater.autoDownload = !this.manualInstallOnly;
    autoUpdater.autoInstallOnAppQuit = !this.manualInstallOnly;
    autoUpdater.autoRunAppAfterInstall = !this.manualInstallOnly;

    if (this.manualInstallOnly) {
      this.setStatus({
        phase: 'idle',
        currentVersion: app.getVersion(),
        installMode: 'manual',
        message: MANUAL_INSTALL_HINT,
      });
    }

    autoUpdater.on('checking-for-update', () => {
      this.setStatus({
        phase: 'checking',
        currentVersion: app.getVersion(),
        installMode: this.manualInstallOnly ? 'manual' : 'auto',
        message: '正在检查更新…',
      });
    });

    autoUpdater.on('update-available', (info) => {
      this.setStatus({
        phase: 'available',
        currentVersion: app.getVersion(),
        latestVersion: info.version,
        installMode: this.manualInstallOnly ? 'manual' : 'auto',
        message: this.manualInstallOnly
          ? `发现新版本 ${info.version}，请从 GitHub 下载 DMG 手动安装`
          : `发现新版本 ${info.version}，正在下载…`,
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      this.setStatus({
        phase: 'not-available',
        currentVersion: app.getVersion(),
        latestVersion: info.version,
        installMode: this.manualInstallOnly ? 'manual' : 'auto',
        message: this.manualInstallOnly ? '当前已是最新版本' : '当前已是最新版本',
      });
    });

    autoUpdater.on('download-progress', (progress) => {
      this.setStatus({
        phase: 'downloading',
        currentVersion: app.getVersion(),
        latestVersion: this.status.latestVersion,
        downloadPercent: Math.round(progress.percent),
        installMode: 'auto',
        message: `正在下载更新 ${Math.round(progress.percent)}%`,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.setStatus({
        phase: 'downloaded',
        currentVersion: app.getVersion(),
        latestVersion: info.version,
        downloadPercent: 100,
        installMode: 'auto',
        message: `新版本 ${info.version} 已就绪，可立即重启安装`,
      });
    });

    autoUpdater.on('error', (error) => {
      this.setStatus({
        phase: 'error',
        currentVersion: app.getVersion(),
        latestVersion: this.status.latestVersion,
        installMode: this.manualInstallOnly ? 'manual' : 'auto',
        message: formatUpdateErrorMessage(error.message),
      });
    });

    setTimeout(() => void this.checkForUpdates(), STARTUP_DELAY_MS);
    this.timer = setInterval(() => void this.checkForUpdates(), CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  getStatus(): AppUpdateStatus {
    return this.status;
  }

  async checkForUpdates(): Promise<AppUpdateStatus> {
    if (!app.isPackaged) return this.status;
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      this.setStatus({
        phase: 'error',
        currentVersion: app.getVersion(),
        installMode: this.manualInstallOnly ? 'manual' : 'auto',
        message: formatUpdateErrorMessage(message),
      });
    }
    return this.status;
  }

  installUpdate(): UpdateInstallResult {
    if (!app.isPackaged) return { ok: false, reason: 'not-ready' };
    if (this.manualInstallOnly) return { ok: false, reason: 'unsigned' };
    if (this.status.phase !== 'downloaded') return { ok: false, reason: 'not-ready' };
    autoUpdater.quitAndInstall(false, true);
    return { ok: true };
  }

  private setStatus(status: AppUpdateStatus): void {
    this.status = status;
    this.notify(status);
    for (const listener of this.listeners) {
      listener(status);
    }
  }
}

let appUpdater: AppUpdater | null = null;

export function initAppUpdater(notify: (status: AppUpdateStatus) => void): AppUpdater {
  appUpdater ??= new AppUpdater(notify);
  appUpdater.start();
  return appUpdater;
}

export function getAppUpdater(): AppUpdater | null {
  return appUpdater;
}
