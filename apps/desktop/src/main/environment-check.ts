// [AI-GEN] scope:environment-check, model:auto, reviewed:false
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { app } from 'electron';
import type { ComponentCheck, EnvironmentStatus } from '@kt-virtual-env/shared';
import { findBundledBinary, findHelperPath } from './binary-resolver.js';
import { fetchLatestAppVersion } from './app-release-check.js';
import { loadBundledVersions } from './bundled-versions.js';
import { isHelperRunning } from './helper-launcher.js';
import { isMacLaunchDaemonInstalled, kickstartMacLaunchDaemon } from './helper-launchd.js';
import { getHelperLogPath } from './helper-log.js';
import { withWindowsExecOptions } from './windows-spawn.js';

const execFileAsync = promisify(execFile);

async function probeCliVersion(bin: string, tool: 'ktctl' | 'kubectl'): Promise<string | undefined> {
  try {
    const args = tool === 'kubectl' ? ['version', '--client'] : ['--version'];
    const { stdout } = await execFileAsync(bin, args, withWindowsExecOptions({ timeout: 8000 }));
    return stdout.trim().split('\n')[0];
  } catch {
    return undefined;
  }
}

async function checkCliTool(tool: 'ktctl' | 'kubectl'): Promise<ComponentCheck> {
  const binPath = findBundledBinary(tool);
  if (!binPath) {
    return {
      ok: false,
      message: `${tool} 未安装`,
      hint: '在项目根目录执行：pnpm fetch-binaries',
    };
  }
  if (!fs.existsSync(binPath)) {
    return {
      ok: false,
      path: binPath,
      message: `${tool} 文件不存在`,
      hint: '在项目根目录执行：pnpm fetch-binaries',
    };
  }
  const version = await probeCliVersion(binPath, tool);
  if (!version) {
    return {
      ok: false,
      path: binPath,
      message: `${tool} 无法执行`,
      hint: '请重新下载二进制：pnpm fetch-binaries',
    };
  }
  if (tool === 'ktctl' && process.platform === 'win32') {
    const wintunPath = path.join(path.dirname(binPath), 'wintun.dll');
    if (!fs.existsSync(wintunPath)) {
      return {
        ok: false,
        path: binPath,
        version,
        message: 'wintun.dll 缺失',
        hint: 'Windows Connect 需要 wintun.dll，请重新安装最新版本应用',
      };
    }
  }
  return {
    ok: true,
    path: binPath,
    version,
    message: '已就绪',
  };
}

async function checkHelper(): Promise<ComponentCheck & { running: boolean }> {
  const helperPath = findHelperPath();
  if (!helperPath) {
    return {
      ok: false,
      running: false,
      message: '组件未安装',
      hint: '开发环境请执行 pnpm build:helper，完成后点击「重新检测」',
    };
  }
  if (!fs.existsSync(helperPath)) {
    return {
      ok: false,
      path: helperPath,
      running: false,
      message: '组件未安装',
      hint: '开发环境请执行 pnpm build:helper，完成后点击「重新检测」',
    };
  }
  const running = await isHelperRunning();
  if (!running) {
    if (process.platform === 'darwin' && isMacLaunchDaemonInstalled()) {
      await kickstartMacLaunchDaemon();
      await new Promise((r) => setTimeout(r, 1000));
      const retried = await isHelperRunning();
      if (retried) {
        return {
          ok: true,
          path: helperPath,
          running: true,
          message: '已授权（系统服务），可进行网络连接',
        };
      }
    }
    const logHint =
      process.platform === 'win32' || process.platform === 'darwin'
        ? `，失败时可查看日志：${getHelperLogPath()}`
        : '';
    const authHint =
      process.platform === 'darwin'
        ? '点击「授权组网」完成一次性管理员授权，之后由系统服务自动维护，无需重复输入密码'
        : '点击「授权组网」，在系统弹窗中确认管理员权限（仅网络连接需要）';
    return {
      ok: false,
      path: helperPath,
      running: false,
      message: '待授权',
      hint: `${authHint}${logHint}`,
    };
  }
  return {
    ok: true,
    path: helperPath,
    running: true,
    message:
      process.platform === 'darwin' && isMacLaunchDaemonInstalled()
        ? '已授权（系统服务），可进行网络连接'
        : '已授权，可进行网络连接',
  };
}

export async function checkEnvironment(): Promise<EnvironmentStatus> {
  const bundled = loadBundledVersions();
  const [helper, ktctl, kubectl, appLatestVersion] = await Promise.all([
    checkHelper(),
    checkCliTool('ktctl'),
    checkCliTool('kubectl'),
    fetchLatestAppVersion(),
  ]);
  return {
    appVersion: app.getVersion(),
    appLatestVersion,
    bundledKtctlVersion: bundled.ktctl.version,
    bundledKubectlVersion: bundled.kubectl.version,
    helper,
    ktctl,
    kubectl,
  };
}
// [/AI-GEN]
