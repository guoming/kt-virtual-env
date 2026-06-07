import { describe, expect, it } from 'vitest';
import { buildStainSessionPartition } from './stain-browser.js';

describe('buildStainSessionPartition', () => {
  it('同一站点与 virtual-env 复用同一 partition', () => {
    const a = buildStainSessionPartition('https://example.com/path', 'dev.v1.user1');
    const b = buildStainSessionPartition('https://example.com/other', 'dev.v1.user1');
    expect(a).toBe(b);
    expect(a).toMatch(/^persist:stain-[a-f0-9]{16}$/);
  });

  it('不同 virtual-env 使用不同 partition', () => {
    const a = buildStainSessionPartition('https://example.com', 'dev.v1.user1');
    const b = buildStainSessionPartition('https://example.com', 'dev.v1.user2');
    expect(a).not.toBe(b);
  });

  it('不同站点使用不同 partition', () => {
    const a = buildStainSessionPartition('https://a.example.com', 'dev.v1.user1');
    const b = buildStainSessionPartition('https://b.example.com', 'dev.v1.user1');
    expect(a).not.toBe(b);
  });
});
