// [AI-GEN] scope:stain-extension-store, model:auto, reviewed:false
import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { CONFIG_DIR } from './config-store.js';
import {
  defaultChromeExtensionsDir,
  isValidExtensionDir,
  readExtensionName,
} from './stain-extensions.js';

export const CHROME_WEB_STORE_HOME = 'https://chromewebstore.google.com/';
const CHROME_EXTENSION_ID_RE = /^[a-p]{32}$/i;
const CRX_MAGIC = 0x34327243; // "Cr24"
const ZIP_MAGIC = 0x4b50; // "PK"
const CHROME_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const DOWNLOAD_TIMEOUT_MS = 60_000;

export const STAIN_EXTENSIONS_DIR = path.join(CONFIG_DIR, 'stain-extensions');
const DOWNLOAD_FAILED_HINT =
  '无法连接 Chrome 扩展下载服务。可配置系统代理/VPN 后重试，或使用「从本机 Chrome 导入」/「导入 CRX 文件」。';

export interface InstalledChromeExtension {
  id: string;
  name: string;
  version: string;
  path: string;
}

export function parseChromeExtensionId(input: string): string | null {
  const trimmed = input.trim();
  if (CHROME_EXTENSION_ID_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && CHROME_EXTENSION_ID_RE.test(last)) {
      return last.toLowerCase();
    }
  } catch {
    // 非 URL 输入
  }
  return null;
}

export function extractZipFromCrx(crx: Buffer): Buffer {
  if (crx.length < 12) {
    throw new Error('CRX 文件无效');
  }
  if (crx.readUInt32LE(0) !== CRX_MAGIC) {
    throw new Error('CRX 文件格式不正确');
  }
  const version = crx.readUInt32LE(4);
  let zipStart = 0;
  if (version === 2) {
    const pubKeyLength = crx.readUInt32LE(8);
    const sigLength = crx.readUInt32LE(12);
    zipStart = 16 + pubKeyLength + sigLength;
  } else if (version === 3) {
    const headerSize = crx.readUInt32LE(8);
    zipStart = 12 + headerSize;
  } else {
    throw new Error(`不支持的 CRX 版本：${version}`);
  }
  const zip = crx.subarray(zipStart);
  if (zip.length < 4 || zip[0] !== 0x50 || zip[1] !== 0x4b) {
    throw new Error('CRX 内未找到有效的 ZIP 数据');
  }
  return zip;
}

function extractZipToDir(zipBuffer: Buffer, destDir: string): void {
  const zip = new AdmZip(zipBuffer);
  zip.extractAllTo(destDir, true);
}

function buildCrxDownloadUrls(extensionId: string): string[] {
  const x = `id=${extensionId}&installsource=ondemand&uc`;
  const params = new URLSearchParams({
    response: 'redirect',
    prodversion: '131.0.6778.0',
    acceptformat: 'crx2,crx3',
    x,
  });
  return [
    `https://clients2.google.com/service/update2/crx?${params.toString()}`,
    `https://crx.dam.io/${extensionId}.crx`,
  ];
}

function isLikelyExtensionArchive(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  if (buffer.readUInt32LE(0) === CRX_MAGIC) return true;
  return buffer.readUInt16LE(0) === ZIP_MAGIC;
}

function formatDownloadError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const code = err instanceof Error ? (err as NodeJS.ErrnoException).code : undefined;
  if (
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    /timeout|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|fetch failed/i.test(message)
  ) {
    return DOWNLOAD_FAILED_HINT;
  }
  return message;
}

