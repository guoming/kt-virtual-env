import type { MeshProfile } from './types.js';

export interface MeshCommand {
  args: string[];
  display: string;
}

export function buildMeshCommand(profile: MeshProfile, localPort: number): MeshCommand {
  const selector = [
    `app.kubernetes.io/env=${profile.env}`,
    `app.kubernetes.io/name=${profile.appName}`,
    `virtual-env=${profile.virtualEnv}`,
  ].join(',');

  const args = [
    'mesh',
    profile.deploymentName,
    '--namespace',
    profile.namespace,
    '--versionMark',
    `virtual-env:${profile.virtualEnv}`,
    '-l',
    selector,
    '--expose',
    `${localPort}:${profile.containerPort}`,
    '--mode',
    'manual',
    '--useShadowDeployment',
    '--podCreationTimeout',
    '120',
  ];

  const display = `ktctl ${args.join(' ')}`;
  return { args, display };
}
