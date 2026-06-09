import { describe, expect, it } from 'vitest';
import type { MeshProfile } from '@kt-virtual-env/shared';
import {
  filterMeshProfilesForTab,
  meshProfileKey,
} from './service-list';

const profile: MeshProfile = {
  deploymentName: 'ark-server',
  namespace: 'app-ark',
  virtualEnv: 'dev.v1',
  env: 'dev',
  appName: 'ark-server',
  containerPort: 80,
  suggestedLocalPort: 8001,
};

describe('filterMeshProfilesForTab', () => {
  it('filters favorites from catalog', () => {
    const favorites = new Set([meshProfileKey(profile)]);
    const result = filterMeshProfilesForTab(
      'favorites',
      [],
      [profile],
      favorites,
      [],
      'guoming',
    );
    expect(result).toHaveLength(1);
  });

  it('filters active sessions from catalog', () => {
    const result = filterMeshProfilesForTab(
      'active',
      [],
      [profile],
      new Set(),
      [
        {
          id: '1',
          type: 'mesh',
          target: 'ark-server',
          namespace: 'app-ark',
          state: 'running',
          startedAt: '',
          logs: [],
          command: '',
          localPort: 8001,
          virtualEnv: 'dev.v1.guoming',
        },
      ],
      'guoming',
    );
    expect(result).toHaveLength(1);
  });

  it('matches active mesh by appName when deployment has version suffix', () => {
    const versioned: MeshProfile = {
      deploymentName: 'bms-goods-server-v1',
      namespace: 'app-bsc',
      virtualEnv: 'dev.v1',
      env: 'dev',
      appName: 'bms-goods-server',
      containerPort: 8080,
      suggestedLocalPort: 8080,
    };
    const result = filterMeshProfilesForTab(
      'active',
      [],
      [versioned],
      new Set(),
      [
        {
          id: '1',
          type: 'mesh',
          target: 'bms-goods-server',
          namespace: 'app-bsc',
          state: 'running',
          startedAt: '',
          logs: [],
          command: '',
          localPort: 8080,
          virtualEnv: 'dev.v1.guoming',
        },
      ],
      'guoming',
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.deploymentName).toBe('bms-goods-server-v1');
  });
});
