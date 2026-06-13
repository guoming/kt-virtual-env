import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { CONFIG_DIR } from './config-store.js';
import { appendHelperLauncherLog } from './helper-log.js';

const execFileAsync = promisify(execFile);

export const HELPER_LABEL = 'com.kt.virtualenv.helper';
export const HELPER_INSTALL_PATH = `/Library/PrivilegedHelperTools/${HELPER_LABEL}`;
export const LAUNCHD_PLIST_PATH = `/Library/LaunchDaemons/${HELPER_LABEL}.plist`;

export interface MacLaunchDaemonPaths {
  helperBinary: string;
  socketPath: string;
  logPath: string;
}

function bashQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** AppleScript 字符串须用双引号，单引号会导致 osascript 语法错误且不弹授权窗 */
export function appleScriptQuote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

// [AI-GEN] scope:buildLaunchDaemonPlist, model:auto, reviewed:false
export function buildLaunchDaemonPlist(paths: MacLaunchDaemonPaths): string {
  const { helperBinary, socketPath, logPath } = paths;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${HELPER_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${helperBinary}</string>
    <string>-socket=${socketPath}</string>
    <string>-log=${logPath}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>ThrottleInterval</key>
  <integer>5</integer>
</dict>
</plist>
`;
}
// [/AI-GEN]

export function isMacLaunchDaemonInstalled(): boolean {
  if (process.platform !== 'darwin') return false;
  return fs.existsSync(LAUNCHD_PLIST_PATH) && fs.existsSync(HELPER_INSTALL_PATH);
}

// [AI-GEN] scope:buildMacInstallScript, model:auto, reviewed:false
export function buildMacInstallScript(helperSrc: string, plistSrc: string): string {
  return `#!/bin/bash
set -euo pipefail
install -m 755 -o root -g wheel ${bashQuote(helperSrc)} ${bashQuote(HELPER_INSTALL_PATH)}
install -m 644 -o root -g wheel ${bashQuote(plistSrc)} ${bashQuote(LAUNCHD_PLIST_PATH)}
launchctl bootout system/${HELPER_LABEL} 2>/dev/null || true
launchctl bootstrap system ${bashQuote(LAUNCHD_PLIST_PATH)}
launchctl kickstart -k system/${HELPER_LABEL}
`;
}
// [/AI-GEN]

export async function kickstartMacLaunchDaemon(): Promise<boolean> {
  if (process.platform !== 'darwin') return false;
  try {
    await execFileAsync('/bin/launchctl', ['kickstart', '-k', `system/${HELPER_LABEL}`], {
      timeout: 10_000,
    });
    appendHelperLauncherLog('launchd kickstart ok');
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    appendHelperLauncherLog(`launchd kickstart failed: ${msg}`);
    return false;
  }
}

function spawnOsascriptElevated(script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('osascript', ['-e', script], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const detail = stderr.trim();
      appendHelperLauncherLog(
        `osascript failed code=${code ?? 'unknown'} stderr=${detail || '(empty)'}`,
      );
      reject(
        new Error(
          detail
            ? `管理员授权失败：${detail}`
            : `LaunchDaemon 安装失败 (exit ${code ?? 'unknown'})，请在系统弹窗中确认管理员权限`,
        ),
      );
    });
  });
}

export async function installMacLaunchDaemon(
  helperSrc: string,
  socketPath: string,
  logPath: string,
): Promise<void> {
  if (process.platform !== 'darwin') {
    throw new Error('LaunchDaemon 仅支持 macOS');
  }

  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const plistSrc = path.join(CONFIG_DIR, `${HELPER_LABEL}.plist`);
  const installScriptPath = path.join(CONFIG_DIR, 'install-helper-launchd.sh');

  fs.writeFileSync(
    plistSrc,
    buildLaunchDaemonPlist({
      helperBinary: HELPER_INSTALL_PATH,
      socketPath,
      logPath,
    }),
    'utf8',
  );
  fs.writeFileSync(installScriptPath, buildMacInstallScript(helperSrc, plistSrc), {
    encoding: 'utf8',
    mode: 0o755,
  });

  appendHelperLauncherLog(
    `install launchd helperSrc=${helperSrc} socket=${socketPath} plist=${plistSrc}`,
  );

  const script = `do shell script ${appleScriptQuote(`/bin/bash ${installScriptPath}`)} with administrator privileges`;
  await spawnOsascriptElevated(script);
}
