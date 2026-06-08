import { describe, expect, it } from 'vitest';
import { formatUpdateErrorMessage } from './update.js';

describe('formatUpdateErrorMessage', () => {
  it('shortens electron-updater HttpError dump', () => {
    const raw = `504

method: GET url: https://github.com/guoming/kt-virtual-env/releases.atom
headers: { 'cache-control': 'no-cache', 'set-cookie': '_gh_sess=abc' }
body: <html><body><h1>504 Gateway Time-out</h1></body></html>`;
    expect(formatUpdateErrorMessage(raw)).toBe('无法连接更新服务器，请检查网络后重试');
  });

  it('handles rate limiting', () => {
    expect(formatUpdateErrorMessage('429 rate limit exceeded')).toMatch(/过于频繁/);
  });

  it('keeps short actionable messages', () => {
    expect(formatUpdateErrorMessage('No published versions')).toBe('No published versions');
  });
});
