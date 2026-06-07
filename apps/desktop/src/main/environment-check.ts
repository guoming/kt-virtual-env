// [AI-GEN] scope:environment-check, model:auto, reviewed:false
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { promisify } from 'node:util';
import { app } from 'electron';
import type { ComponentCheck, EnvironmentStatus } from '@kt-virtual-env/shared';
import { findBundledBinary, findHelperPath } from './binary-resolver.js';
import { fetchLatestAppVersion } from './app-release-check.js';
import { loadBundledVersions } from './bundled-versions.js';
import { isHelperRunning } from './helper-launcher.js';

const execFileAsync = promisify(execFile);

async function probeCliVersion(bin: string, tool: 'ktctl' | 'kubectl'): Promise<string | undefined> {
  try {
    const args = tool === 'kubectl' ? ['version', '--client'] : ['--version'];
    const { stdout } = await execFileAsync(bin, args, { timeout: 8000 });
    return stdout.trim().split('\n')[0];
  } catch {
    return undefined;
  }
}

async function checkCliTool(tool: 'ktctl' | 'kubectl'): Promise<ComponentCheck> {
  const path = findBundledBinary(tool);
  if (!path) {
    return {
      ok: false,
      message: `${tool} 未安装`,
      hint: '在项目根目录执行：pnpm fetch-binaries',
    };
  }
  if (!fs.existsSync(path)) {
    return {
      ok: false,
      path,
      message: `${tool} 文件不存在`,
      hint: '在项目根目录执行：pnpm fetch-binaries',
    };
  }
  const version = await probeCliVersion(path, tool);
  if (!version) {
    return {
      ok: false,
      path,
      message: `${tool} 无法执行`,
      hint: '请重新下载二进制：pnpm fetch-binaries',
    };
  }
  return {
    ok: true,
    path,
    version,
    message: '已就绪',
  };
}

async function checkHelper(): Promise<ComponentCheck & { running: boolean }> {
  const path = findHelperPath();
  if (!path) {
    return {
      ok: false,
      running: false,
      message: '组件未安装',
      hint: '开发环境请执行 pnpm build:helper，完成后点击「重新检测」',
    };
  }
  if (!fs.existsSync(path)) {
    return {
      ok: false,
      path,
      running: false,
      message: '组件未安装',
      hint: '开发环境请执行 pnpm build:helper，完成后点击「重新检测」',
    };
  }
  const running = await isHelperRunning();
  if (!running) {
    return {
      ok: false,
      path,
      running: false,
      message: '待授权',
      hint: '点击「授权组网」，在系统弹窗中确认管理员权限（仅网络连接需要）',
    };
  }
  return {
    ok: true,
    path,
    running: true,
    message: '已授权，可进行网络连接',
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
