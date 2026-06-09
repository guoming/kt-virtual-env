import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { app } from 'electron';

// [AI-GEN] scope:macos-code-sign, model:auto, reviewed:false
/** macOS 应用内更新（ShipIt）要求安装包已通过 codesign 校验 */
export function isMacAppProperlySigned(): boolean {
  if (process.platform !== 'darwin' || !app.isPackaged) return false;
  try {
    const bundlePath = path.resolve(app.getAppPath(), '../../..');
    execFileSync('codesign', ['--verify', '--deep', '--strict', bundlePath], {
      stdio: 'ignore',
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}
// [/AI-GEN]
