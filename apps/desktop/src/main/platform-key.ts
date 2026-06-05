// [AI-GEN] scope:platform-key, model:auto, reviewed:false
import path from 'node:path';

export function platformKey(platform: string, arch: string): string {
  if (platform === 'darwin') {
    return arch === 'arm64' ? 'darwin-arm64' : 'darwin-amd64';
  }
  if (platform === 'win32') {
    return 'windows-amd64';
  }
  throw new Error(`Unsupported platform: ${platform}-${arch}`);
}

export function resolveBinaryRelPath(baseName: string, platform: string, arch: string): string {
  const key = platformKey(platform, arch);
  return path.join(key, baseName);
}
// [/AI-GEN]

export function resolveBinaryName(base: string, platform: string, arch: string): string {
  return resolveBinaryRelPath(base, platform, arch);
}
