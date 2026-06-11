import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensurePathWritable, isPathWritable } from './path-ownership.js';
import { runtimeUserKey } from './runtime-user-key.js';

/** 提权 connect 使用的 HOME，避免 root 污染用户 ~/.kt */
export function getElevatedKtHome(): string {
  return path.join(os.tmpdir(), `kt-virtual-env-kt-elevated-${runtimeUserKey()}`);
}

export function getUserKtDir(): string {
  return path.join(os.homedir(), '.kt');
}

const KT_SUBDIRS = ['pid', 'key', 'lock', 'profile'] as const;

export function ensureUserKtDirs(): void {
  const base = getUserKtDir();
  fs.mkdirSync(base, { recursive: true });
  for (const sub of KT_SUBDIRS) {
    fs.mkdirSync(path.join(base, sub), { recursive: true });
  }
}

export function isUserKtWritable(): boolean {
  ensureUserKtDirs();
  return isPathWritable(getUserKtDir());
}

/** 将 ~/.kt 所有权交还当前用户（macOS 需管理员授权） */
export async function repairUserKtOwnership(): Promise<void> {
  const ktDir = getUserKtDir();
  if (!fs.existsSync(ktDir)) {
    ensureUserKtDirs();
    return;
  }
  await ensurePathWritable(ktDir, '~/.kt 目录');
}

let userKtRepairFailed = false;

export async function ensureUserKtReady(): Promise<void> {
  ensureUserKtDirs();
  if (isUserKtWritable()) {
    userKtRepairFailed = false;
    return;
  }
  if (userKtRepairFailed) {
    throw new Error(
      '~/.kt 目录权限不足。请在终端执行 sudo chown -R $(whoami) ~/.kt 后重试，勿重复点击授权以免反复弹窗。',
    );
  }
  try {
    await ensurePathWritable(getUserKtDir(), '~/.kt 目录');
  } catch (e) {
    userKtRepairFailed = true;
    throw e;
  }
}

export function readPidFromKtDir(ktHome: string, nameHint: string): number | undefined {
  const pidDir = path.join(ktHome, '.kt', 'pid');
  if (!fs.existsSync(pidDir)) return undefined;
  for (const file of fs.readdirSync(pidDir)) {
    if (!nameHint || !file.toLowerCase().includes(nameHint.toLowerCase())) continue;
    try {
      const raw = fs.readFileSync(path.join(pidDir, file), 'utf8').trim();
      const pid = Number.parseInt(raw, 10);
      if (pid > 0) return pid;
    } catch {
      // ignore unreadable pid files
    }
  }
  return undefined;
}

/** 读取 ktHome 下任意 pid 文件（connect 提权后文件名未必含 connect） */
export function readAnyPidFromKtDir(ktHome: string): number | undefined {
  const pidDir = path.join(ktHome, '.kt', 'pid');
  if (!fs.existsSync(pidDir)) return undefined;
  for (const file of fs.readdirSync(pidDir)) {
    try {
      const raw = fs.readFileSync(path.join(pidDir, file), 'utf8').trim();
      const pid = Number.parseInt(raw, 10);
      if (pid > 0) return pid;
    } catch {
      // ignore unreadable pid files
    }
  }
  return undefined;
}
