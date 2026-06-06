import { describe, expect, it } from 'vitest';
import { forwardServiceKey, meshServiceKey, parseServiceKey } from './service-favorites.js';

describe('service-favorites', () => {
  it('builds mesh and forward keys', () => {
    expect(meshServiceKey('app-ark', 'ark-server')).toBe('app-ark/ark-server');
    expect(forwardServiceKey('app-ark', 'ark-svc')).toBe('app-ark/ark-svc');
  });

  it('parses service keys', () => {
    expect(parseServiceKey('app-ark/ark-server')).toEqual({
      namespace: 'app-ark',
      name: 'ark-server',
    });
  });
});
