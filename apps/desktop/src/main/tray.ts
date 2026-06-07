import { Menu, Tray, nativeImage } from 'electron';
import { resolveTrayIconPath } from './app-icon.js';

const APP_TITLE = 'Kubernetes 虚拟环境工作台';

let tray: Tray | null = null;

function loadTrayIcon(): Electron.NativeImage {
  const iconPath = resolveTrayIconPath();
  if (iconPath) {
    const image = nativeImage.createFromPath(iconPath);
    if (!image.isEmpty()) return image;
  }
  return nativeImage.createEmpty();
}

export interface AppTrayHandlers {
  onShow: () => void;
  onQuit: () => void;
}

export function createAppTray(handlers: AppTrayHandlers): Tray {
  if (tray) return tray;

  tray = new Tray(loadTrayIcon());
  tray.setToolTip(APP_TITLE);

  const menu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: handlers.onShow },
    { type: 'separator' },
    { label: '退出', click: handlers.onQuit },
  ]);
  tray.setContextMenu(menu);

  tray.on('click', handlers.onShow);
  tray.on('double-click', handlers.onShow);

  return tray;
}

export function destroyAppTray(): void {
  tray?.destroy();
  tray = null;
}