/** 使用 Chromium 网络栈下载，自动走系统代理 */
async function downloadWithNet(url: string, redirectsLeft = 5): Promise<Buffer> {
  const { net } = await import('electron');
  return new Promise((resolve, reject) => {
    const request = net.request({ method: 'GET', url });
    const timer = setTimeout(() => {
      request.abort();
      reject(new Error(DOWNLOAD_FAILED_HINT));
    }, DOWNLOAD_TIMEOUT_MS);

    request.setHeader('User-Agent', CHROME_USER_AGENT);

    request.on('response', (response) => {
      const status = response.statusCode ?? 0;
      const location = response.headers.location;
      const redirectUrl = Array.isArray(location) ? location[0] : location;

      if (status >= 300 && status < 400 && redirectUrl && redirectsLeft > 0) {
        clearTimeout(timer);
        const nextUrl = redirectUrl.startsWith('http')
          ? redirectUrl
          : new URL(redirectUrl, url).href;
        downloadWithNet(nextUrl, redirectsLeft - 1).then(resolve).catch(reject);
        return;
      }

      if (status >= 400) {
        clearTimeout(timer);
        reject(new Error(`下载扩展失败（HTTP ${status}）`));
        return;
      }

      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => {
        clearTimeout(timer);
        resolve(Buffer.concat(chunks));
      });
      response.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    request.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    request.end();
  });
}

async function downloadCrx(extensionId: string): Promise<Buffer> {
  const errors: string[] = [];
  for (const url of buildCrxDownloadUrls(extensionId)) {
    try {
      const buffer = await downloadWithNet(url);
      if (!isLikelyExtensionArchive(buffer)) {
        errors.push(`${url}: 内容无效`);
        continue;
      }
      return buffer;
    } catch (err) {
      errors.push(`${url}: ${formatDownloadError(err)}`);
    }
  }
  throw new Error(errors[errors.length - 1] ?? DOWNLOAD_FAILED_HINT);
}

function readExtensionVersion(extDir: string): string {
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'),
    ) as { version?: string };
    return manifest.version?.trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

function copyExtensionDir(srcDir: string, destDir: string): void {
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.cpSync(srcDir, destDir, { recursive: true });
}

function installExtensionToDir(
  extensionId: string,
  destDir: string,
  source: 'store' | 'local-chrome' | 'crx-file',
): InstalledChromeExtension {
  if (!isValidExtensionDir(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
    throw new Error('扩展无效，可能该扩展不支持自动安装');
  }
  const installed: InstalledChromeExtension = {
    id: extensionId,
    name: readExtensionName(destDir),
    version: readExtensionVersion(destDir),
    path: destDir,
  };
  if (source === 'local-chrome') {
    installed.name = `${installed.name}（本机 Chrome）`;
  }
  return installed;
}

function unpackCrxToDir(crx: Buffer, destDir: string): void {
  const zip = crx.readUInt32LE(0) === CRX_MAGIC ? extractZipFromCrx(crx) : crx;
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true, mode: 0o700 });
  extractZipToDir(zip, destDir);
}

export function findLocalChromeExtension(extensionId: string): InstalledChromeExtension | null {
  const baseDir = defaultChromeExtensionsDir();
  if (!baseDir) return null;
  const idDir = path.join(baseDir, extensionId);
  if (!fs.existsSync(idDir) || !fs.statSync(idDir).isDirectory()) return null;

  const versions = fs
    .readdirSync(idDir)
    .filter((entry) => {
      const entryPath = path.join(idDir, entry);
      return fs.statSync(entryPath).isDirectory() && isValidExtensionDir(entryPath);
    })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const version = versions[versions.length - 1];
  if (!version) return null;

  const extPath = path.join(idDir, version);
  return {
    id: extensionId,
    name: readExtensionName(extPath),
    version,
    path: extPath,
  };
}

export async function installExtensionFromChromeWebStore(
  input: string,
): Promise<InstalledChromeExtension> {
  const extensionId = parseChromeExtensionId(input);
  if (!extensionId) {
    throw new Error('无法识别 Chrome 扩展 ID 或网上应用店链接');
  }

  fs.mkdirSync(STAIN_EXTENSIONS_DIR, { recursive: true, mode: 0o700 });
  const destDir = path.join(STAIN_EXTENSIONS_DIR, extensionId);

  try {
    const crx = await downloadCrx(extensionId);
    unpackCrxToDir(crx, destDir);
    return installExtensionToDir(extensionId, destDir, 'store');
  } catch (downloadErr) {
    const local = findLocalChromeExtension(extensionId);
    if (local) {
      copyExtensionDir(local.path, destDir);
      return installExtensionToDir(extensionId, destDir, 'local-chrome');
    }
    throw new Error(formatDownloadError(downloadErr));
  }
}

export async function installExtensionFromCrxFile(
  crxPath: string,
  extensionIdHint?: string,
): Promise<InstalledChromeExtension> {
  const crx = fs.readFileSync(crxPath);
  if (!isLikelyExtensionArchive(crx)) {
    throw new Error('文件不是有效的 CRX/ZIP 扩展包');
  }

  const extensionId =
    extensionIdHint && parseChromeExtensionId(extensionIdHint)
      ? parseChromeExtensionId(extensionIdHint)!
      : `imported-${path.basename(crxPath, path.extname(crxPath)).replace(/[^a-z0-9_-]/gi, '')}`;

  fs.mkdirSync(STAIN_EXTENSIONS_DIR, { recursive: true, mode: 0o700 });
  const destDir = path.join(STAIN_EXTENSIONS_DIR, extensionId);
  unpackCrxToDir(crx, destDir);
  return installExtensionToDir(extensionId, destDir, 'crx-file');
}

export function listLocalChromeExtensions(): InstalledChromeExtension[] {
  const baseDir = defaultChromeExtensionsDir();
  if (!baseDir || !fs.existsSync(baseDir)) return [];

  const results: InstalledChromeExtension[] = [];
  for (const id of fs.readdirSync(baseDir)) {
    const local = findLocalChromeExtension(id);
    if (local) results.push(local);
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}
// [/AI-GEN]
