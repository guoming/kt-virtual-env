import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function runOsascriptElevated(shellCmd: string): Promise<void> {
  const script = `do shell script "${shellCmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}" with administrator privileges`;
  return new Promise((resolve, reject) => {
    const child = spawn('osascript', ['-e', script]);
    let err = '';
    child.stderr.on('data', (d) => {
      err += d.toString();
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(err.trim() || `osascript 退出码 ${code}`));
    });
  });
}

// [AI-GEN] scope:path-ownership, model:auto, reviewed:false
export function isPathWritable(targetPath: string): boolean {
  try {
    if (!fs.existsSync(targetPath)) {
      return false;
    }
    fs.accessSync(targetPath, fs.constants.W_OK);
    const probe = path.join(targetPath, `.ktve-probe-${process.pid}`);
    fs.writeFileSync(probe, '');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

export async function repairPathOwnership(targetPath: string): Promise<void> {
  if (!fs.existsSync(targetPath)) return;

  if (process.platform === 'darwin') {
    const user = os.userInfo().username;
    const quoted = shellQuote(targetPath);
    await runOsascriptElevated(
      `chown -R ${user}:staff ${quoted} && chmod -R u+rwX ${quoted}`,
    );
    return;
  }
  if (process.platform === 'win32') {
    throw new Error(`${targetPath} 权限异常，请以管理员身份修复该目录权限`);
  }
  throw new Error(`${targetPath} 权限异常，请执行: sudo chown -R $(whoami) ${targetPath}`);
}

export async function ensurePathWritable(targetPath: string, label: string): Promise<void> {
  if (isPathWritable(targetPath)) return;
  await repairPathOwnership(targetPath);
  if (!isPathWritable(targetPath)) {
    throw new Error(`无法写入 ${label}（${targetPath}），请检查目录权限`);
  }
}
// [/AI-GEN]
