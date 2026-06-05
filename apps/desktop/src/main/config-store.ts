import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface AppConfig {
  kubeconfig: string;
  context: string;
  recentNamespaces: string[];
  connectDnsNamespaces: string[];
}

const CONFIG_DIR = path.join(os.homedir(), '.zt-virtual-env');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULTS: AppConfig = {
  kubeconfig: path.join(os.homedir(), '.kube', 'config'),
  context: '',
  recentNamespaces: [],
  connectDnsNamespaces: [],
};

export function loadConfig(): AppConfig {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveConfig(cfg: Partial<AppConfig>): AppConfig {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const merged = { ...loadConfig(), ...cfg };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
  return merged;
}

export function getLogDir(): string {
  const dir = path.join(CONFIG_DIR, 'logs');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
