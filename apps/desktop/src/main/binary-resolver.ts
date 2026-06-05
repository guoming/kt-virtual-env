import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
import { resolveBinaryRelPath } from './platform-key.js';

export function getBundledBinary(baseName: 'ktctl' | 'kubectl'): string {
  const ext = process.platform === 'win32' ? '.exe' : '';
  const name = baseName + ext;
  const rel = resolveBinaryRelPath(name, process.platform, process.arch);
  const candidates = [
    path.join(process.resourcesPath, 'bin', rel),
    path.join(app.getAppPath(), '../../resources/bin', rel),
    path.join(process.cwd(), '../../resources/bin', rel),
    path.join(process.cwd(), 'resources/bin', rel),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(`未找到内嵌二进制: ${name}`);
}

export function getHelperPath(): string {
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  const name =
    process.platform === 'win32'
      ? 'helper-windows-amd64.exe'
      : `helper-darwin-${arch}`;
  const prod = path.join(process.resourcesPath, 'helper', name);
  if (app.isPackaged && fs.existsSync(prod)) {
    return prod;
  }
  const dev = path.join(app.getAppPath(), 'resources/helper', name);
  if (fs.existsSync(dev)) {
    return dev;
  }
  throw new Error(`未找到 Helper: ${name}`);
}
