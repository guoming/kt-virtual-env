import { describe, expect, it } from 'vitest';
import { buildPortCandidates } from './port-picker.js';

describe('buildPortCandidates', () => {
  it('prefers suggested port first then scans range', () => {
    const list = buildPortCandidates(8080, 8000, 8002);
    expect(list[0]).toBe(8080);
    expect(list.slice(1)).toEqual([8000, 8001, 8002]);
  });
});
