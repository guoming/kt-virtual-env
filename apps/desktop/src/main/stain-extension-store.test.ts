import AdmZip from 'adm-zip';
import { describe, expect, it } from 'vitest';
import { extractZipFromCrx, parseChromeExtensionId } from './stain-extension-store.js';

function buildCrx3(zipBuffer: Buffer): Buffer {
  const header = Buffer.from([0x08, 0x03]);
  const version = Buffer.alloc(4);
  version.writeUInt32LE(3, 0);
  const headerSize = Buffer.alloc(4);
  headerSize.writeUInt32LE(header.length, 0);
  return Buffer.concat([Buffer.from('Cr24'), version, headerSize, header, zipBuffer]);
}

describe('parseChromeExtensionId', () => {
  const id = 'idgpnmonknjnojddfkpgkljpfnnfcklj';

  it('解析纯扩展 ID', () => {
    expect(parseChromeExtensionId(id)).toBe(id);
  });

  it('解析旧版网上应用店链接', () => {
    expect(
      parseChromeExtensionId(`https://chrome.google.com/webstore/detail/modheader/${id}`),
    ).toBe(id);
  });

  it('解析新版网上应用店链接', () => {
    expect(
      parseChromeExtensionId(`https://chromewebstore.google.com/detail/modheader/${id}`),
    ).toBe(id);
  });

  it('无法识别时返回 null', () => {
    expect(parseChromeExtensionId('not-an-extension')).toBeNull();
  });
});

describe('extractZipFromCrx', () => {
  it('从 CRX3 提取 ZIP', () => {
    const zip = new AdmZip();
    zip.addFile('manifest.json', Buffer.from('{"name":"Test"}'));
    const crx = buildCrx3(zip.toBuffer());
    const extracted = extractZipFromCrx(crx);
    const out = new AdmZip(extracted);
    expect(out.getEntry('manifest.json')?.getData().toString()).toBe('{"name":"Test"}');
  });
});
