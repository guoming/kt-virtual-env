import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export function resolveAppIconPath(): string | undefined {
  const candidates = [
    path.join(__dirname, '../../build/icon.png'),
    path.join(process.cwd(), 'build/icon.png'),
    path.join(app.getAppPath(), 'build/icon.png'),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }
  return undefined;
}

export function resolveTrayIconPath(): string | undefined {
  const candidates = [
    path.join(process.resourcesPath, 'tray.png'),
    path.join(__dirname, '../../resources/tray.png'),
    path.join(process.cwd(), 'resources/tray.png'),
    path.join(app.getAppPath(), 'resources/tray.png'),
    resolveAppIconPath(),
  ];
  for (const file of candidates) {
    if (file && fs.existsSync(file)) return file;
  }
  return undefined;
}
