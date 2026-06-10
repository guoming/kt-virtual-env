import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { stageKtctlForElevated } from './elevated-binary-staging.js';

describe('stageKtctlForElevated', () => {
  const tmpFiles: string[] = [];

  afterEach(() => {
    for (const file of tmpFiles) {
      try {
        fs.unlinkSync(file);
      } catch {
        // ignore
      }
    }
    tmpFiles.length = 0;
  });

  it('preserves .exe suffix on Windows staging paths', () => {
    const sourceDir = path.join(os.tmpdir(), `ktve-src-dir-${process.pid}`);
    fs.mkdirSync(sourceDir, { recursive: true });
    const source = path.join(sourceDir, 'ktctl.exe');
    fs.writeFileSync(source, 'fake');
    tmpFiles.push(source);
    if (process.platform === 'win32') {
      const wintun = path.join(sourceDir, 'wintun.dll');
      fs.writeFileSync(wintun, 'fake-wintun');
      tmpFiles.push(wintun);
    }

    const staged = stageKtctlForElevated(source);
    tmpFiles.push(staged);

    expect(staged.endsWith('.exe')).toBe(true);
    expect(fs.existsSync(staged)).toBe(true);
  });

  it.skipIf(process.platform !== 'win32')('copies wintun.dll alongside staged ktctl on Windows', () => {
    const sourceDir = path.join(os.tmpdir(), `ktve-src-dir-${process.pid}`);
    fs.mkdirSync(sourceDir, { recursive: true });
    const source = path.join(sourceDir, 'ktctl.exe');
    const wintun = path.join(sourceDir, 'wintun.dll');
    fs.writeFileSync(source, 'fake-ktctl');
    fs.writeFileSync(wintun, 'fake-wintun');
    tmpFiles.push(source, wintun);

    const staged = stageKtctlForElevated(source);
    tmpFiles.push(staged);
    const stagedWintun = path.join(path.dirname(staged), 'wintun.dll');
    tmpFiles.push(stagedWintun);

    expect(fs.existsSync(stagedWintun)).toBe(true);
  });
});
