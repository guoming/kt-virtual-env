import { describe, expect, it } from 'vitest';
import {
  filterStainUrlHistory,
  migrateStainUrlHistory,
  pushStainUrlHistory,
  removeStainUrlHistory,
  STAIN_URL_HISTORY_MAX,
} from './stain-url-history.js';

describe('stain url history', () => {
  it('pushes newest first and dedupes', () => {
    const next = pushStainUrlHistory(['http://a', 'http://b'], 'http://a');
    expect(next).toEqual(['http://a', 'http://b']);
  });

  it('caps history length', () => {
    const base = Array.from({ length: STAIN_URL_HISTORY_MAX }, (_, i) => `http://u${i}`);
    const next = pushStainUrlHistory(base, 'http://new');
    expect(next).toHaveLength(STAIN_URL_HISTORY_MAX);
    expect(next[0]).toBe('http://new');
  });

  it('removes one entry', () => {
    expect(removeStainUrlHistory(['http://a', 'http://b'], 'http://a')).toEqual(['http://b']);
  });

  it('migrates lastStainUrl into history', () => {
    expect(migrateStainUrlHistory(['http://a'], 'http://b')).toEqual(['http://b', 'http://a']);
  });

  it('filters by query', () => {
    const filtered = filterStainUrlHistory(
      ['http://gateway.example/a', 'http://portal.example/b'],
      'gateway',
    );
    expect(filtered).toEqual(['http://gateway.example/a']);
  });
});
