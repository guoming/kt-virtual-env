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

export async function ensureUserKtReady(): Promise<void> {
  ensureUserKtDirs();
  await ensurePathWritable(getUserKtDir(), '~/.kt 目录');
}
