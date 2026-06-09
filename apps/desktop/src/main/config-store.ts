import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { migrateStainUrlHistory } from '@kt-virtual-env/shared';
import { ensurePathWritable, isPathWritable } from './path-ownership.js';

export interface AppConfig {
  kubeconfig: string;
  context: string;
  /** 流量转发个人标识，x-virtual-env 为 {virtual-env}.{meshUserId} */
  meshUserId: string;
  lastStainUrl?: string;
  /** 流量染色网页地址历史，最新在前 */
  stainUrlHistory: string[];
  lastStainBaseVirtualEnv?: string;
  /** 流量染色上次使用的 x-virtual-env 输入（可为集群 base 或完整值） */
  lastStainVirtualEnv?: string;
  /** 染色窗口打开时自动打开 DevTools */
  stainDevTools: boolean;
  /** 解压后的 Chrome 扩展目录路径 */
  stainExtensionPaths: string[];
  recentNamespaces: string[];
  connectDnsNamespaces: string[];
  /** 流量转发收藏：namespace/deploymentName */
  favoriteMeshKeys: string[];
  /** 端口转发收藏：namespace/serviceName */
  favoriteForwardKeys: string[];
  /** 本地开发服务端口收藏（端口号） */
  favoriteLocalDevPorts: number[];
}

const LEGACY_CONFIG_DIR = path.join(os.homedir(), '.zt-virtual-env');

export const CONFIG_DIR = path.join(os.homedir(), '.kt-virtual-env');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function resolveConfigFile(): string {
  if (fs.existsSync(CONFIG_FILE)) return CONFIG_FILE;
  const legacyFile = path.join(LEGACY_CONFIG_DIR, 'config.json');
  if (fs.existsSync(legacyFile)) return legacyFile;
  return CONFIG_FILE;
}

function migrateLegacyConfigDir(): void {
  if (fs.existsSync(CONFIG_DIR) || !fs.existsSync(LEGACY_CONFIG_DIR)) return;
  try {
    fs.renameSync(LEGACY_CONFIG_DIR, CONFIG_DIR);
  } catch {
    // 权限或跨盘符时保留旧目录，读取走 resolveConfigFile 回退
  }
}

const DEFAULTS: AppConfig = {
  kubeconfig: path.join(os.homedir(), '.kube', 'config'),
  context: '',
  meshUserId: os.userInfo().username,
  recentNamespaces: [],
  connectDnsNamespaces: [],
  favoriteMeshKeys: [],
  favoriteForwardKeys: [],
  favoriteLocalDevPorts: [],
  stainUrlHistory: [],
  stainDevTools: false,
  stainExtensionPaths: [],
};

function readConfigFile(): Partial<AppConfig> {
  try {
    return JSON.parse(fs.readFileSync(resolveConfigFile(), 'utf8')) as Partial<AppConfig>;
  } catch {
    return {};
  }
}

export function isConfigWritable(): boolean {
  return isPathWritable(CONFIG_DIR);
}

export async function ensureConfigReady(): Promise<void> {
  migrateLegacyConfigDir();
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  } catch {
    // 目录可能被 root 创建，mkdir 会失败
  }
  await ensurePathWritable(CONFIG_DIR, '应用配置目录');
}

export function loadConfig(): AppConfig {
  const raw = readConfigFile();
  const stainUrlHistory = migrateStainUrlHistory(raw.stainUrlHistory, raw.lastStainUrl);
  return { ...DEFAULTS, ...raw, stainUrlHistory };
}

export async function saveConfig(cfg: Partial<AppConfig>): Promise<AppConfig> {
  await ensureConfigReady();
  const merged = { ...loadConfig(), ...cfg };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), { mode: 0o600 });
  return merged;
}

export function getLogDir(): string {
  const dir = path.join(CONFIG_DIR, 'logs');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}
