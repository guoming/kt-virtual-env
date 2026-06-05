import { describe, it, expect } from 'vitest';
import { buildMeshCommand } from './mesh-command.js';
import type { MeshProfile } from './types.js';

const profile: MeshProfile = {
  deploymentName: 'ark-server',
  namespace: 'app-ark',
  virtualEnv: 'dev.v2.zt07905',
  env: 'dev',
  appName: 'ark-server',
  containerPort: 80,
  suggestedLocalPort: 8001,
};

describe('buildMeshCommand', () => {
  it('builds ktctl mesh command matching zt-ktctl skill', () => {
    const cmd = buildMeshCommand(profile, 8001);
    expect(cmd.args).toContain('mesh');
    expect(cmd.args).toContain('ark-server');
    expect(cmd.args).toContain('--versionMark');
    expect(cmd.args).toContain('virtual-env:dev.v2.zt07905');
    expect(cmd.args).toContain('--expose');
    expect(cmd.args).toContain('8001:80');
    expect(cmd.args).toContain('--useShadowDeployment');
  });
});
