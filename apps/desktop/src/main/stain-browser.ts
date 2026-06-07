// [AI-GEN] scope:stain-browser, model:auto, reviewed:false
import { createHash, randomUUID } from 'node:crypto';
import { BrowserWindow, session, type Session } from 'electron';
import { loadStainExtensions } from './stain-extensions.js';

export const STAIN_HEADER = 'x-virtual-env';

export interface StainBrowserInfo {
  id: string;
  url: string;
  virtualEnv: string;
  title: string;
}

export interface StainOpenOptions {
  devTools?: boolean;
  extensionPaths?: string[];
}

interface StainEntry {
  win: BrowserWindow;
  url: string;
  virtualEnv: string;
}

const stainBrowsers = new Map<string, StainEntry>();
/** 已注入请求头/扩展的持久化 session，避免重复注册监听器 */
const preparedPartitions = new Set<string>();

/** 扩展列表变更后调用，使新扩展在下次打开染色窗口时生效 */
export function resetPreparedStainSessions(): void {
  preparedPartitions.clear();
}

export function buildStainSessionPartition(normalizedUrl: string, virtualEnv: string): string {
  let origin: string;
  try {
    origin = new URL(normalizedUrl).origin;
  } catch {
    origin = normalizedUrl;
  }
  const hash = createHash('sha256')
    .update(`${origin}\0${virtualEnv}`)
    .digest('hex')
    .slice(0, 16);
  return `persist:stain-${hash}`;
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return trimmed;
}

async function prepareStainSession(
  ses: Session,
  virtualEnv: string,
  extensionPaths: string[],
): Promise<string | undefined> {
  ses.webRequest.onBeforeSendHeaders({ urls: ['<all_urls>'] }, (details, callback) => {
    const requestHeaders = { ...details.requestHeaders, [STAIN_HEADER]: virtualEnv };
    callback({ requestHeaders });
  });

  if (extensionPaths.length === 0) return undefined;

  const result = await loadStainExtensions(ses, extensionPaths);
  if (result.failed.length > 0) {
    const detail = result.failed.map((f) => `${f.path}: ${f.error}`).join('; ');
    if (result.loaded.length === 0) {
      return `扩展加载失败：${detail}`;
    }
    return `部分扩展加载失败：${detail}`;
  }
  return undefined;
}

async function ensureStainSession(
  partition: string,
  virtualEnv: string,
  extensionPaths: string[],
): Promise<{ ses: Session; warning?: string }> {
  const ses = session.fromPartition(partition);
  if (preparedPartitions.has(partition)) {
    return { ses };
  }
  const warning = await prepareStainSession(ses, virtualEnv, extensionPaths);
  preparedPartitions.add(partition);
  return { ses, warning };
}

export async function openStainBrowser(
  url: string,
  virtualEnv: string,
  options: StainOpenOptions = {},
): Promise<{ id: string; warning?: string }> {
  const id = randomUUID();
  const normalizedUrl = normalizeUrl(url);
  const value = virtualEnv.trim();
  if (!value) {
    throw new Error('x-virtual-env 值不能为空');
  }

  const extensionPaths = options.extensionPaths ?? [];
  const partition = buildStainSessionPartition(normalizedUrl, value);
  const { ses, warning: extensionWarning } = await ensureStainSession(
    partition,
    value,
    extensionPaths,
  );

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: `流量染色 · ${value}`,
    webPreferences: {
      session: ses,
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true,
    },
  });

  const entry: StainEntry = { win, url: normalizedUrl, virtualEnv: value };
  stainBrowsers.set(id, entry);

  win.on('page-title-updated', (_e, title) => {
    if (win.isDestroyed()) return;
    win.setTitle(`流量染色 · ${value}${title ? ` · ${title}` : ''}`);
  });
  win.on('closed', () => {
    stainBrowsers.delete(id);
  });

  win.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      if (win.webContents.isDevToolsOpened()) {
        win.webContents.closeDevTools();
      } else {
        win.webContents.openDevTools({ mode: 'bottom' });
      }
    }
  });

  if (options.devTools) {
    win.webContents.openDevTools({ mode: 'bottom' });
  }

  await win.loadURL(normalizedUrl);
  return { id, warning: extensionWarning };
}

export function listStainBrowsers(): StainBrowserInfo[] {
  return [...stainBrowsers.entries()].map(([id, entry]) => ({
    id,
    url: entry.url,
    virtualEnv: entry.virtualEnv,
    title: entry.win.isDestroyed() ? '（已关闭）' : entry.win.getTitle(),
  }));
}

export function closeStainBrowser(id: string): void {
  stainBrowsers.get(id)?.win.close();
}

export function closeAllStainBrowsers(): void {
  for (const entry of stainBrowsers.values()) {
    if (!entry.win.isDestroyed()) entry.win.close();
  }
}

export function focusStainBrowser(id: string): void {
  const entry = stainBrowsers.get(id);
  if (!entry || entry.win.isDestroyed()) return;
  if (entry.win.isMinimized()) entry.win.restore();
  entry.win.focus();
}

export function toggleStainBrowserDevTools(id: string): void {
  const entry = stainBrowsers.get(id);
  if (!entry || entry.win.isDestroyed()) return;
  if (entry.win.webContents.isDevToolsOpened()) {
    entry.win.webContents.closeDevTools();
  } else {
    entry.win.webContents.openDevTools({ mode: 'bottom' });
  }
}
// [/AI-GEN]
