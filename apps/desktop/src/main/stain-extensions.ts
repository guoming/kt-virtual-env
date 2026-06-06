import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Session } from 'electron';

export interface StainExtensionLoadResult {
  loaded: Array<{ path: string; name: string }>;
  failed: Array<{ path: string; error: string }>;
}

export function defaultChromeExtensionsDir(): string | undefined {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    return path.join(home, 'Library/Application Support/Google/Chrome/Default/Extensions');
  }
  if (process.platform === 'win32') {
    return path.join(home, 'AppData/Local/Google/Chrome/User Data/Default/Extensions');
  }
  return path.join(home, '.config/google-chrome/Default/Extensions');
}

export function isValidExtensionDir(dir: string): boolean {
  try {
    return fs.existsSync(path.join(dir, 'manifest.json'));
  } catch {
    return false;
  }
}

export function readExtensionName(dir: string): string {
  try {
    const raw = fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8');
    const manifest = JSON.parse(raw) as { name?: string };
    return manifest.name?.trim() || path.basename(dir);
  } catch {
    return path.basename(dir);
  }
}

// [AI-GEN] scope:loadStainExtensions, model:auto, reviewed:false
export async function loadStainExtensions(
  ses: Session,
  paths: string[],
): Promise<StainExtensionLoadResult> {
  const loaded: StainExtensionLoadResult['loaded'] = [];
  const failed: StainExtensionLoadResult['failed'] = [];
  const uniquePaths = [...new Set(paths.map((p) => p.trim()).filter(Boolean))];

  for (const extPath of uniquePaths) {
    if (!isValidExtensionDir(extPath)) {
      failed.push({ path: extPath, error: '目录无效或未找到 manifest.json' });
      continue;
    }
    try {
      const extension = await ses.extensions.loadExtension(extPath, {
        allowFileAccess: true,
      });
      loaded.push({
        path: extPath,
        name: extension.name || readExtensionName(extPath),
      });
    } catch (err) {
      failed.push({
        path: extPath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { loaded, failed };
}
// [/AI-GEN]
