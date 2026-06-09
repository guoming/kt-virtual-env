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

  it('explains unsigned macOS auto-update failure', () => {
    const raw =
      'Code signature at URL file:///Users/dev/Library/Caches/com.kt.virtualenv.ShipIt/update/kt-virtual-env.app/ did not pass validation: 代码对象根本未签名';
    expect(formatUpdateErrorMessage(raw)).toMatch(/未进行 Apple 代码签名/);
    expect(formatUpdateErrorMessage(raw)).toMatch(/DMG 手动安装/);
  });

  it('handles rate limiting', () => {
    expect(formatUpdateErrorMessage('429 rate limit exceeded')).toMatch(/过于频繁/);
  });

  it('keeps short actionable messages', () => {
    expect(formatUpdateErrorMessage('No published versions')).toBe('No published versions');
  });
});
