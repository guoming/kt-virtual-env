import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function stagingPath(name: string): string {
  const uid = typeof process.getuid === 'function' ? process.getuid() : '0';
  return path.join(os.tmpdir(), `kt-virtual-env-${name}-${uid}`);
}

/** root 进程无法读取用户主目录下的文件，复制 kubeconfig 到 /tmp */
export function stageKubeconfigForElevated(sourcePath: string): string {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`kubeconfig 不存在: ${sourcePath}`);
  }
  const dest = stagingPath('kubeconfig');
  fs.copyFileSync(sourcePath, dest);
  fs.chmodSync(dest, 0o644);
  return dest;
}

/** 复制 ktctl 到 /tmp 并赋予执行权限 */
export function stageKtctlForElevated(sourcePath: string): string {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`ktctl 不存在: ${sourcePath}`);
  }
  const dest = stagingPath('ktctl');
  fs.copyFileSync(sourcePath, dest);
  fs.chmodSync(dest, 0o755);
  return dest;
}
