import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isValidExtensionDir, readExtensionName } from './stain-extensions.js';

describe('stain extensions', () => {
  it('detects manifest.json in directory', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ktve-ext-'));
    try {
      expect(isValidExtensionDir(dir)).toBe(false);
      fs.writeFileSync(path.join(dir, 'manifest.json'), '{"name":"Test Ext"}');
      expect(isValidExtensionDir(dir)).toBe(true);
      expect(readExtensionName(dir)).toBe('Test Ext');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
