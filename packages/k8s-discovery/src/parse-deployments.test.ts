import { describe, it, expect } from 'vitest';
import { parseDeployments } from './parse-deployments.js';
import fixture from './fixtures/deploy-list.json';

describe('parseDeployments', () => {
  it('extracts MeshProfile from deploy list', () => {
    const profiles = parseDeployments(fixture);
    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({
      deploymentName: 'ark-server',
      namespace: 'app-ark',
      virtualEnv: 'dev.v2.zt07905',
      env: 'dev',
      appName: 'ark-server',
      containerPort: 80,
    });
  });
});
