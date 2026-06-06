import { describe, expect, it } from 'vitest';
import type { MeshProfile } from '@kt-virtual-env/shared';
import { filterMeshProfiles } from './mesh-profile-filter.js';

const sample: MeshProfile = {
  deploymentName: 'ark-server',
  namespace: 'app-ark',
  virtualEnv: 'dev.v1.guoming',
  env: 'dev',
  appName: 'ark-server',
  containerPort: 80,
  suggestedLocalPort: 8001,
};

describe('filterMeshProfiles', () => {
  it('matches virtual-env and deploy name together (AND)', () => {
    const result = filterMeshProfiles([sample], 'dev.v1', undefined, 'ark');
    expect(result).toHaveLength(1);
  });

  it('returns empty when deploy name does not match', () => {
    const result = filterMeshProfiles([sample], 'dev.v1', undefined, 'missing');
    expect(result).toHaveLength(0);
  });
});
