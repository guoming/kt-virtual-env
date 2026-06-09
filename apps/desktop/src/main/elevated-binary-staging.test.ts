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
    const source = path.join(os.tmpdir(), `ktve-src-${process.pid}.exe`);
    fs.writeFileSync(source, 'fake');
    tmpFiles.push(source);

    const staged = stageKtctlForElevated(source);
    tmpFiles.push(staged);

    expect(staged.endsWith('.exe')).toBe(true);
    expect(fs.existsSync(staged)).toBe(true);
  });
});
