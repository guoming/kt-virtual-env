import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
import { resolveBinaryRelPath } from './platform-key.js';

function bundledBinaryCandidates(baseName: 'ktctl' | 'kubectl'): string[] {
  const ext = process.platform === 'win32' ? '.exe' : '';
  const name = baseName + ext;
  const rel = resolveBinaryRelPath(name, process.platform, process.arch);
  return [
    path.join(process.resourcesPath, 'bin', rel),
    path.join(app.getAppPath(), '../../resources/bin', rel),
    path.join(process.cwd(), '../../resources/bin', rel),
    path.join(process.cwd(), 'resources/bin', rel),
  ];
}

export function findBundledBinary(baseName: 'ktctl' | 'kubectl'): string | null {
  for (const candidate of bundledBinaryCandidates(baseName)) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function getBundledBinary(baseName: 'ktctl' | 'kubectl'): string {
  const found = findBundledBinary(baseName);
  if (!found) {
    const ext = process.platform === 'win32' ? '.exe' : '';
    throw new Error(`未找到内嵌二进制: ${baseName}${ext}`);
  }
  return found;
}

function helperCandidates(): string[] {
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  const name =
    process.platform === 'win32'
      ? 'helper-windows-amd64.exe'
      : `helper-darwin-${arch}`;
  return [
    path.join(process.resourcesPath, 'helper', name),
    path.join(app.getAppPath(), 'resources/helper', name),
  ];
}

export function findHelperPath(): string | null {
  for (const candidate of helperCandidates()) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function getHelperPath(): string {
  const found = findHelperPath();
  if (!found) {
    const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
    const name =
      process.platform === 'win32'
        ? 'helper-windows-amd64.exe'
        : `helper-darwin-${arch}`;
    throw new Error(`未找到 Helper: ${name}`);
  }
  return found;
}
