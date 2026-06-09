import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR } from './config-store.js';
import { appendHelperLauncherLog, getHelperLogPath } from './helper-log.js';
import { getHelperSocketPath, isTcpHelperEndpoint } from './helper-socket.js';
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

/** Go flag 须用 -socket= 形式，避免 RunAs 下参数被合并 */
export function buildWindowsElevatedLaunchScript(
  helper: string,
  socketPath: string,
  logPath: string,
): string {
  const helperEsc = helper.replace(/'/g, "''");
  const logEsc = logPath.replace(/'/g, "''");
  const socketArg = `-socket=${socketPath.replace(/'/g, "''")}`;
  const logArg = `-log=${logEsc}`;
  return `
$ErrorActionPreference = 'Continue'
$log = '${logEsc}'
function Write-HelperLog([string]$Message) {
  Add-Content -LiteralPath $log -Value "$(Get-Date -Format o) [launcher] $Message"
}
try {
  Write-HelperLog "requesting elevation"
  Write-HelperLog "helper=${helperEsc}"
  Write-HelperLog "socket=${socketPath.replace(/'/g, "''")}"
  $helperArgs = @('${socketArg}','${logArg}')
  Start-Process -FilePath '${helperEsc}' -ArgumentList $helperArgs -Verb RunAs -WindowStyle Hidden
  Write-HelperLog "Start-Process invoked"
} catch {
  Write-HelperLog "Start-Process failed: $($_.Exception.Message)"
  exit 1
}
`.trim();
}

/** @deprecated use buildWindowsElevatedLaunchScript; kept for unit tests */
export function buildWindowsElevatedLaunchCommand(
  helper: string,
  socketPath: string,
  logPath = getHelperLogPath(),
): string {
  const escapedHelper = helper.replace(/'/g, "''");
  const socketArg = `-socket=${socketPath.replace(/'/g, "''")}`;
  const logArg = `-log=${logPath.replace(/'/g, "''")}`;
  return `$p='${escapedHelper}'; Start-Process -FilePath $p -Verb RunAs -WindowStyle Hidden -ArgumentList '${socketArg}','${logArg}'`;
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

async function stopExistingHelper(): Promise<void> {
  try {
    const client = new HelperClient();
    await client.connect(800);
    client.send({ cmd: 'shutdown' });
    client.close();
    await new Promise((r) => setTimeout(r, 400));
  } catch {
    // no running helper
  }
}

async function launchHelperWindowsElevated(helper: string, socketPath: string): Promise<void> {
  const logPath = getHelperLogPath();
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  appendHelperLauncherLog(`prepare elevate helper=${helper} socket=${socketPath}`);

  const scriptPath = path.join(CONFIG_DIR, 'launch-helper.ps1');
  fs.writeFileSync(scriptPath, buildWindowsElevatedLaunchScript(helper, socketPath, logPath), 'utf8');

  const powershell = resolvePowershellPath();
  appendHelperLauncherLog(`spawn powershell script=${scriptPath}`);
  await spawnDetached(powershell, [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
  ]);
}

export async function launchHelperElevated(): Promise<void> {
  const helper = getHelperPath();
  if (!fs.existsSync(helper)) {
    throw new Error(`Helper 不存在: ${helper}`);
  }

  const socketPath = getHelperSocketPath();
  const logPath = getHelperLogPath();

  if (!isTcpHelperEndpoint(socketPath)) {
    try {
      fs.unlinkSync(socketPath);
    } catch {
      // ignore missing socket
    }
  }

  await stopExistingHelper();

  if (process.platform === 'darwin') {
    const cmd = `export KTVE_HELPER_SOCKET=${shellQuote(socketPath)}; ${shellQuote(helper)} -log ${shellQuote(logPath)} </dev/null >>${shellQuote(logPath)} 2>&1 &`;
    const script = `do shell script "${cmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}" with administrator privileges`;
    appendHelperLauncherLog(`macos osascript elevate socket=${socketPath}`);
    await spawnDetached('osascript', ['-e', script]);
  } else if (process.platform === 'win32') {
    await launchHelperWindowsElevated(helper, socketPath);
  } else {
    throw new Error('不支持的平台');
  }

  await waitForHelper(45_000);
}

async function waitForHelper(timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isHelperRunning()) {
      appendHelperLauncherLog('helper ping ok');
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  appendHelperLauncherLog('helper start timeout');
  const logHint = `日志: ${getHelperLogPath()}；若未出现 UAC 弹窗，请检查是否被其他窗口遮挡`;
  throw new Error(`Helper 启动超时，请检查管理员授权。${logHint}，socket: ${getHelperSocketPath()}`);
}
