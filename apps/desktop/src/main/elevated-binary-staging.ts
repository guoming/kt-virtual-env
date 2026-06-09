import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runtimeUserKey } from './runtime-user-key.js';

function stagingPath(name: string): string {
  return path.join(os.tmpdir(), `kt-virtual-env-${name}-${runtimeUserKey()}`);
}

/** root 进程无法读取用户主目录下的文件，复制 kubeconfig 到临时目录 */
export function stageKubeconfigForElevated(sourcePath: string): string {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`kubeconfig 不存在: ${sourcePath}`);
  }
  const dest = stagingPath('kubeconfig');
  fs.copyFileSync(sourcePath, dest);
  fs.chmodSync(dest, 0o644);
  return dest;
}

/** 复制 ktctl 到临时目录；Windows 须保留 .exe 后缀 */
export function stageKtctlForElevated(sourcePath: string): string {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`ktctl 不存在: ${sourcePath}`);
  }
  const ext = path.extname(sourcePath);
  const dest = path.join(os.tmpdir(), `kt-virtual-env-ktctl-${runtimeUserKey()}${ext}`);
  fs.copyFileSync(sourcePath, dest);
  if (process.platform !== 'win32') {
    fs.chmodSync(dest, 0o755);
  }
  return dest;
}
