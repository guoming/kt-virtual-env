import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR } from './config-store.js';

export function getHelperLogPath(): string {
  return path.join(CONFIG_DIR, 'helper.log');
}

export function appendHelperLauncherLog(message: string): void {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.appendFileSync(
      getHelperLogPath(),
      `${new Date().toISOString()} [launcher] ${message}\n`,
      'utf8',
    );
  } catch {
    // ignore logging failures
  }
}
