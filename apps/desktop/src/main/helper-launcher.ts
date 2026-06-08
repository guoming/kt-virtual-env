import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { getHelperSocketPath } from './helper-socket.js';
import { getHelperPath } from './binary-resolver.js';
import { HelperClient } from './helper-client.js';
import { resolvePowershellPath } from './powershell-path.js';

export async function isHelperRunning(): Promise<boolean> {
  try {
    const client = new HelperClient();
    await client.connect(1000);
    client.send({ cmd: 'ping' });
    client.close();
    return true;
  } catch {
    return false;
  }
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function spawnDetached(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

export async function launchHelperElevated(): Promise<void> {
  const helper = getHelperPath();
  if (!fs.existsSync(helper)) {
    throw new Error(`Helper 不存在: ${helper}`);
  }

  const socketPath = getHelperSocketPath();
  try {
    fs.unlinkSync(socketPath);
  } catch {
    // ignore missing socket
  }

  if (process.platform === 'darwin') {
    // 须后台运行 (&)，且 socket 路径通过环境变量传入（root 下 ~ 不是当前用户目录）
    const cmd = `export KTVE_HELPER_SOCKET=${shellQuote(socketPath)}; ${shellQuote(helper)} </dev/null >/tmp/kt-virtual-env-helper.log 2>&1 &`;
    const script = `do shell script "${cmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}" with administrator privileges`;
    await spawnDetached('osascript', ['-e', script]);
  } else if (process.platform === 'win32') {
    const powershell = resolvePowershellPath();
    await spawnDetached(powershell, [
      '-NoProfile',
      '-Command',
      `Start-Process -FilePath '${helper.replace(/'/g, "''")}' -Verb RunAs -ArgumentList '' -Environment @{KTVE_HELPER_SOCKET='${socketPath.replace(/'/g, "''")}'}`,
    ]);
  } else {
    throw new Error('不支持的平台');
  }

  await waitForHelper(30_000);
}

async function waitForHelper(timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isHelperRunning()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `Helper 启动超时，请检查管理员授权。日志: /tmp/kt-virtual-env-helper.log，socket: ${getHelperSocketPath()}`,
  );
}
