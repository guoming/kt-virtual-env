import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { CONFIG_DIR } from './config-store.js';
import { appendHelperLauncherLog, getHelperLogPath } from './helper-log.js';
import { getHelperSocketPath, isTcpHelperEndpoint } from './helper-socket.js';
import { getHelperPath } from './binary-resolver.js';
import { HelperClient } from './helper-client.js';
import { resolvePowershellPath } from './powershell-path.js';
import { encodePowerShellCommand, isWindowsProcessElevated } from './windows-elevation.js';

const HELPER_CONNECT_TIMEOUT_MS = 3000;
const HELPER_PING_TIMEOUT_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function isHelperRunning(): Promise<boolean> {
  try {
    const client = new HelperClient();
    await client.connect(HELPER_CONNECT_TIMEOUT_MS);
    const pong = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), HELPER_PING_TIMEOUT_MS);
      client.onMessage((msg) => {
        if (msg.event === 'pong') {
          clearTimeout(timer);
          resolve(true);
        }
      });
      client.send({ cmd: 'ping' });
    });
    client.close();
    return pong;
  } catch {
    return false;
  }
}

/** 多次探测，避免 Helper 繁忙时误判为未运行而重复弹授权窗 */
async function probeHelperRunning(attempts = 3, intervalMs = 400): Promise<boolean> {
  for (let i = 0; i < attempts; i += 1) {
    if (await isHelperRunning()) return true;
    if (i < attempts - 1) await sleep(intervalMs);
  }
  return false;
}

let launchInFlight: Promise<void> | null = null;

/** 确保 Helper 已运行；已授权则不再弹窗 */
export async function ensureHelperRunning(): Promise<void> {
  if (await probeHelperRunning()) return;
  await launchHelperElevated();
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

function spawnDetached(command: string, args: string[], logFd?: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: logFd === undefined ? 'ignore' : ['ignore', logFd, logFd],
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

function spawnHelperDirect(helper: string, socketPath: string, logPath: string): void {
  const args = [`-socket=${socketPath}`, `-log=${logPath}`];
  appendHelperLauncherLog(`direct start helper args=${args.join(' ')}`);
  const child = spawn(helper, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
}

async function probeHelperEndpoint(endpoint: string): Promise<string> {
  if (!endpoint.startsWith('tcp:')) return 'non-tcp endpoint';
  const [host, portRaw] = endpoint.slice(4).split(':');
  const port = Number(portRaw);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('tcp connect timeout'), 2000);
    const conn = net.createConnection({ host, port }, () => {
      clearTimeout(timer);
      conn.destroy();
      resolve('tcp port open');
    });
    conn.on('error', (err) => {
      clearTimeout(timer);
      resolve(`tcp connect error: ${err.message}`);
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

  if (isWindowsProcessElevated()) {
    appendHelperLauncherLog('process already elevated, skip RunAs');
    spawnHelperDirect(helper, socketPath, logPath);
    return;
  }

  const script = buildWindowsElevatedLaunchScript(helper, socketPath, logPath);
  const scriptPath = path.join(CONFIG_DIR, 'launch-helper.ps1');
  fs.writeFileSync(scriptPath, `\uFEFF${script}`, 'utf8');

  const powershell = resolvePowershellPath();
  const encoded = encodePowerShellCommand(script);
  const psLogPath = path.join(CONFIG_DIR, 'launch-helper-ps.log');
  const psLogFd = fs.openSync(psLogPath, 'a');
  fs.writeSync(psLogFd, `\n--- ${new Date().toISOString()} powershell=${powershell} ---\n`);

  appendHelperLauncherLog(
    `spawn powershell exe=${powershell} encoded=${encoded.length} script=${scriptPath}`,
  );

  try {
    await spawnDetached(powershell, ['-NoProfile', '-EncodedCommand', encoded], psLogFd);
  } finally {
    fs.closeSync(psLogFd);
  }
}

export async function launchHelperElevated(): Promise<void> {
  if (await probeHelperRunning(2)) {
    appendHelperLauncherLog('helper already running, skip elevate');
    return;
  }
  if (launchInFlight) {
    appendHelperLauncherLog('helper launch already in flight, waiting');
    await launchInFlight;
    if (await probeHelperRunning(2)) return;
    throw new Error('Helper 启动失败，请稍后在配置页重新授权');
  }

  launchInFlight = launchHelperElevatedInner();
  try {
    await launchInFlight;
  } finally {
    launchInFlight = null;
  }
}

async function launchHelperElevatedInner(): Promise<void> {
  if (await probeHelperRunning(1)) {
    appendHelperLauncherLog('helper became ready before elevate');
    return;
  }

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

  const socketPath = getHelperSocketPath();
  const probe = await probeHelperEndpoint(socketPath);
  let helperProc = 'unknown';
  if (process.platform === 'win32') {
    try {
      const out = execFileSync('tasklist', ['/FI', 'IMAGENAME eq helper-windows-amd64.exe', '/NH'], {
        windowsHide: true,
        encoding: 'utf8',
        timeout: 5000,
      });
      helperProc = out.trim() || 'not found';
    } catch (err) {
      helperProc = err instanceof Error ? err.message : 'tasklist failed';
    }
  }

  appendHelperLauncherLog(`helper start timeout probe=${probe} tasklist=${helperProc}`);
  const logHint = `日志: ${getHelperLogPath()}；PowerShell 输出: ${path.join(CONFIG_DIR, 'launch-helper-ps.log')}`;
  throw new Error(
    `Helper 启动超时，请检查管理员授权或杀软拦截。${logHint}，socket: ${socketPath}，${probe}`,
  );
}
