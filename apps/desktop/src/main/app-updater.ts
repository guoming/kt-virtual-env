import { app } from 'electron';
import updater from 'electron-updater';
import {
  INITIAL_UPDATE_STATUS,
  type AppUpdateStatus,
} from '@kt-virtual-env/shared';

const { autoUpdater } = updater;

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 10_000;

export class AppUpdater {
  private status: AppUpdateStatus;
  private listeners = new Set<(status: AppUpdateStatus) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private started = false;

  constructor(private notify: (status: AppUpdateStatus) => void) {
    this.status = INITIAL_UPDATE_STATUS(app.getVersion());
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

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.autoRunAppAfterInstall = true;

    autoUpdater.on('checking-for-update', () => {
      this.setStatus({
        phase: 'checking',
        currentVersion: app.getVersion(),
        message: '正在检查更新…',
      });
    });

    autoUpdater.on('update-available', (info) => {
      this.setStatus({
        phase: 'available',
        currentVersion: app.getVersion(),
        latestVersion: info.version,
        message: `发现新版本 ${info.version}，正在下载…`,
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      this.setStatus({
        phase: 'not-available',
        currentVersion: app.getVersion(),
        latestVersion: info.version,
        message: '当前已是最新版本',
      });
    });

    autoUpdater.on('download-progress', (progress) => {
      this.setStatus({
        phase: 'downloading',
        currentVersion: app.getVersion(),
        latestVersion: this.status.latestVersion,
        downloadPercent: Math.round(progress.percent),
        message: `正在下载更新 ${Math.round(progress.percent)}%`,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.setStatus({
        phase: 'downloaded',
        currentVersion: app.getVersion(),
        latestVersion: info.version,
        downloadPercent: 100,
        message: `新版本 ${info.version} 已就绪，可立即重启安装`,
      });
    });

    autoUpdater.on('error', (error) => {
      this.setStatus({
        phase: 'error',
        currentVersion: app.getVersion(),
        latestVersion: this.status.latestVersion,
        message: error.message,
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
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus({
        phase: 'error',
        currentVersion: app.getVersion(),
        message,
      });
    }
    return this.status;
  }

  installUpdate(): void {
    if (!app.isPackaged || this.status.phase !== 'downloaded') return;
    autoUpdater.quitAndInstall(false, true);
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
