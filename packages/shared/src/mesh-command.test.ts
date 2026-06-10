import { describe, it, expect } from 'vitest';
import { buildMeshCommand, buildMeshVersion, meshTargetName } from './mesh-command.js';
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

describe('buildMeshVersion', () => {
  it('appends user id to base virtual-env', () => {
    expect(buildMeshVersion('dev.v1', 'guoming')).toBe('dev.v1.guoming');
    expect(buildMeshVersion('dev.v1.abcd', 'guoming')).toBe('dev.v1.abcd.guoming');
  });

  it('rejects empty or dotted user id', () => {
    expect(() => buildMeshVersion('dev.v1', '')).toThrow('个人标识不能为空');
    expect(() => buildMeshVersion('dev.v1', 'a.b')).toThrow('个人标识不能包含点号');
  });
});

describe('buildMeshCommand', () => {
  it('builds ktctl mesh command with personal version mark', () => {
    const cmd = buildMeshCommand(profile, 8001, 'guoming');
    expect(cmd.args).toContain('mesh');
    expect(cmd.args).toContain('ark-server');
    expect(cmd.args).toContain('--versionMark');
    expect(cmd.args).toContain('virtual-env:dev.v2.zt07905.guoming');
    expect(cmd.meshVersion).toBe('dev.v2.zt07905.guoming');
    const selector = cmd.args[cmd.args.indexOf('-l') + 1];
    expect(selector).toContain('virtual-env=dev.v2.zt07905');
    expect(cmd.args).toContain('--expose');
    expect(cmd.args).toContain('8001:80');
    expect(cmd.args).toContain('--useShadowDeployment');
  });

  it('uses selected base virtual-env for version mark while targeting service virtual-env', () => {
    const cmd = buildMeshCommand(profile, 8001, 'guoming', 'dev.v1');
    expect(cmd.args).toContain('virtual-env:dev.v1.guoming');
    expect(cmd.meshVersion).toBe('dev.v1.guoming');

    const selector = cmd.args[cmd.args.indexOf('-l') + 1];
    expect(selector).toContain('virtual-env=dev.v2.zt07905');
  });

  it('uses appName as mesh target when deployment has version suffix', () => {
    const versioned: MeshProfile = {
      deploymentName: 'bms-goods-server-v1',
      namespace: 'app-bsc',
      virtualEnv: 'dev.v1',
      env: 'dev',
      appName: 'bms-goods-server',
      containerPort: 8080,
      suggestedLocalPort: 8080,
    };
    expect(meshTargetName(versioned)).toBe('bms-goods-server');
    const cmd = buildMeshCommand(versioned, 8080, 'guoming');
    expect(cmd.args[1]).toBe('bms-goods-server');
    const selector = cmd.args[cmd.args.indexOf('-l') + 1];
    expect(selector).toContain('app.kubernetes.io/name=bms-goods-server');
  });
});
