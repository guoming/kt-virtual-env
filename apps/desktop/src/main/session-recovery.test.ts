import { describe, it, expect } from 'vitest';
import { FailureTracker } from './session-recovery.js';

describe('FailureTracker', () => {
  it('triggers recovery after 2 non-healthy results', () => {
    const tracker = new FailureTracker();
    expect(tracker.record('s1', 'healthy')).toBe(false);
    expect(tracker.record('s1', 'degraded')).toBe(false);
    expect(tracker.record('s1', 'unhealthy')).toBe(true);
    expect(tracker.record('s1', 'healthy')).toBe(false);
    expect(tracker.get('s1')).toBe(0);
  });

  it('ignores unknown level', () => {
    const tracker = new FailureTracker();
    expect(tracker.record('s1', 'unknown')).toBe(false);
    expect(tracker.get('s1')).toBe(0);
  });
});
