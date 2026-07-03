// [AI-GEN] scope:windows-spawn, model:auto, reviewed:false
import path from 'node:path';
import { getBundledBinary } from './binary-resolver.js';

/** Windows CREATE_NO_WINDOW — 避免控制台程序弹出命令行窗口 */
export const WINDOWS_CREATE_NO_WINDOW = 0x08000000;

export type WindowsSpawnOptions = {
  windowsHide: true;
  creationFlags: number;
};

export type WindowsExecOptions = {
  windowsHide: true;
  creationFlags: number;
};

export function getWindowsSpawnOptions(): WindowsSpawnOptions | Record<string, never> {
  if (process.platform !== 'win32') return {};
  return { windowsHide: true, creationFlags: WINDOWS_CREATE_NO_WINDOW };
}

export function getWindowsExecOptions(): WindowsExecOptions | Record<string, never> {
  if (process.platform !== 'win32') return {};
  return { windowsHide: true, creationFlags: WINDOWS_CREATE_NO_WINDOW };
}

/** 合并 execFile / execFileSync 选项，避免遗漏 windowsHide */
export function withWindowsExecOptions<T extends Record<string, unknown>>(options: T): T & WindowsExecOptions {
  if (process.platform !== 'win32') return options as T & WindowsExecOptions;
  return {
    ...options,
    windowsHide: true,
    creationFlags: WINDOWS_CREATE_NO_WINDOW,
  };
}

/** ktctl 通过 PATH 查找 kubectl；Windows 上须优先使用 bundled bin（含 kubectl shim） */
export function buildKtctlSpawnEnv(extra?: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = { ...process.env, ...extra } as Record<string, string>;
  if (process.platform !== 'win32') return env;
  const binDir = path.dirname(getBundledBinary('ktctl'));
  const sep = path.delimiter;
  const currentPath = env.PATH ?? '';
  if (!currentPath.split(sep).includes(binDir)) {
    env.PATH = currentPath ? `${binDir}${sep}${currentPath}` : binDir;
  }
  return env;
}

export function getBundledKubectlBinDir(): string {
  return path.dirname(getBundledBinary('kubectl'));
}
// [/AI-GEN]
